#!/usr/bin/env node
'use strict'

/**
 * Collapse duplicate agency records into one, using aliases rather than deletion.
 *
 * SRT holds pairs of agencies that are the same body under two spellings,
 * almost all of them "X" and "U.S. X". Visibility matches on the agency name
 * string, so a user recorded under one spelling cannot see solicitations tagged
 * with the other.
 *
 * The obvious fix is to merge the rows and rewrite the losing name everywhere it
 * appears. That would mean rewriting tens of thousands of solicitation rows, and
 * getting it half right would change what people can see. This does something
 * safer: it keeps the canonical agency, records the duplicate's name as an
 * alias, and deactivates the duplicate. Solicitation data is never touched, and
 * the alias makes both spellings resolve to one agency.
 *
 *   node server/scripts/merge_duplicate_agencies.js              # dry run
 *   node server/scripts/merge_duplicate_agencies.js --apply
 *   node server/scripts/merge_duplicate_agencies.js --database X
 *
 * The canonical row is the lowest id, matching how the spreadsheet import picks
 * between duplicates, so the two agree on which record wins.
 */

const { canonicalKey } = require('./reconcile_agency_spreadsheet')

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

  // Only active agencies are candidates. A previously merged duplicate is
  // already deactivated, and including it would make a second run report work
  // that no longer needs doing.
  const agencies = (await pool.query(
    'SELECT id, agency, active FROM "Agencies" WHERE active IS NOT false ORDER BY id')).rows

  const groups = new Map()
  for (const a of agencies) {
    const k = canonicalKey(a.agency)
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k).push(a)
  }
  const dupes = [...groups.values()].filter(v => v.length > 1)

  console.log(`Database: ${cfg.database}`)
  console.log(`Agencies: ${agencies.length}  |  duplicate groups: ${dupes.length}\n`)

  if (!dupes.length) { await pool.end(); return }

  // Anything attached to a losing row has to move before it is deactivated.
  const plan = []
  for (const group of dupes) {
    const [keep, ...drop] = group          // lowest id wins
    for (const d of drop) {
      const [users, domains, scopeA, scopeB, kids, deviation, sols, aliases] = await Promise.all([
        pool.query('SELECT count(*)::int c FROM "Users" WHERE "agencyId" = $1', [d.id]),
        pool.query('SELECT count(*)::int c FROM agency_domains WHERE "agencyId" = $1', [d.id]),
        pool.query('SELECT count(*)::int c FROM agency_solicitation_scope WHERE "agencyId" = $1', [d.id]),
        pool.query('SELECT count(*)::int c FROM agency_solicitation_scope WHERE "visibleAgencyId" = $1', [d.id]),
        pool.query('SELECT count(*)::int c FROM "Agencies" WHERE "parentId" = $1', [d.id]),
        pool.query('SELECT count(*)::int c FROM "Agencies" WHERE "deviationSourceId" = $1', [d.id]),
        pool.query('SELECT count(*)::int c FROM solicitations WHERE agency = $1 OR office = $1', [d.agency])
          .catch(() => ({ rows: [{ c: null }] })),
        pool.query('SELECT count(*)::int c FROM agency_alias WHERE agency_id = $1', [d.id])
      ])
      plan.push({
        keepId: keep.id, keepName: keep.agency,
        dropId: d.id, dropName: d.agency,
        users: users.rows[0].c, domains: domains.rows[0].c,
        scopeOwned: scopeA.rows[0].c, scopeVisible: scopeB.rows[0].c,
        children: kids.rows[0].c, deviationRefs: deviation.rows[0].c,
        solicitations: sols.rows[0].c, aliases: aliases.rows[0].c
      })
    }
  }

  const touched = plan.filter(p =>
    p.users || p.domains || p.scopeOwned || p.scopeVisible || p.children || p.deviationRefs || p.aliases)

  console.log(`Duplicate rows to fold in: ${plan.length}`)
  console.log(`  with data attached that must move first: ${touched.length}`)
  console.log(`  inert (nothing references them):          ${plan.length - touched.length}\n`)

  const withSols = plan.filter(p => p.solicitations > 0)
  if (withSols.length) {
    console.log('Duplicates whose NAME appears on solicitations (this is what the alias fixes):')
    for (const p of withSols.slice(0, 12)) {
      console.log(`  ${String(p.solicitations).padStart(6)}  ${p.dropName}  ->  ${p.keepName}`)
    }
    if (withSols.length > 12) console.log(`  ... and ${withSols.length - 12} more`)
    console.log()
  }

  if (touched.length) {
    console.log('Duplicates with attached records:')
    for (const p of touched) {
      const bits = []
      if (p.users) bits.push(`${p.users} users`)
      if (p.domains) bits.push(`${p.domains} domains`)
      if (p.scopeOwned || p.scopeVisible) bits.push(`${p.scopeOwned + p.scopeVisible} scope rows`)
      if (p.children) bits.push(`${p.children} child agencies`)
      if (p.deviationRefs) bits.push(`${p.deviationRefs} deviation refs`)
      if (p.aliases) bits.push(`${p.aliases} existing aliases`)
      console.log(`  ${p.dropName} -> ${p.keepName}   (${bits.join(', ')})`)
    }
    console.log()
  }

  if (!args.apply) {
    console.log('Dry run. Nothing was changed. Pass --apply to perform the merge.')
    await pool.end()
    return
  }

  const client = await pool.connect()
  const done = { aliases: 0, users: 0, domains: 0, scope: 0, children: 0, deviation: 0, deactivated: 0 }
  try {
    await client.query('BEGIN')
    for (const p of plan) {
      // The losing name becomes an alias of the winner, which is what makes its
      // solicitations visible without touching solicitation data.
      const exists = await client.query(
        'SELECT 1 FROM agency_alias WHERE agency_id = $1 AND alias = $2', [p.keepId, p.dropName])
      if (!exists.rows.length) {
        await client.query(
          'INSERT INTO agency_alias (agency_id, alias, "createdAt", "updatedAt") VALUES ($1, $2, NOW(), NOW())',
          [p.keepId, p.dropName])
        done.aliases++
      }
      // Any alias already pointing at the loser now points at the winner.
      await client.query('UPDATE agency_alias SET agency_id = $1 WHERE agency_id = $2', [p.keepId, p.dropId])

      // Serial, not Promise.all: a single pg client cannot run concurrent
      // queries, and doing so silently interleaves them inside the transaction.
      const movedUsers = await client.query('UPDATE "Users" SET "agencyId" = $1 WHERE "agencyId" = $2', [p.keepId, p.dropId])
      const movedDomains = await client.query('UPDATE agency_domains SET "agencyId" = $1 WHERE "agencyId" = $2', [p.keepId, p.dropId])
      const movedKids = await client.query('UPDATE "Agencies" SET "parentId" = $1 WHERE "parentId" = $2', [p.keepId, p.dropId])
      const movedDev = await client.query('UPDATE "Agencies" SET "deviationSourceId" = $1 WHERE "deviationSourceId" = $2', [p.keepId, p.dropId])
      done.users += movedUsers.rowCount
      done.domains += movedDomains.rowCount
      done.children += movedKids.rowCount
      done.deviation += movedDev.rowCount

      // Scope rows carry a uniqueness constraint on (agencyId, visibleAgencyId),
      // and the winner usually already holds the pair the loser is about to
      // become. Colliding rows are removed BEFORE repointing, because doing it
      // afterwards trips the constraint mid-update rather than at the end.
      const dropOwned = await client.query(
        `DELETE FROM agency_solicitation_scope a
          WHERE a."agencyId" = $2
            AND EXISTS (SELECT 1 FROM agency_solicitation_scope b
                         WHERE b."agencyId" = $1 AND b."visibleAgencyId" = a."visibleAgencyId")`,
        [p.keepId, p.dropId])
      await client.query('UPDATE agency_solicitation_scope SET "agencyId" = $1 WHERE "agencyId" = $2', [p.keepId, p.dropId])

      const dropVisible = await client.query(
        `DELETE FROM agency_solicitation_scope a
          WHERE a."visibleAgencyId" = $2
            AND EXISTS (SELECT 1 FROM agency_solicitation_scope b
                         WHERE b."visibleAgencyId" = $1 AND b."agencyId" = a."agencyId")`,
        [p.keepId, p.dropId])
      await client.query('UPDATE agency_solicitation_scope SET "visibleAgencyId" = $1 WHERE "visibleAgencyId" = $2', [p.keepId, p.dropId])

      done.scope += dropOwned.rowCount + dropVisible.rowCount

      // Deactivated, not deleted. The row keeps its id, so anything that stored
      // it historically still resolves.
      await client.query('UPDATE "Agencies" SET active = false, "updatedAt" = NOW() WHERE id = $1', [p.dropId])
      done.deactivated++
    }
    await client.query('COMMIT')
  } catch (e) {
    await client.query('ROLLBACK')
    console.error('\nRolled back, nothing was changed.')
    console.error(e.message)
    client.release(); await pool.end(); process.exit(1)
  }
  client.release()

  console.log('Merge applied.')
  console.log(`  aliases recorded:        ${done.aliases}`)
  console.log(`  users repointed:         ${done.users}`)
  console.log(`  domains repointed:       ${done.domains}`)
  console.log(`  child agencies moved:    ${done.children}`)
  console.log(`  deviation refs moved:    ${done.deviation}`)
  console.log(`  duplicate scope rows removed: ${done.scope}`)
  console.log(`  duplicate agencies deactivated: ${done.deactivated}`)
  await pool.end()
}

if (require.main === module) main().catch(e => { console.error(e); process.exit(1) })
