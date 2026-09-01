#!/usr/bin/env node
'use strict'

/**
 * Find active users who cannot see anything.
 *
 * A user's visibility is decided by a string match: a solicitation is visible
 * when its agency or office column equals the user's agency. So a user whose
 * agency string matches no solicitation sees an empty tool, regardless of
 * whether that string happens to exist in the Agencies table.
 *
 * Two separate failures produce this, and they need different remedies:
 *
 *   Passthrough artifacts. Before unmapped domains were routed to review, an
 *   unrecognised domain had its first label used as the agency name, so someone
 *   at @treasury.gov became a user of an agency called "treasury". These are not
 *   real names and should never become aliases. The user needs reassigning.
 *
 *   Real but differently worded names. "Department of Defense--Military
 *   Programs" is a real designation that simply is not how solicitations are
 *   tagged. Whether those users should be moved to Department of Defense is a
 *   judgement about who should see what, not something to infer.
 *
 * Strictly read only. It suggests a target where the evidence is clear and
 * says so where it is not.
 *
 *   node server/scripts/find_orphaned_users.js [--report out.md]
 */

const fs = require('fs')
const path = require('path')

function parseArgs (argv) {
  const a = { report: null, database: null, csv: null }
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--report') a.report = argv[++i]
    else if (argv[i] === '--database') a.database = argv[++i]
    // The domain table may not exist in the environment being analysed, in
    // which case the spreadsheet is the only mapping available.
    else if (argv[i] === '--csv') a.csv = argv[++i]
  }
  return a
}

