/**
 * My Drafts — per-user, auto-saved manual-upload analyses.
 *
 * Design (per product decisions):
 *  - Results only: the uploaded files are NEVER stored, just the pipeline
 *    result JSON + metadata (name, sha256, size of history kept in Postgres).
 *  - Auto-save: pipeline-v4 calls saveVersion() after every completed run.
 *  - Version control: append-only. A re-run of the same document title for
 *    the same user creates version N+1 — nothing is overwritten.
 *  - Per-user cache: findCachedResult() matches sha256(content) + pipeline
 *    version for the SAME user, so re-checking an unchanged file is instant
 *    and costs zero LLM tokens.
 *  - Privacy: drafts are scoped to the owning user's email from the JWT.
 *    There is intentionally NO admin listing — these are pre-award documents.
 */

const logger = require('../config/winston')
const authRoutes = require('./auth.routes')

// Drafts are a SESSION cache, not storage: results expire automatically after a
// short window. The uploaded documents themselves are never stored — only the
// analysis result. Deliberately minutes, not days: this exists so re-checking a
// document you just ran is instant, NOT so work is retained across sessions.
const RETENTION_MINUTES = 30;

module.exports = function (pgPool) {

  /** Drop expired cache entries. Cheap, and keeps the promise we make in the UI. */
  async function purgeExpired () {
    try {
      await pgPool.query(
        `DELETE FROM draft_versions WHERE created_at < NOW() - INTERVAL '${RETENTION_MINUTES} minutes'`);
      await pgPool.query(
        `DELETE FROM draft_solicitations d
          WHERE NOT EXISTS (SELECT 1 FROM draft_versions v WHERE v.draft_id = d.id)`);
    } catch (e) {
      logger.log('warn', 'draft cache purge failed', { error: e.message, tag: 'drafts' });
    }
  }

  function emailFromReq (req) {
    const user = authRoutes.userInfoFromReq(req)
    return (user && user.email) ? String(user.email).toLowerCase() : null
  }

  async function findOrCreateDraft (userEmail, title) {
    const found = await pgPool.query(
      'SELECT id FROM draft_solicitations WHERE user_email = $1 AND title = $2',
      [userEmail, title])
    if (found.rows.length) {
      await pgPool.query('UPDATE draft_solicitations SET updated_at = NOW() WHERE id = $1', [found.rows[0].id])
      return found.rows[0].id
    }
    const ins = await pgPool.query(
      'INSERT INTO draft_solicitations (user_email, title, created_at, updated_at) VALUES ($1, $2, NOW(), NOW()) RETURNING id',
      [userEmail, title])
    return ins.rows[0].id
  }

  /** Persist one completed run as the next version of the user's draft. */
  async function saveVersion (userEmail, { title, fileName, contentHash, source, pipelineVersion, verdict, result }) {
    // Purge on write as well as on read. list() alone is not enough: if nobody
    // opens My Drafts, expired rows would sit in the table past the retention
    // window we promise in the UI. Every analysis run now sweeps.
    await purgeExpired()
    const draftId = await findOrCreateDraft(userEmail, title)
    const v = await pgPool.query(
      'SELECT COALESCE(MAX(version_number), 0) + 1 AS next FROM draft_versions WHERE draft_id = $1',
      [draftId])
    const versionNumber = v.rows[0].next
    await pgPool.query(
      `INSERT INTO draft_versions
         (draft_id, version_number, file_name, content_hash, source, pipeline_version, verdict, result, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
      [draftId, versionNumber, fileName, contentHash, source, pipelineVersion, verdict, JSON.stringify(result)])
    return { draft_id: draftId, version_number: versionNumber }
  }

  /** Per-user cache: latest stored result for identical content + pipeline. */
  async function findCachedResult (userEmail, contentHash, pipelineVersion) {
    // Only serve cache entries inside the retention window.
    const r = await pgPool.query(
      `SELECT dv.result, dv.created_at, dv.version_number, dv.draft_id
         FROM draft_versions dv
         JOIN draft_solicitations d ON d.id = dv.draft_id
        WHERE d.user_email = $1 AND dv.content_hash = $2 AND dv.pipeline_version = $3
          AND dv.created_at > NOW() - INTERVAL '${RETENTION_MINUTES} minutes'
        ORDER BY dv.created_at DESC
        LIMIT 1`,
      [userEmail, contentHash, pipelineVersion])
    return r.rows[0] || null
  }

  // ── HTTP handlers (mounted with token() in app.js) ────────────────────────

  async function list (req, res) {
    const email = emailFromReq(req)
    if (!email) return res.status(401).send({ error: 'Could not identify user from token.' })
    try {
      await purgeExpired()
      const r = await pgPool.query(
        `SELECT d.id, d.title, d.updated_at,
                COUNT(v.id)::int AS version_count,
                (SELECT verdict    FROM draft_versions WHERE draft_id = d.id ORDER BY version_number DESC LIMIT 1) AS latest_verdict,
                (SELECT created_at FROM draft_versions WHERE draft_id = d.id ORDER BY version_number DESC LIMIT 1) AS last_run
           FROM draft_solicitations d
           LEFT JOIN draft_versions v ON v.draft_id = d.id
          WHERE d.user_email = $1
          GROUP BY d.id
          ORDER BY d.updated_at DESC
          LIMIT 100`,
        [email])
      res.send(r.rows)
    } catch (e) {
      logger.log('error', 'drafts list failed', { error: e.message, tag: 'drafts' })
      res.status(500).send({ error: 'Unable to load drafts.' })
    }
  }

  async function get (req, res) {
    const email = emailFromReq(req)
    if (!email) return res.status(401).send({ error: 'Could not identify user from token.' })
    try {
      const d = await pgPool.query(
        'SELECT id, title, created_at, updated_at FROM draft_solicitations WHERE id = $1 AND user_email = $2',
        [req.params.id, email])
      if (!d.rows.length) return res.status(404).send({ error: 'Draft not found.' })
      const v = await pgPool.query(
        `SELECT id, version_number, file_name, content_hash, source, pipeline_version, verdict, result, created_at
           FROM draft_versions
          WHERE draft_id = $1
          ORDER BY version_number DESC
          LIMIT 20`,
        [req.params.id])
      res.send({ ...d.rows[0], versions: v.rows })
    } catch (e) {
      logger.log('error', 'drafts get failed', { error: e.message, tag: 'drafts' })
      res.status(500).send({ error: 'Unable to load draft.' })
    }
  }

  async function remove (req, res) {
    const email = emailFromReq(req)
    if (!email) return res.status(401).send({ error: 'Could not identify user from token.' })
    try {
      const r = await pgPool.query(
        'DELETE FROM draft_solicitations WHERE id = $1 AND user_email = $2 RETURNING id',
        [req.params.id, email])
      if (!r.rows.length) return res.status(404).send({ error: 'Draft not found.' })
      res.send({ deleted: true })
    } catch (e) {
      logger.log('error', 'drafts delete failed', { error: e.message, tag: 'drafts' })
      res.status(500).send({ error: 'Unable to delete draft.' })
    }
  }

  return { list, get, remove, saveVersion, findCachedResult, emailFromReq, purgeExpired }
}
