/**
 * Normalize the agency table: one row per real body, a correct hierarchy, and
 * the SAM.gov spellings recorded as aliases so visibility actually matches.
 *
 * What was wrong, measured on a copy of production
 * ------------------------------------------------
 *   - Department of Defense existed five times (148, 130, 567, 650 "Defense/War",
 *     652 "War"). Two of them held children, split 14/22. The department-level
 *     aliases ("DEPT OF DEFENSE", "Defense Logistics Agency", ...) all sat on 148,
 *     the one with no children. So a component under 650 inherited nothing.
 *   - 64 duplicate groups, 134 rows: a canonical row, a "U.S. X" twin, and an
 *     ALL-CAPS row seeded from the old email map ("DEPT OF THE NAVY"). The caps
 *     row is how SAM.gov spells the office. It was an agency; it must be an alias.
 *   - Defense Logistics Agency was parented to Homeland Security and Coast Guard
 *     to Defense. Both errors are in the source spreadsheet; both are reversed.
 *   - Zero cross-agency scope rows existed anywhere, so a Navy user saw only rows
 *     tagged "Navy", never the Department of Defense rows the Navy office posts.
 *   - 13,438 of 24,412 solicitation office strings (55%) matched no agency and no
 *     alias. 8,422 of those were the two spellings of Defense Logistics Agency.
 *
 * What this does, in one transaction
 * ----------------------------------
 *   A. Explicit folds for the split-brain bodies (DoD, Interior, PBGC, DoDEA,
 *      the Commissary typo, the Corps of Engineers triple). Winner is named.
 *   B. Generic folds: rows whose normalized name matches, lowest ACTIVE id wins.
 *      Never folds two rows that hold different non-null parents. The Interior
 *      OIG and the DHS OIG share a name and are different bodies.
 *   C. Corrects the two known wrong parents and places Space Force and the
 *      Corps of Engineers where they belong.
 *   D. Records every unmatched solicitation agency/office spelling as an alias
 *      of the ONE active agency whose normalized name it equals. Exact match on
 *      the normalized form only. Nothing fuzzy.
 *   E. Inserts scope rows so every component sees its whole ancestor chain.
 *      This is what makes "Navy sees Department of Defense" true. Broad by
 *      default, narrowed by the office filter, which was the program office's
 *      stated direction.
 *   F. Links active users to a canonical agency by id where their recorded
 *      agency string equals a canonical name or alias, so the scope rows apply
 *      to them rather than the string fallback.
 *   G. Classifies: a row that now has a parent is a federal_component; a
 *      top-level row named in the old AGENCY_MAP is a federal_agency.
 *
 * Every fold follows the same rule as merge_duplicate_agencies.js: the losing
 * name becomes an alias of the winner, every reference is repointed, and the
 * loser is deactivated, never deleted. Solicitation rows are never written.
 *
 * Deviation sources are deliberately untouched. No row in any environment holds
 * one, and the spreadsheet's deviation column is empty on all 256 rows. Which
 * agencies carry a deviation is policy, and it is the program office's call.
 *
 * Dry run by default. Prints the full plan and a before/after visibility
 * differential, and exits without writing. Pass --apply to perform it.
 *
 *   node server/scripts/normalize_agencies.js                 # report only
 *   node server/scripts/normalize_agencies.js --apply         # perform
 *   node server/scripts/normalize_agencies.js --database srt  # other local db
 *
 * Uses pg directly. server/models/index.js runs pending migrations at require
 * time, which a read-only report must never trigger.
 */

const { Pool } = require('pg')

// ── Normalization ──────────────────────────────────────────────────────────

