#!/usr/bin/env node
'use strict'

/**
 * Put existing broken users into the Needs Review queue.
 *
 * The queue is driven by Users.unresolvedDomain, which is only ever written when
 * an account is created. Everyone who signed up before unmapped domains were
 * routed to review therefore has NULL there, so the queue shows nothing even
 * though 91 active users hold an agency string that matches no solicitation and
 * see an empty tool.
 *
 * This sets unresolvedDomain from the user's email address for exactly those
 * users, so they group by domain in the admin console and one decision fixes
 * everyone on that domain at once.
 *
 * What it deliberately does NOT do:
 *
 *   It never changes anyone's agency. Which agency a user belongs to is a
 *   judgement, and the report showed why: 39 users sat under one string but
 *   spread across six different military domains. That decision belongs to the
 *   program through the admin screen, not to a script.
 *
 *   It never touches a user who can already see something, or an account that
 *   is rejected or not yet accepted.
 *
 * Setting unresolvedDomain changes nothing about visibility. Nothing reads it
 * except the needs-review listing, and these users already see nothing. The
 * only effect is that they become visible to an administrator.
 *
 *   node server/scripts/backfill_needs_review.js              # dry run
 *   node server/scripts/backfill_needs_review.js --apply
 */

function parseArgs (argv) {
  const a = { apply: false, database: null }
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--apply') a.apply = true
    else if (argv[i] === '--database') a.database = argv[++i]
  }
  return a
}

async function main () {
  const args = parseArgs(process.argv)
  const { Pool } = require('pg')
  const base = require('../config/dbConfig')[process.env.NODE_ENV || 'development']
  const cfg = args.database ? { ...base, database: args.database } : base

  const pool = new Pool({
    host: cfg.host, port: cfg.port || 5432, database: cfg.database,
    user: cfg.username, password: cfg.password,
    ...(cfg.dialectOptions && cfg.dialectOptions.ssl ? { ssl: cfg.dialectOptions.ssl } : {})
  })

  console.log(`Database: ${cfg.database}\n`)

  const col = await pool.query(
    `SELECT 1 FROM information_schema.columns
      WHERE table_name = 'Users' AND column_name = 'unresolvedDomain'`)
  if (!col.rows.length) {
    console.error('Users.unresolvedDomain does not exist in this database.')
    console.error('The agency migrations have not run here yet. Deploy first, then backfill.')
    await pool.end()
    process.exit(2)
  }

  // Active users whose agency string reaches no solicitation, and who are not
  // already in the queue.
  const { rows } = await pool.query(`
    SELECT u.id, u.email, u.agency, split_part(lower(u.email), '@', 2) AS domain
      FROM "Users" u
     WHERE u."isAccepted" AND NOT u."isRejected"
       AND u."unresolvedDomain" IS NULL
       AND u.email LIKE '%@%'
       AND u.agency IS NOT NULL AND u.agency <> ''
       AND NOT EXISTS (
             SELECT 1 FROM solicitations s
              WHERE s.agency = u.agency OR s.office = u.agency)
     ORDER BY split_part(lower(u.email), '@', 2), u.email`)

  if (!rows.length) {
    console.log('No users to add. Either none are affected or they are already queued.')
    await pool.end()
    return
  }

  const byDomain = new Map()
  for (const r of rows) {
    if (!byDomain.has(r.domain)) byDomain.set(r.domain, [])
    byDomain.get(r.domain).push(r)
  }

  console.log(`${rows.length} active users see nothing, across ${byDomain.size} domains.`)
  console.log('Each domain below becomes one entry in the Needs Review queue.\n')
  for (const [d, users] of [...byDomain.entries()].sort((a, b) => b[1].length - a[1].length)) {
    const agencies = [...new Set(users.map(u => u.agency))]
    console.log(`  ${String(users.length).padStart(3)}  @${d.padEnd(24)} currently on: ${agencies.slice(0, 2).join(', ')}${agencies.length > 2 ? ` +${agencies.length - 2} more` : ''}`)
  }
  console.log()

  if (!args.apply) {
    console.log('Dry run. Nothing was changed. Pass --apply to write.')
    await pool.end()
    return
  }

  const client = await pool.connect()
  let updated = 0
  try {
    await client.query('BEGIN')
    const res = await client.query(`
      UPDATE "Users" u
         SET "unresolvedDomain" = split_part(lower(u.email), '@', 2),
             "updatedAt" = NOW()
       WHERE u."isAccepted" AND NOT u."isRejected"
         AND u."unresolvedDomain" IS NULL
         AND u.email LIKE '%@%'
         AND u.agency IS NOT NULL AND u.agency <> ''
         AND NOT EXISTS (
               SELECT 1 FROM solicitations s
                WHERE s.agency = u.agency OR s.office = u.agency)`)
    updated = res.rowCount
    await client.query('COMMIT')
  } catch (e) {
    await client.query('ROLLBACK')
    console.error('\nRolled back, nothing was changed.')
    console.error(e.message)
    client.release(); await pool.end(); process.exit(1)
  }
  client.release()

  console.log(`Backfill applied. ${updated} users added to the Needs Review queue.`)
  console.log('No agency was changed and no visibility was altered. They were already')
  console.log('seeing nothing; they are now visible to an administrator.')
  await pool.end()
}

if (require.main === module) main().catch(e => { console.error(e); process.exit(1) })