/** Consumer providers, so their users are separated from government ones. */
const PERSONAL = new Set([
  'gmail', 'yahoo', 'hotmail', 'outlook', 'aol', 'icloud', 'me', 'mac',
  'comcast', 'verizon', 'att', 'sbcglobal', 'cox', 'live', 'msn', 'protonmail'
])

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

  const totals = (await pool.query(
    `SELECT count(*)::int AS total,
            count(*) FILTER (WHERE "isAccepted" AND NOT "isRejected")::int AS active
       FROM "Users"`)).rows[0]

  // Every distinct agency string held by an active user, with how many
  // solicitations that string actually reaches.
  const rows = (await pool.query(`
    WITH ua AS (
      SELECT agency, count(*)::int AS users,
             array_agg(DISTINCT split_part(email, '@', 2)) AS domains,
             array_agg(email ORDER BY email) AS emails
        FROM "Users"
       WHERE "isAccepted" AND NOT "isRejected" AND agency IS NOT NULL AND agency <> ''
       GROUP BY agency
    )
    SELECT ua.agency, ua.users, ua.domains, ua.emails,
           (SELECT count(*)::int FROM solicitations s
             WHERE s.agency = ua.agency OR s.office = ua.agency) AS visible,
           EXISTS (SELECT 1 FROM "Agencies" a WHERE a.agency = ua.agency) AS in_agencies
      FROM ua
     ORDER BY ua.users DESC`)).rows

  const orphaned = rows.filter(r => r.visible === 0)

  // Where the domain is already mapped, the correct target is not a guess.
  let domainMap = new Map()
  try {
    const dm = await pool.query(
      `SELECT d.domain, a.agency FROM agency_domains d JOIN "Agencies" a ON a.id = d."agencyId"`)
    domainMap = new Map(dm.rows.map(r => [r.domain, r.agency]))
  } catch (e) { /* table not present yet in this environment */ }

  // Fall back to, or supplement with, the mapping spreadsheet. Without this the
  // report is far less useful against an environment that has not yet had the
  // domain table created, since almost every suggestion comes from a domain.
  if (args.csv) {
    try {
      const { parseCsv, cleanText, normalizeDomain } = require('./reconcile_agency_spreadsheet')
      const grid = parseCsv(fs.readFileSync(args.csv, 'utf8'))
      const header = grid[0].map(h => cleanText(h).toLowerCase())
      const iDom = header.findIndex(h => h.includes('domain'))
      const iAff = header.findIndex(h => h.includes('affiliation'))
      const iAss = header.findIndex(h => h.includes('association'))
      let added = 0
      for (const row of grid.slice(1)) {
        const d = normalizeDomain(row[iDom])
        if (!d || domainMap.has(d)) continue
        // The sheet has a block with these two columns transposed, so prefer
        // whichever value is not a department when both are present.
        const aff = cleanText(row[iAff]); const ass = cleanText(row[iAss])
        const isDept = (v) => /^(u\.?s\.?\s+|us\s+)?department of\b/i.test(v)
        const entity = (aff && ass && isDept(aff) && !isDept(ass)) ? ass : aff
        if (entity) { domainMap.set(d, entity); added++ }
      }
      console.error(`  (loaded ${added} domain mappings from the spreadsheet)`)
    } catch (e) {
      console.error('  (could not read the spreadsheet: ' + e.message + ')')
    }
  }

  // A solicitation-bearing agency reachable from the same domain suffix.
  const withSols = rows.filter(r => r.visible > 0)

  function suggest (r) {
    const domains = (r.domains || []).filter(Boolean)

    if (domains.every(d => PERSONAL.has(String(d).split('.')[0]))) {
      return { kind: 'personal', target: null,
        note: 'Personal address. Not a government user; decline or exempt deliberately.' }
    }

    for (const d of domains) {
      if (domainMap.has(d)) {
        return { kind: 'mapped', target: domainMap.get(d),
          note: 'The email domain is already mapped to this agency.' }
      }
    }

    // Parent domain: someone at bis.doc.gov belongs under whatever doc.gov maps to.
    for (const d of domains) {
      const parts = String(d).split('.')
      for (let i = 1; i < parts.length - 1; i++) {
        const parent = parts.slice(i).join('.')
        if (domainMap.has(parent)) {
          return { kind: 'mapped-parent', target: domainMap.get(parent),
            note: `Parent domain ${parent} is mapped to this agency.` }
        }
      }
    }

    // A domain the sheet lists as a suffix, so bis.doc.gov resolves through
    // doc.gov even when only the parent is listed.
    for (const d of domains) {
      for (const [known, agency] of domainMap) {
        if (String(d).endsWith('.' + known)) {
          return { kind: 'mapped-suffix', target: agency,
            note: `Domain sits under ${known}, which maps to this agency.` }
        }
      }
    }

    // A near match against an agency string that does carry solicitations.
    const key = String(r.agency).toLowerCase().replace(/[^a-z0-9]/g, '')
    const near = withSols.find(w => {
      const k = String(w.agency).toLowerCase().replace(/[^a-z0-9]/g, '')
      return k !== key && (k.startsWith(key) || key.startsWith(k))
    })
    if (near) {
      return { kind: 'near', target: near.agency,
        note: `Name is a variant of an agency that carries ${near.visible.toLocaleString()} solicitations.` }
    }

    return { kind: 'unknown', target: null, note: 'No clear target. Needs a decision.' }
  }

  // One agency string can span several domains that belong to different bodies:
  // 39 users sit on "Department of Defense--Military Programs" across army.mil,
  // dau.mil and dla.mil. A single suggestion for the whole group would move
  // people to the wrong agency, so anything spanning more than one domain is
  // split and suggested per domain.
  const analysed = []
  for (const r of orphaned) {
    const domains = (r.domains || []).filter(Boolean)
    if (domains.length <= 1) {
      analysed.push({ ...r, suggestion: suggest(r), splitDomain: domains[0] || null })
      continue
    }
    const byDomain = new Map()
    for (const e of (r.emails || [])) {
      const d = String(e).split('@').pop().toLowerCase()
      if (!byDomain.has(d)) byDomain.set(d, [])
      byDomain.get(d).push(e)
    }
    for (const [d, emails] of [...byDomain.entries()].sort((a, b) => b[1].length - a[1].length)) {
      const part = { ...r, users: emails.length, emails, domains: [d] }
      analysed.push({ ...part, suggestion: suggest(part), splitDomain: d, splitFrom: r.agency })
    }
  }
  const affected = analysed.reduce((n, r) => n + r.users, 0)

  const L = []
  const add = (s = '') => L.push(s)
  add('# Active users who can see nothing')
  add()
  add(`Database: \`${cfg.database}\``)
  add(`Users: ${totals.total} total, ${totals.active} active`)
  add(`**${affected} active users hold an agency string that matches no solicitation.**`)
  add()
  add('Visibility is a string match: a solicitation is visible when its agency or')
  add('office equals the user\'s agency. A user whose string matches nothing sees an')
  add('empty tool, whether or not that string exists in the Agencies table.')
  add()
  add('Nothing here has been changed. This is a read-only report.')
  add()

  const groups = [
    ['Government users with a clear target', ['mapped', 'mapped-parent', 'mapped-suffix', 'near']],
    ['Government users with no clear target', ['unknown']],
    ['Personal addresses', ['personal']]
  ]

  for (const [title, kinds] of groups) {
    const g = analysed.filter(r => kinds.includes(r.suggestion.kind))
    if (!g.length) continue
    const n = g.reduce((a, r) => a + r.users, 0)
    add('---')
    add()
    add(`## ${title}`)
    add()
    add(`${g.length} agency ${g.length === 1 ? 'string' : 'strings'}, ${n} users.`)
    add()
    add('| Agency string held by user | Users | Domains | In Agencies table | Suggested target | Why |')
    add('|---|---:|---|:---:|---|---|')
    for (const r of g.sort((a, b) => b.users - a.users)) {
      const d = (r.domains || []).filter(Boolean).slice(0, 3).join(', ')
      const label = r.splitFrom ? `\`${r.agency}\`<br><small>via ${d}</small>` : `\`${r.agency}\``
      add(`| ${label} | ${r.users} | ${d} | ${r.in_agencies ? 'yes' : 'no'} | ${r.suggestion.target ? '**' + r.suggestion.target + '**' : '—'} | ${r.suggestion.note} |`)
    }
    add()
  }

  const big = analysed.filter(r => r.users >= 5).sort((a, b) => b.users - a.users)
  if (big.length) {
    add('---')
    add()
    add('## The ones worth deciding first')
    add()
    for (const r of big) {
      add(`**\`${r.agency}\`** — ${r.users} users, currently seeing nothing.`)
      if (r.suggestion.target) {
        const t = withSols.find(w => w.agency === r.suggestion.target)
        add(`Moving them to **${r.suggestion.target}** would give them ${t ? t.visible.toLocaleString() : 'its'} solicitations.`)
      } else {
        add(`No clear target. ${r.suggestion.note}`)
      }
      add()
      add(`<details><summary>${r.users} affected users</summary>`)
      add()
      for (const e of (r.emails || []).slice(0, 60)) add(`- ${e}`)
      add()
      add('</details>')
      add()
    }
  }

  // Where the sheet's name for an agency differs from the widely used one, that
  // is worth a human look before 39 people are moved onto it.
  const odd = analysed.filter(r => {
    if (!r.suggestion.target) return false
    const a = String(r.agency).toLowerCase().replace(/[^a-z0-9]/g, '')
    const b = String(r.suggestion.target).toLowerCase().replace(/[^a-z0-9]/g, '')
    return a !== b && !b.includes(a) && !a.includes(b)
  })
  if (odd.length) {
    add('---')
    add()
    add('## Suggested names worth checking')
    add()
    add('These targets come from the mapping spreadsheet and differ materially from')
    add('the name the user currently holds. Some are simply how the sheet words it.')
    add('Others look like errors in the sheet and are worth correcting there first.')
    add()
    add('| User holds | Sheet suggests | Users |')
    add('|---|---|---:|')
    for (const r of odd.sort((a, b) => b.users - a.users)) {
      add(`| \`${r.agency}\` | ${r.suggestion.target} | ${r.users} |`)
    }
    add()
  }

  add('---')
  add()
  add('## How to fix each kind')
  add()
  add('A passthrough artifact such as `treasury` or `socom` is not a real name and')
  add('should never become an alias. Reassign the user to the correct agency through')
  add('the admin console.')
  add()
  add('A real but differently worded name is a judgement about who should see what.')
  add('Reassigning is still the mechanism, but the decision belongs to the program.')
  add()
  add('An alias is the right tool only when the variant appears on the *solicitation*,')
  add('not on the user. That case is already handled.')
  add()

  const out = L.join('\n')
  if (args.report) {
    fs.writeFileSync(args.report, out)
    console.log(`Report written to ${path.resolve(args.report)}`)
    console.log(`${affected} active users across ${analysed.length} agency strings see nothing.`)
  } else {
    console.log(out)
  }
  await pool.end()
}

if (require.main === module) main().catch(e => { console.error(e); process.exit(1) })