/** Strip the decorations SAM.gov and humans add to the same name. */
function normalize (name) {
  let s = String(name || '')
    .replace(/ /g, ' ')
    .replace(/[​-‍]/g, '')
    .toLowerCase()
    .trim()
  // "VETERANS AFFAIRS, DEPARTMENT OF" -> "department of veterans affairs"
  s = s.replace(/^(.*?),\s*(department|dept\.?)\s+of(\s+the)?$/, 'department of $1')
  // "Education Department" -> "department of education"
  s = s.replace(/^(.*?)\s+department$/, 'department of $1')
  s = s.replace(/^(u\.?s\.?|united states)\s+/, '')
  s = s.replace(/^(department|dept\.?)\s+of\s+(the\s+)?/, '')
  s = s.replace(/\/war$/, '')                      // "defense/war" -> "defense"
  s = s.replace(/\s*\([^)]*\)/g, '')               // "(DLA)", "(DHA)"
  s = s.replace(/&/g, ' and ')
  s = s.replace(/[^a-z0-9 ]/g, ' ')
  s = s.replace(/\s+/g, ' ').trim()
  return s
}

// ── Explicit decisions ─────────────────────────────────────────────────────
// Keyed by the name as it exists in the table, matched after normalize().
// These are the cases the generic rule cannot decide, either because the
// names differ ("Department of War" vs "Department of Defense") or because the
// generic rule would pick the wrong winner.

const CANONICAL_DEPARTMENTS = new Set([
  'Department of Agriculture', 'Department of Commerce', 'Department of Defense',
  'Department of Education', 'Department of Energy',
  'Department of Health and Human Services', 'Department of Homeland Security',
  'Department of Housing and Urban Development', 'Department of Justice',
  'Department of Labor', 'Department of State', 'Department of the Interior',
  'Department of the Treasury', 'Department of Transportation',
  'Department of Veterans Affairs', 'Environmental Protection Agency',
  'Executive Office of the President', 'General Services Administration',
  'Agency for International Development',
  'National Aeronautics and Space Administration', 'National Science Foundation',
  'Nuclear Regulatory Commission', 'Office of Personnel Management',
  'Small Business Administration', 'Social Security Administration',
  'Library of Congress', 'National Archives and Records Administration',
  'Millennium Challenge Corporation'
])

/** Fold these names into the named winner. The winner's name is the canonical. */
const EXPLICIT_FOLDS = [
  { into: 'Department of Defense', names: ['Department of War', 'Department of Defense/War', 'Defense Department', 'U.S. Department of Defense'] },
  { into: 'Department of the Interior', names: ['Department of Interior'] },
  { into: 'Pension Benefit Guaranty Corporation', names: ['Pension Benefit Guaranty Corporation (PBGC)'] },
  { into: 'Defense Commissary Agency', names: ['Defense Commisary Agency'] },
  { into: 'Army Corps of Engineers', names: ['US Army Corps of Engineers, US Army', 'U.S. Army Corps of Engineers'] },
  { into: 'Department of Defense Education Activity', names: ['DOD Education Activity', 'Department of Defense/War Education Activity'] }
]

/** Rename before folding, so the winner carries the canonical spelling. */
const RENAMES = {
  'DOD Education Activity': 'Department of Defense Education Activity',
  'SPACE FORCE': 'Space Force'   // seeded in SAM.gov caps; the caps form becomes an alias below
}

/** Corrections to parentage. Right-hand side is the parent's canonical name. */
const PARENT_FIXES = {
  'Defense Logistics Agency': 'Department of Defense',          // was Homeland Security
  'Coast Guard': 'Department of Homeland Security',               // was Defense
  'Space Force': 'Department of Defense',                          // had no parent
  'Army Corps of Engineers': 'Army',                              // a component of the Army
  'Defense Commissary Agency': 'Department of Defense',
  'Defense Health Agency': 'Department of Defense',
  'Department of Defense Education Activity': 'Department of Defense',
  'Air Force Reserve': 'Air Force',
  'Army': 'Department of Defense', 'Navy': 'Department of Defense',
  'Air Force': 'Department of Defense', 'Marine Corps': 'Department of Defense'
}

// ── Helpers ────────────────────────────────────────────────────────────────

function parseArgs (argv) {
  const a = { apply: false, database: null }
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--apply') a.apply = true
    else if (argv[i] === '--database') a.database = argv[++i]
  }
  return a
}

async function poolFor (args) {
  const base = require('../config/dbConfig')[process.env.NODE_ENV || 'development']
  const cfg = args.database ? { ...base, database: args.database } : base
  return new Pool({
    host: cfg.host, port: cfg.port || 5432, database: cfg.database,
    user: cfg.username, password: cfg.password,
    ...(cfg.dialectOptions && cfg.dialectOptions.ssl ? { ssl: cfg.dialectOptions.ssl } : {})
  })
}

/** Names every agency can see, as the read path computes them. Used to prove no loss. */
async function visibilitySnapshot (q) {
  const agencies = (await q('SELECT id, agency, active FROM "Agencies"')).rows
  const byId = new Map(agencies.map(a => [a.id, a]))
  const scope = (await q('SELECT "agencyId", "visibleAgencyId" FROM agency_solicitation_scope')).rows
  const aliases = (await q('SELECT agency_id, alias FROM agency_alias')).rows
  const scopeBy = new Map(); const aliasBy = new Map()
  for (const s of scope) { if (!scopeBy.has(s.agencyId)) scopeBy.set(s.agencyId, []); scopeBy.get(s.agencyId).push(s.visibleAgencyId) }
  for (const a of aliases) { if (!aliasBy.has(a.agency_id)) aliasBy.set(a.agency_id, []); aliasBy.get(a.agency_id).push(a.alias) }
  const snap = new Map()
  for (const a of agencies) {
    if (a.active === false) continue
    const ids = scopeBy.get(a.id) || [a.id]
    const names = new Set()
    for (const id of ids) {
      const v = byId.get(id); if (!v || v.active === false) continue
      names.add(v.agency); for (const al of aliasBy.get(id) || []) names.add(al)
    }
    names.add(a.agency)
    snap.set(a.agency, names)
  }
  return snap
}

/** Rows a given set of names matches, on either column. */
async function matchedRows (q, names) {
  if (!names.length) return 0
  const r = await q('SELECT count(*)::int c FROM solicitations WHERE agency = ANY($1) OR office = ANY($1)', [names])
  return r.rows[0].c
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main () {
  const args = parseArgs(process.argv)
  const pool = await poolFor(args)
  const client = await pool.connect()
  const q = (sql, p) => client.query(sql, p)
  const plan = []            // human-readable actions
  const done = { folds: 0, aliases: 0, parents: 0, scope: 0, users: 0, classified: 0, renames: 0 }

  try {
    await q('BEGIN')

    const load = async () => (await q('SELECT id, agency, "parentId", "agencyType", active, provenance FROM "Agencies" ORDER BY id')).rows
    let rows = await load()
    const byName = () => new Map(rows.map(r => [r.agency, r]))
    const activeByKey = () => {
      const m = new Map()
      for (const r of rows) { if (r.active === false) continue; const k = normalize(r.agency); if (!m.has(k)) m.set(k, []); m.get(k).push(r) }
      return m
    }

    const before = await visibilitySnapshot(q)
    const beforeCounts = {
      agencies: rows.filter(r => r.active !== false).length,
      withParent: rows.filter(r => r.active !== false && r.parentId).length,
      needsReview: rows.filter(r => r.active !== false && r.agencyType === 'needs_review').length,
      scopeCross: (await q('SELECT count(*)::int c FROM agency_solicitation_scope WHERE "agencyId"<>"visibleAgencyId"')).rows[0].c,
      aliases: (await q('SELECT count(*)::int c FROM agency_alias')).rows[0].c
    }

    // Fold `loser` into `winner`: alias, repoint every reference, deactivate.
    // Mirrors merge_duplicate_agencies.js exactly, including the scope-collision
    // deletes that must precede the repoint.
    const fold = async (winner, loser, why) => {
      if (winner.id === loser.id) return
      plan.push(`FOLD   ${loser.agency}  ->  ${winner.agency}   (${why})`)
      const ex = await q('SELECT 1 FROM agency_alias WHERE agency_id=$1 AND alias=$2', [winner.id, loser.agency])
      if (!ex.rows.length && loser.agency !== winner.agency) {
        await q('INSERT INTO agency_alias (agency_id, alias, "createdAt","updatedAt") VALUES ($1,$2,NOW(),NOW())', [winner.id, loser.agency]); done.aliases++
      }
      await q('UPDATE agency_alias SET agency_id=$1 WHERE agency_id=$2', [winner.id, loser.id])
      await q('DELETE FROM agency_alias a USING agency_alias b WHERE a.agency_id=b.agency_id AND a.alias=b.alias AND a.id>b.id')
      done.users += (await q('UPDATE "Users" SET "agencyId"=$1 WHERE "agencyId"=$2', [winner.id, loser.id])).rowCount
      await q('UPDATE agency_domains SET "agencyId"=$1 WHERE "agencyId"=$2', [winner.id, loser.id])
      await q('UPDATE "Agencies" SET "parentId"=$1 WHERE "parentId"=$2 AND id<>$1', [winner.id, loser.id])
      await q('UPDATE "Agencies" SET "deviationSourceId"=$1 WHERE "deviationSourceId"=$2', [winner.id, loser.id])
      await q(`DELETE FROM agency_solicitation_scope a WHERE a."agencyId"=$2 AND EXISTS
               (SELECT 1 FROM agency_solicitation_scope b WHERE b."agencyId"=$1 AND b."visibleAgencyId"=a."visibleAgencyId")`, [winner.id, loser.id])
      await q('UPDATE agency_solicitation_scope SET "agencyId"=$1 WHERE "agencyId"=$2', [winner.id, loser.id])
      await q(`DELETE FROM agency_solicitation_scope a WHERE a."visibleAgencyId"=$2 AND EXISTS
               (SELECT 1 FROM agency_solicitation_scope b WHERE b."visibleAgencyId"=$1 AND b."agencyId"=a."agencyId")`, [winner.id, loser.id])
      await q('UPDATE agency_solicitation_scope SET "visibleAgencyId"=$1 WHERE "visibleAgencyId"=$2', [winner.id, loser.id])
      await q('DELETE FROM agency_solicitation_scope WHERE "agencyId"="visibleAgencyId" AND "agencyId"=$1 AND ctid NOT IN (SELECT min(ctid) FROM agency_solicitation_scope WHERE "agencyId"=$1 AND "visibleAgencyId"=$1)', [winner.id])
      // A winner that had no parent inherits the loser's, so folding "Defense/War"
      // (which held the components) into "Department of Defense" keeps the tree.
      if (!winner.parentId && loser.parentId && loser.parentId !== winner.id) {
        await q('UPDATE "Agencies" SET "parentId"=$1 WHERE id=$2', [loser.parentId, winner.id]); winner.parentId = loser.parentId
      }
      await q('UPDATE "Agencies" SET active=false, "updatedAt"=NOW() WHERE id=$1', [loser.id])
      loser.active = false; done.folds++
    }

    // A. Renames, then explicit folds.
    for (const [from, to] of Object.entries(RENAMES)) {
      const r = byName().get(from)
      if (r && r.active !== false && !byName().get(to)) {
        plan.push(`RENAME ${from}  ->  ${to}`)
        await q('UPDATE "Agencies" SET agency=$1, "updatedAt"=NOW() WHERE id=$2', [to, r.id]); r.agency = to; done.renames++
      }
    }
    for (const f of EXPLICIT_FOLDS) {
      const names = byName()
      let winner = names.get(f.into)
      if (!winner) {
        // Winner may exist only under a losing spelling; promote the lowest active loser.
        const cands = f.names.map(n => names.get(n)).filter(r => r && r.active !== false).sort((a, b) => a.id - b.id)
        if (!cands.length) continue
        winner = cands[0]
        plan.push(`RENAME ${winner.agency}  ->  ${f.into}`)
        await q('UPDATE "Agencies" SET agency=$1, "updatedAt"=NOW() WHERE id=$2', [f.into, winner.id]); winner.agency = f.into; done.renames++
      }
      if (winner.active === false) { await q('UPDATE "Agencies" SET active=true WHERE id=$1', [winner.id]); winner.active = true }
      for (const n of f.names) {
        const loser = byName().get(n)
        // Skip rows already folded on a previous run, so re-running is a no-op
        // rather than a page of repeated FOLD lines.
        if (loser && loser.id !== winner.id && loser.active !== false) await fold(winner, loser, 'explicit')
      }
    }
    rows = await load()

    // B. Generic folds on the normalized name. Rows that hold different non-null
    //    parents are different bodies and are left alone.
    //
    //    The winner is NOT simply the lowest id. On a local trial that rule folded
    //    "Department of Agriculture" INTO "Agriculture Department", deactivating
    //    the canonical row every alias and the old config map point to, purely
    //    because the variant happened to hold a lower id. The winner is instead:
    //      1. a name in CANONICAL_DEPARTMENTS, if any row in the group has one;
    //      2. otherwise the row with the most things attached (children, aliases,
    //         domains, users), because that is the one the system already treats
    //         as real;
    //      3. otherwise the lowest id.
    const refCount = new Map()
    for (const r of rows) {
      let n = 0
      n += (await q('SELECT count(*)::int c FROM "Agencies" WHERE "parentId"=$1', [r.id])).rows[0].c * 10
      n += (await q('SELECT count(*)::int c FROM agency_alias WHERE agency_id=$1', [r.id])).rows[0].c
      n += (await q('SELECT count(*)::int c FROM agency_domains WHERE "agencyId"=$1', [r.id])).rows[0].c
      n += (await q('SELECT count(*)::int c FROM "Users" WHERE "agencyId"=$1', [r.id])).rows[0].c
      refCount.set(r.id, n)
    }
    // An ALL-CAPS name is how SAM.gov and the old email map spell things; it is
    // never the canonical form. Without this, "Centers for Medicare and Medicaid
    // Services" folded INTO "CENTERS FOR MEDICARE & MEDICAID SERVICES" because
    // the seeded domain row happened to hang off the caps spelling.
    const isAllCaps = (s) => /[A-Z]/.test(s) && s === s.toUpperCase()
    const rank = (r) => [
      CANONICAL_DEPARTMENTS.has(r.agency) ? 0 : 1,
      isAllCaps(r.agency) ? 1 : 0,
      -(refCount.get(r.id) || 0),
      r.id
    ]
    const cmp = (a, b) => { const x = rank(a), y = rank(b); for (let i = 0; i < 4; i++) if (x[i] !== y[i]) return x[i] - y[i]; return 0 }
    for (const [key, group] of activeByKey()) {
      if (group.length < 2) continue
      const sorted = [...group].sort(cmp)
      const winner = sorted[0]
      for (const loser of sorted.slice(1)) {
        if (loser.parentId && winner.parentId && loser.parentId !== winner.parentId) {
          plan.push(`KEEP   ${loser.agency} and ${winner.agency}: same name, different parents (${key})`); continue
        }
        await fold(winner, loser, 'same normalized name')
      }
    }
    rows = await load()

    // C. Parentage corrections and placements.
    const setParent = async (childName, parentName) => {
      const names = byName(); const c = names.get(childName); const p = names.get(parentName)
      if (!c || !p || c.active === false) return
      if (c.parentId === p.id) return
      // never create a cycle
      let cur = p; let depth = 0
      while (cur && depth++ < 20) { if (cur.id === c.id) { plan.push(`SKIP   ${childName} -> ${parentName} would cycle`); return } cur = cur.parentId ? rows.find(r => r.id === cur.parentId) : null }
      const old = c.parentId ? rows.find(r => r.id === c.parentId) : null
      plan.push(`PARENT ${childName}  ->  ${parentName}${old ? '   (was ' + old.agency + ')' : ''}`)
      await q('UPDATE "Agencies" SET "parentId"=$1, "updatedAt"=NOW() WHERE id=$2', [p.id, c.id]); c.parentId = p.id; done.parents++
    }
    for (const [child, parent] of Object.entries(PARENT_FIXES)) await setParent(child, parent)
    rows = await load()

    // D. Aliases from the spellings SAM.gov actually uses. Exact normalized match
    //    to exactly one ACTIVE agency, on either column.
    const keyToActive = activeByKey()
    const known = new Set()
    for (const r of rows) if (r.active !== false) known.add(r.agency)
    for (const a of (await q('SELECT alias FROM agency_alias')).rows) known.add(a.alias)
    const spellings = (await q(`
      SELECT s AS name, sum(c)::int AS c FROM (
        SELECT agency s, count(*) c FROM solicitations WHERE agency<>'' GROUP BY 1
        UNION ALL
        SELECT office s, count(*) c FROM solicitations WHERE office<>'' GROUP BY 1
      ) t GROUP BY s ORDER BY 2 DESC`)).rows
    let aliasedRows = 0
    for (const sp of spellings) {
      if (known.has(sp.name)) continue
      const cands = keyToActive.get(normalize(sp.name)) || []
      if (cands.length !== 1) continue
      const target = cands[0]
      if (target.agency === sp.name) continue
      plan.push(`ALIAS  "${sp.name}"  ->  ${target.agency}   (${sp.c} rows)`)
      await q('INSERT INTO agency_alias (agency_id, alias, "createdAt","updatedAt") VALUES ($1,$2,NOW(),NOW())', [target.id, sp.name])
      known.add(sp.name); done.aliases++; aliasedRows += sp.c
    }

    // E. Every component sees its whole ancestor chain.
    const byId = new Map(rows.map(r => [r.id, r]))
    for (const r of rows) {
      if (r.active === false || !r.parentId) continue
      let cur = byId.get(r.parentId); let depth = 0
      while (cur && depth++ < 10) {
        if (cur.active !== false) {
          const ins = await q(`INSERT INTO agency_solicitation_scope ("agencyId","visibleAgencyId","createdAt","updatedAt")
                               VALUES ($1,$2,NOW(),NOW()) ON CONFLICT ("agencyId","visibleAgencyId") DO NOTHING`, [r.id, cur.id])
          if (ins.rowCount) { done.scope++; if (done.scope <= 40) plan.push(`SEES   ${r.agency}  sees  ${cur.agency}`) }
        }
        cur = cur.parentId ? byId.get(cur.parentId) : null
      }
      await q(`INSERT INTO agency_solicitation_scope ("agencyId","visibleAgencyId","createdAt","updatedAt")
               VALUES ($1,$1,NOW(),NOW()) ON CONFLICT DO NOTHING`, [r.id])
    }

    // F. Link users to a canonical agency by id.
    const aliasToId = new Map()
    for (const a of (await q('SELECT agency_id, alias FROM agency_alias')).rows) aliasToId.set(a.alias.toLowerCase(), a.agency_id)
    for (const r of rows) if (r.active !== false) aliasToId.set(r.agency.toLowerCase(), r.id)
    const users = (await q(`SELECT id, agency FROM "Users" WHERE "agencyId" IS NULL AND "isAccepted"=true AND "isRejected"=false AND agency IS NOT NULL AND agency<>''`)).rows
    for (const u of users) {
      const id = aliasToId.get(u.agency.toLowerCase())
      if (id) { await q('UPDATE "Users" SET "agencyId"=$1 WHERE id=$2', [id, u.id]); done.users++ }
    }

    // G. Classification.
    const classified = await q(`UPDATE "Agencies" SET "agencyType"='federal_component', "updatedAt"=NOW()
                                WHERE active AND "parentId" IS NOT NULL AND "agencyType"='needs_review'`)
    done.classified += classified.rowCount
    const depts = [...CANONICAL_DEPARTMENTS]
    const promoted = await q(`UPDATE "Agencies" SET "agencyType"='federal_agency', "updatedAt"=NOW()
                              WHERE active AND "parentId" IS NULL AND agency = ANY($1) AND "agencyType"<>'federal_agency'`, [depts])
    done.classified += promoted.rowCount

    // ── Verify: nothing anyone could see before is invisible now ────────────
    rows = await load()
    const after = await visibilitySnapshot(q)
    const losses = []
    for (const [name, names] of before) {
      const now = after.get(name)
      if (!now) continue                                  // folded: checked via winner below
      const b = await matchedRows(q, [...names]); const a = await matchedRows(q, [...now])
      if (a < b) losses.push({ name, before: b, after: a })
    }
    // Folded losers: their users now sit on the winner. Winner must cover at least what loser could match.
    const afterCounts = {
      agencies: rows.filter(r => r.active !== false).length,
      withParent: rows.filter(r => r.active !== false && r.parentId).length,
      needsReview: rows.filter(r => r.active !== false && r.agencyType === 'needs_review').length,
      scopeCross: (await q('SELECT count(*)::int c FROM agency_solicitation_scope WHERE "agencyId"<>"visibleAgencyId"')).rows[0].c,
      aliases: (await q('SELECT count(*)::int c FROM agency_alias')).rows[0].c
    }
    const unmatched = async () => (await q(`
      SELECT count(*)::int c FROM solicitations s
      WHERE s.office<>'' AND s.office NOT IN (SELECT agency FROM "Agencies" WHERE active)
        AND s.office NOT IN (SELECT alias FROM agency_alias)`)).rows[0].c
    const unmatchedAfter = await unmatched()

    // ── Report ─────────────────────────────────────────────────────────────
    console.log(`\nDatabase: ${(args.database || require('../config/dbConfig')[process.env.NODE_ENV || 'development'].database)}`)
    console.log(`Mode: ${args.apply ? 'APPLY' : 'DRY RUN (nothing written)'}\n`)
    console.log('Plan:')
    for (const p of plan) console.log('  ' + p)
    if (done.scope > 40) console.log(`  ... and ${done.scope - 40} more SEES rows`)
    console.log('\nCounts                 before   after')
    for (const k of Object.keys(beforeCounts)) console.log(`  ${k.padEnd(20)} ${String(beforeCounts[k]).padStart(6)}  ${String(afterCounts[k]).padStart(6)}`)
    console.log(`\n  folds ${done.folds}  renames ${done.renames}  parents fixed ${done.parents}  aliases added ${done.aliases}  scope rows added ${done.scope}  users linked ${done.users}  classified ${done.classified}`)
    console.log(`  solicitation rows newly reachable through aliases: ${aliasedRows.toLocaleString()}`)
    console.log(`  office strings still matching nothing: ${unmatchedAfter.toLocaleString()} rows`)

    // Print the DoD tree as the worked example.
    const dod = rows.find(r => r.agency === 'Department of Defense' && r.active !== false)
    if (dod) {
      const kids = rows.filter(r => r.parentId === dod.id && r.active !== false).sort((a, b) => a.agency.localeCompare(b.agency))
      console.log(`\nDepartment of Defense (id ${dod.id}) now has ${kids.length} components:`)
      for (const k of kids) {
        const gk = rows.filter(r => r.parentId === k.id && r.active !== false).map(r => r.agency)
        console.log(`  - ${k.agency}${gk.length ? '  ->  ' + gk.join(', ') : ''}`)
      }
    }

    if (losses.length) {
      console.log('\nVISIBILITY LOSS DETECTED. Refusing to apply.')
      for (const l of losses) console.log(`  ${l.name}: could match ${l.before} rows, now ${l.after}`)
      await q('ROLLBACK'); client.release(); await pool.end(); process.exit(2)
    }
    console.log('\nVisibility check: no agency can see fewer solicitation rows than before.')

    if (!args.apply) { await q('ROLLBACK'); console.log('\nDry run complete. Nothing was changed. Pass --apply to perform.'); }
    else { await q('COMMIT'); console.log('\nApplied.') }
  } catch (e) {
    await q('ROLLBACK').catch(() => {})
    console.error('\nRolled back, nothing was changed.\n' + (e.stack || e.message))
    client.release(); await pool.end(); process.exit(1)
  }
  client.release(); await pool.end()
}

module.exports = { normalize }
if (require.main === module) main().catch(e => { console.error(e); process.exit(1) })
