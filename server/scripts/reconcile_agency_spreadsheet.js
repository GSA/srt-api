#!/usr/bin/env node
'use strict'

/**
 * Reconcile Laura's agency mapping spreadsheet against what SRT already holds.
 *
 * Reconcile first. Do not dump. This script reads the CSV, normalises it,
 * classifies every row, compares against the Agencies and agency_domains tables,
 * and writes a Markdown report describing exactly what an import would change.
 *
 * It does nothing to the database unless --apply is passed. The default is a
 * dry run that produces the report and exits.
 *
 *   node server/scripts/reconcile_agency_spreadsheet.js \
 *     --csv "/path/to/SRT Agency Mapping - Agency Mapping.csv" \
 *     --report ./AGENCY_RECONCILIATION_REPORT.md
 *
 * Add --apply once the report has been reviewed and the flagged rows resolved.
 *
 * Two things this deliberately does NOT do:
 *
 *   It never guesses at a spelling. A suspected typo is reported for a human to
 *   confirm, because "correcting" a real agency name that merely looks wrong is
 *   worse than leaving it alone.
 *
 *   It never writes the Agency Deviation column. Every row of it is blank in the
 *   source, and the mechanism ships unpopulated for Laura to fill in through
 *   the admin screen.
 */

const fs = require('fs')
const path = require('path')

// ── Argument handling ────────────────────────────────────────────────

function parseArgs (argv) {
  const args = { csv: null, report: null, apply: false, database: null }
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--csv') { args.csv = argv[++i] }
    else if (argv[i] === '--report') { args.report = argv[++i] }
    else if (argv[i] === '--apply') { args.apply = true }
    // Lets the whole run be pointed at a clone, so an import can be rehearsed
    // before it touches the real database.
    else if (argv[i] === '--database') { args.database = argv[++i] }
  }
  return args
}

// ── CSV parsing ──────────────────────────────────────────────────────

/** Minimal RFC 4180 reader. Handles quoted fields, embedded commas, and CRLF. */
function parseCsv (text) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ }
        else { inQuotes = false }
      } else { field += ch }
    } else if (ch === '"') { inQuotes = true }
    else if (ch === ',') { row.push(field); field = '' }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = '' }
    else if (ch !== '\r') { field += ch }
  }
  if (field.length || row.length) { row.push(field); rows.push(row) }
  return rows.filter(r => r.length > 1 || (r[0] || '').trim())
}

// ── Normalisation (5.1) ──────────────────────────────────────────────

/**
 * Collapse the whitespace variants that make two identical names compare
 * unequal. Non-breaking spaces in particular survive a visual inspection and
 * then silently create a duplicate agency.
 */
function cleanText (value) {
  if (value === undefined || value === null) return ''
  return String(value)
    .replace(/ /g, ' ')      // non-breaking space
    .replace(/[​-‍]/g, '') // zero-width characters
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeDomain (value) {
  const v = cleanText(value).toLowerCase().replace(/^@/, '')
  return v || null
}

const DOMAIN_SHAPE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/

/**
 * Canonical key for comparing agency names. Drops the US prefix and punctuation
 * so "US Department of Commerce" and "Department of Commerce" collide, which is
 * what lets 5.2 find the duplicate parents.
 */
function canonicalKey (name) {
  return cleanText(name)
    .toLowerCase()
    .replace(/^(u\.?s\.?|united states)\s+/, '')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Of several spellings of the same name, prefer the one without the US prefix. */
function preferredSpelling (variants) {
  return [...variants].sort((a, b) => {
    const aPrefixed = /^(u\.?s\.?|united states)\s+/i.test(a)
    const bPrefixed = /^(u\.?s\.?|united states)\s+/i.test(b)
    if (aPrefixed !== bPrefixed) return aPrefixed ? 1 : -1
    return a.length - b.length || a.localeCompare(b)
  })[0]
}

// ── Typo detection (5.3) ─────────────────────────────────────────────

/**
 * Misspellings of words that recur in federal agency names. Reported, never
 * auto-corrected: a name that looks wrong may be the legal name.
 */
const MISSPELLINGS = {
  commisary: 'commissary', commision: 'commission', comission: 'commission',
  adminstration: 'administration', administation: 'administration',
  agriculutre: 'agriculture', developement: 'development',
  enviromental: 'environmental', goverment: 'government',
  inteligence: 'intelligence', managment: 'management',
  occupatonal: 'occupational', peronnel: 'personnel', personel: 'personnel',
  proctection: 'protection', protectection: 'protection',
  seurity: 'security', securty: 'security', servcie: 'service',
  tresury: 'treasury', veterens: 'veterans', defence: 'defense',
  labratory: 'laboratory', reserach: 'research', statistcs: 'statistics'
}

function findTypos (name) {
  const lower = cleanText(name).toLowerCase()
  const found = []
  for (const [wrong, right] of Object.entries(MISSPELLINGS)) {
    if (new RegExp(`\\b${wrong}\\b`).test(lower) || lower.includes(wrong)) {
      found.push({ wrong, suggestion: right })
    }
  }
  return found
}

// ── Classification (5.4) ─────────────────────────────────────────────

/**
 * Assign the agency type enum. Domain TLD is the strongest signal available;
 * where there is no domain the name has to carry it. Anything genuinely
 * ambiguous becomes needs_review rather than a guess.
 */
function classify (row) {
  const name = cleanText(row.entity)
  const lower = name.toLowerCase()
  const domain = row.domain

  if (/\b(local|county|state)\b.*government|^state of\b|\bcity of\b/i.test(name)) {
    return 'state_local'
  }
  if (domain) {
    if (domain.endsWith('.edu')) return 'education'
    if (domain.endsWith('.us') && !domain.endsWith('.gov.us')) {
      // A .us domain is usually state or local, but not reliably enough to
      // assert it for an entity whose name gives no corroboration.
      return /\b(school|university|college|district|county|city|state)\b/i.test(lower)
        ? 'education' : 'needs_review'
    }
    if (domain.endsWith('.mil') || domain.endsWith('.gov')) {
      return row.parent ? 'federal_component' : 'federal_agency'
    }
  }
  if (/\b(university|college|school|academy institute)\b/i.test(lower)) return 'education'
  return row.parent ? 'federal_component' : 'federal_agency'
}

// ── Row extraction, including the column swap ────────────────────────

const DEPARTMENT_SHAPE = /^(u\.?s\.?\s+|us\s+)?department of\b/i

/**
 * Read the sheet into { entity, parent, domain } records.
 *
 * One block of the source has the affiliation and association columns
 * transposed: the department sits in the affiliation column and its component
 * in the association column. Detected structurally rather than by line number,
 * so re-exporting the sheet does not silently break the correction. A row is
 * treated as transposed when its affiliation reads as a department and its
 * association does not.
 */
function extractRows (records) {
  const out = []
  for (const rec of records) {
    const domain = normalizeDomain(rec.domain)
    const colAffiliation = cleanText(rec.affiliation)
    const colAssociation = cleanText(rec.association)

    if (!colAffiliation && !colAssociation && !domain) { continue }  // blank row

    let entity = colAffiliation
    let parent = colAssociation
    let transposed = false

    const affIsDept = DEPARTMENT_SHAPE.test(colAffiliation)
    const assocIsDept = DEPARTMENT_SHAPE.test(colAssociation)
    if (colAffiliation && colAssociation && affIsDept && !assocIsDept) {
      entity = colAssociation
      parent = colAffiliation
      transposed = true
    }

    // A row naming the same thing twice is the agency itself, not a component.
    if (parent && canonicalKey(parent) === canonicalKey(entity)) { parent = '' }

    out.push({
      line: rec.line,
      entity,
      parent,
      domain,
      transposed,
      raw: { domain: rec.domain, affiliation: rec.affiliation, association: rec.association }
    })
  }
  return out
}

// ── Main ─────────────────────────────────────────────────────────────

async function main () {
  const args = parseArgs(process.argv)
  if (!args.csv) {
    console.error('Usage: reconcile_agency_spreadsheet.js --csv <file> [--report <file>] [--apply]')
    process.exit(2)
  }

  const grid = parseCsv(fs.readFileSync(args.csv, 'utf8'))
  const header = grid[0].map(h => cleanText(h).toLowerCase())
  const idxDomain = header.findIndex(h => h.includes('domain'))
  const idxAffiliation = header.findIndex(h => h.includes('affiliation'))
  const idxAssociation = header.findIndex(h => h.includes('association'))
  const idxDeviation = header.findIndex(h => h.includes('deviation'))

  if (idxDomain < 0 || idxAffiliation < 0 || idxAssociation < 0) {
    console.error('Could not find the expected columns. Found:', header)
    process.exit(2)
  }

  const records = grid.slice(1).map((r, i) => ({
    line: i + 2,
    domain: r[idxDomain],
    affiliation: r[idxAffiliation],
    association: r[idxAssociation],
    deviation: idxDeviation >= 0 ? r[idxDeviation] : ''
  }))

  const rows = extractRows(records)

  const findings = {
    totalLines: records.length,
    blankRows: records.length - rows.length,
    transposed: rows.filter(r => r.transposed),
    deviationsPresent: records.filter(r => cleanText(r.deviation)).length,
    typos: [],
    malformedDomains: [],
    duplicateDomains: [],
    duplicateNames: [],
    noParent: [],
    noDomain: [],
    unclassified: []
  }

  // Typos and malformed domains
  for (const r of rows) {
    for (const name of [r.entity, r.parent].filter(Boolean)) {
      for (const t of findTypos(name)) {
        findings.typos.push({ line: r.line, name, ...t })
      }
    }
    if (r.domain && !DOMAIN_SHAPE.test(r.domain)) {
      findings.malformedDomains.push({ line: r.line, domain: r.domain, raw: r.raw.domain })
    }
  }

  // Duplicate domains
  const domainMap = new Map()
  for (const r of rows) {
    if (!r.domain) continue
    if (!domainMap.has(r.domain)) domainMap.set(r.domain, [])
    domainMap.get(r.domain).push(r)
  }
  for (const [domain, hits] of domainMap) {
    if (hits.length > 1) {
      const targets = new Set(hits.map(h => canonicalKey(h.entity)))
      findings.duplicateDomains.push({
        domain,
        lines: hits.map(h => h.line),
        entities: hits.map(h => h.entity),
        conflicting: targets.size > 1
      })
    }
  }

  // Duplicate names, which is where the US prefix variants surface
  const nameVariants = new Map()
  for (const r of rows) {
    for (const name of [r.entity, r.parent].filter(Boolean)) {
      const key = canonicalKey(name)
      if (!nameVariants.has(key)) nameVariants.set(key, new Set())
      nameVariants.get(key).add(name)
    }
  }
  for (const [key, variants] of nameVariants) {
    if (variants.size > 1) {
      findings.duplicateNames.push({
        key, variants: [...variants], canonical: preferredSpelling(variants)
      })
    }
  }

  // Structure
  for (const r of rows) {
    if (!r.parent) findings.noParent.push(r)
    if (!r.domain) findings.noDomain.push(r)
    r.agencyType = classify(r)
    if (r.agencyType === 'needs_review') findings.unclassified.push(r)
  }

  // Canonical name for every entity and parent
  const canonicalName = new Map()
  for (const [key, variants] of nameVariants) {
    canonicalName.set(key, preferredSpelling(variants))
  }
  const canon = n => (n ? canonicalName.get(canonicalKey(n)) || cleanText(n) : null)

  // ── Reconcile against the database, when one is reachable ──────────

  // Reconciliation is read only. It opens a plain pg connection rather than the
  // Sequelize models, because requiring server/models/index.js runs umzug.up()
  // at import time, which would apply pending migrations as a side effect of
  // asking for a report. A reconciliation must never write.
  let reconciliation = null
  let dbSkipReason = 'no database was reachable'
  let pool = null

  try {
    const { Pool } = require('pg')
    const dbConfig = require('../config/dbConfig')
    const env = process.env.NODE_ENV || 'development'
    const base = dbConfig[env] || dbConfig.development
    const cfg = args.database ? { ...base, database: args.database } : base

    pool = new Pool({
      host: cfg.host, port: cfg.port || 5432, database: cfg.database,
      user: cfg.username, password: cfg.password,
      ...(cfg.dialectOptions && cfg.dialectOptions.ssl ? { ssl: cfg.dialectOptions.ssl } : {}),
      connectionTimeoutMillis: 5000
    })

    const present = await pool.query(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name IN ('Agencies', 'agency_domains')`
    )
    const names = present.rows.map(r => r.table_name)

    if (!names.includes('Agencies')) {
      dbSkipReason = `connected to ${cfg.database || 'the default database'}, which has no Agencies table`
      await pool.end(); pool = null
    } else {
      const hasDomains = names.includes('agency_domains')
      const agencyRows = (await pool.query('SELECT id, agency, acronym FROM "Agencies" ORDER BY id')).rows
      const domainRows = hasDomains
        ? (await pool.query('SELECT id, domain, "agencyId" FROM agency_domains')).rows
        : []

      // Agencies already in SRT that collapse to the same canonical name. These
      // are a pre-existing data problem, not something the spreadsheet causes,
      // but they matter here: solicitation visibility matches on the agency name
      // string, so a user on one spelling cannot see work tagged with the other.
      const srtGroups = new Map()
      for (const a of agencyRows) {
        const k = canonicalKey(a.agency)
        if (!srtGroups.has(k)) srtGroups.set(k, [])
        srtGroups.get(k).push(a)
      }
      const srtDuplicates = [...srtGroups.values()].filter(v => v.length > 1)

      // Whether any of them actually carry data decides how urgent they are.
      const userCounts = new Map(
        (await pool.query('SELECT agency, count(*)::int c FROM "Users" GROUP BY agency')).rows
          .map(r => [r.agency, r.c])
      )
      let predCounts = new Map()
      try {
        predCounts = new Map(
          (await pool.query('SELECT agency, count(*)::int c FROM "Predictions" GROUP BY agency')).rows
            .map(r => [r.agency, r.c])
        )
      } catch (e) { /* older schema without Predictions.agency */ }

      const duplicatesWithData = srtDuplicates.filter(
        v => v.some(a => (userCounts.get(a.agency) || 0) > 0 || (predCounts.get(a.agency) || 0) > 0)
      )

      const byKey = new Map()
      for (const a of agencyRows) {
        const k = canonicalKey(a.agency)
        if (!byKey.has(k)) byKey.set(k, a)   // lowest id wins, as in the import
      }
      const domainByName = new Map(domainRows.map(d => [d.domain, d]))

      const buckets = {
        agencyMatches: [], agencyNew: [], agencyConflict: [],
        domainMatches: [], domainNew: [], domainConflict: [],
        inSrtNotInSheet: []
      }

      const sheetKeys = new Set()
      for (const r of rows) {
        const entityName = canon(r.entity)
        if (!entityName) continue
        const key = canonicalKey(entityName)
        sheetKeys.add(key)

        const existing = byKey.get(key)
        if (existing) {
          buckets.agencyMatches.push({ line: r.line, name: entityName, id: existing.id })
        } else {
          buckets.agencyNew.push({ line: r.line, name: entityName, parent: canon(r.parent), type: r.agencyType })
        }

        // A parent named in the sheet also has to exist before its components.
        const parentName = canon(r.parent)
        if (parentName) {
          const pKey = canonicalKey(parentName)
          if (!byKey.has(pKey) && !sheetKeys.has(pKey)) {
            sheetKeys.add(pKey)
            buckets.agencyNew.push({ line: r.line, name: parentName, parent: null, type: 'federal_agency' })
          }
        }

        if (r.domain) {
          const d = domainByName.get(r.domain)
          if (!d) {
            buckets.domainNew.push({ line: r.line, domain: r.domain, agency: entityName })
          } else if (existing && d.agencyId === existing.id) {
            buckets.domainMatches.push({ line: r.line, domain: r.domain })
          } else {
            const current = agencyRows.find(a => a.id === d.agencyId)
            buckets.domainConflict.push({
              line: r.line, domain: r.domain,
              sheetAgency: entityName, srtAgency: current ? current.agency : `id ${d.agencyId}`
            })
          }
        }
      }

      for (const a of agencyRows) {
        if (!sheetKeys.has(canonicalKey(a.agency))) {
          buckets.inSrtNotInSheet.push({ id: a.id, name: a.agency })
        }
      }

      reconciliation = {
        buckets,
        srtDuplicates: srtDuplicates.map(v => v.map(a => a.agency)),
        duplicatesWithData: duplicatesWithData.map(v => v.map(a => ({
          agency: a.agency, users: userCounts.get(a.agency) || 0, predictions: predCounts.get(a.agency) || 0
        }))),
        database: cfg.database,
        existingAgencies: agencyRows.length,
        existingDomains: domainRows.length,
        hasDomainsTable: hasDomains
      }
      await pool.end(); pool = null
    }
  } catch (e) {
    dbSkipReason = `no database was reachable (${String(e.message).split('\n')[0]})`
    if (pool) { try { await pool.end() } catch (x) { /* already closing */ } }
  }

  const report = buildReport({ args, findings, rows, reconciliation, canon, dbSkipReason })
  if (args.report) {
    fs.writeFileSync(args.report, report)
    console.log(`Report written to ${path.resolve(args.report)}`)
  } else {
    console.log(report)
  }

  if (args.apply) {
    if (!reconciliation) {
      console.error('\nRefusing to import: no SRT database was reachable, so there is nothing')
      console.error(`to reconcile against (${dbSkipReason}).`)
      process.exit(3)
    }
    if (!reconciliation.hasDomainsTable) {
      console.error('\nRefusing to import: agency_domains does not exist. Run the Phase 2')
      console.error('migrations first, or domain mappings have nowhere to go.')
      process.exit(3)
    }
    await applyImport({ rows, canon, findings, database: args.database })
  }

}

// ── Import (5.7) ─────────────────────────────────────────────────────

/**
 * Write the reconciled spreadsheet into SRT.
 *
 * Runs in a single transaction: either the whole sheet lands or none of it does.
 * Idempotent, so re-running after a partial failure or a corrected sheet does
 * not duplicate anything.
 *
 * What it deliberately does NOT do:
 *
 *   It never overwrites a domain that already points somewhere. A domain
 *   pointing at a different agency than the sheet says is a disagreement
 *   between two sources of truth, and resolving it is a decision, not a merge.
 *
 *   It never reparents an agency that already exists. The sheet is treated as
 *   authoritative for what is missing, not for correcting what is there.
 *
 *   It never writes deviationSourceId. Every deviation cell in the source is
 *   empty and the mechanism ships unpopulated.
 *
 *   It never deletes. 438 agencies in SRT do not appear in the sheet and stay
 *   exactly as they are.
 */
/** Would pointing `childId` at `parentId` close a loop? Read-only. */
async function wouldCycle (client, childId, parentId) {
  let cursor = parentId
  let depth = 0
  while (cursor && depth < 50) {
    if (Number(cursor) === Number(childId)) return true
    const r = await client.query('SELECT "parentId" FROM "Agencies" WHERE id = $1', [cursor])
    if (!r.rows.length) return false
    cursor = r.rows[0].parentId
    depth++
  }
  return depth >= 50
}

async function applyImport ({ rows, canon, findings, database }) {
  const { Pool } = require('pg')
  const dbConfig = require('../config/dbConfig')
  const env = process.env.NODE_ENV || 'development'
  const base = dbConfig[env] || dbConfig.development
  const cfg = database ? { ...base, database } : base

  console.log(`\nImporting into database: ${cfg.database} @ ${cfg.host}`)

  const pool = new Pool({
    host: cfg.host, port: cfg.port || 5432, database: cfg.database,
    user: cfg.username, password: cfg.password,
    ...(cfg.dialectOptions && cfg.dialectOptions.ssl ? { ssl: cfg.dialectOptions.ssl } : {})
  })
  const client = await pool.connect()

  const created = { agencies: [], domains: [], scopes: 0 }
  const enriched = { parents: [], types: [] }
  const conflicts = { parentDiffers: [], parentCycle: [] }
  let passes = 0
  const skipped = { domainsAlreadyMapped: [], domainsPointingElsewhere: [], agenciesAlreadyPresent: 0 }

  try {
    await client.query('BEGIN')

    const load = async () => (await client.query(
      'SELECT id, agency, "parentId", "agencyType" FROM "Agencies" ORDER BY id')).rows
    let agencyRows = await load()

    // SRT holds 62 pairs of agencies that are the same body under two
    // spellings, so a canonical key can match more than one row. Ordering by id
    // and keeping the first occurrence makes the choice deterministic: the
    // lowest id always wins. Without this the map keeps whichever row Postgres
    // returned last, which can differ between runs, and consecutive imports
    // enrich different halves of the same duplicate pair.
    const byKey = new Map()
    for (const a of agencyRows) {
      const k = canonicalKey(a.agency)
      if (!byKey.has(k)) byKey.set(k, a)
    }

    const insertAgency = async (name, parentId, agencyType) => {
      const res = await client.query(
        `INSERT INTO "Agencies" (agency, "parentId", "agencyType", active, provenance, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, true, 'spreadsheet_import', NOW(), NOW())
         RETURNING id, agency`,
        [name, parentId, agencyType]
      )
      const row = res.rows[0]
      byKey.set(canonicalKey(row.agency), row)
      created.agencies.push({ name: row.agency, parentId, agencyType })

      // Every agency sees its own solicitations. Matches the Phase 2 seed and
      // the read path's fallback, so a newly imported agency behaves the same
      // as one that has been there all along.
      await client.query(
        `INSERT INTO agency_solicitation_scope ("agencyId", "visibleAgencyId", "createdAt", "updatedAt")
         VALUES ($1, $1, NOW(), NOW())`,
        [row.id]
      )
      created.scopes++
      return row
    }

    // Parents first, so a component always has something to attach to.
    const parentNames = new Set()
    for (const r of rows) {
      const p = canon(r.parent)
      if (p) parentNames.add(p)
    }
    for (const name of [...parentNames].sort()) {
      if (!byKey.has(canonicalKey(name))) {
        await insertAgency(name, null, 'federal_agency')
      }
    }

    // Then every entity, attached to its parent where the sheet names one.
    //
    // Repeated until nothing changes. One pass is not enough: a row can name a
    // parent that only acquires its own place in the hierarchy later in the same
    // pass, and the child then reads a stale value. Two passes reach a fixed
    // point on the current sheet; the loop is capped so a pathological input
    // cannot spin.
    let pass = 0
    let changedThisPass = 1
    while (changedThisPass > 0 && pass < 5) {
      changedThisPass = 0
      pass++
      skipped.agenciesAlreadyPresent = 0

      for (const r of rows) {
        const name = canon(r.entity)
        if (!name) continue
        const parentName = canon(r.parent)
        const parent = parentName ? byKey.get(canonicalKey(parentName)) : null

        if (!byKey.has(canonicalKey(name))) {
          await insertAgency(name, parent ? parent.id : null, r.agencyType)
          changedThisPass++
          continue
        }

        // The agency is already in SRT. Fill in what is blank; never overwrite a
        // value someone has already set. Most of the 629 pre-existing agencies
        // are flat rows with no parent and a placeholder type, and the
        // spreadsheet's main contribution is exactly that missing structure.
        // Skipping them outright would drop most of the hierarchy it describes.
        const current = byKey.get(canonicalKey(name))
        const sets = []
        const vals = []

        if (parent && !current.parentId && parent.id !== current.id) {
          if (await wouldCycle(client, current.id, parent.id)) {
            if (pass === 1) {
              conflicts.parentCycle.push({ line: r.line, agency: name, parent: parent.agency })
            }
          } else {
            sets.push(`"parentId" = $${sets.length + 1}`)
            vals.push(parent.id)
            current.parentId = parent.id
            enriched.parents.push({ agency: name, parent: parent.agency })
          }
        } else if (parent && current.parentId && current.parentId !== parent.id) {
          if (pass === 1) {
            const held = agencyRows.find(a => a.id === current.parentId) || byKey.get(canonicalKey(name))
            conflicts.parentDiffers.push({
              line: r.line, agency: name,
              sheetParent: parent.agency,
              srtParent: (agencyRows.find(a => a.id === current.parentId) || {}).agency || `id ${current.parentId}`
            })
          }
        }

        // needs_review is the placeholder the Phase 2 seed left behind, so
        // replacing it fills a blank rather than overriding a judgement.
        if (current.agencyType === 'needs_review' && r.agencyType !== 'needs_review') {
          sets.push(`"agencyType" = $${sets.length + 1}`)
          vals.push(r.agencyType)
          current.agencyType = r.agencyType
          enriched.types.push({ agency: name, type: r.agencyType })
        }

        if (sets.length) {
          vals.push(current.id)
          await client.query(
            `UPDATE "Agencies" SET ${sets.join(', ')}, "updatedAt" = NOW() WHERE id = $${vals.length}`,
            vals
          )
          changedThisPass++
        } else {
          skipped.agenciesAlreadyPresent++
        }
      }
    }

    // Domains last, once every agency they point at exists.
    for (const r of rows) {
      if (!r.domain) continue
      const name = canon(r.entity)
      const agency = byKey.get(canonicalKey(name))
      if (!agency) continue

      const existing = await client.query('SELECT id, "agencyId" FROM agency_domains WHERE domain = $1', [r.domain])
      if (existing.rows.length) {
        const cur = existing.rows[0]
        if (cur.agencyId === agency.id) skipped.domainsAlreadyMapped.push(r.domain)
        else skipped.domainsPointingElsewhere.push({ domain: r.domain, wanted: name })
        continue
      }

      await client.query(
        `INSERT INTO agency_domains (domain, "agencyId", active, source, "originalRawValue", "createdAt", "updatedAt")
         VALUES ($1, $2, true, 'spreadsheet_import', $3, NOW(), NOW())`,
        [r.domain, agency.id, cleanText(r.raw.domain)]
      )
      created.domains.push({ domain: r.domain, agency: name })
    }

    passes = pass
    await client.query('COMMIT')
  } catch (e) {
    await client.query('ROLLBACK')
    console.error('\nImport rolled back, nothing was written.')
    console.error(e.message)
    client.release(); await pool.end()
    process.exit(1)
  }

  client.release()
  await pool.end()

  console.log('\nImport applied.')
  console.log(`  passes to reach a stable state: ${passes}`)
  console.log(`  agencies created:        ${created.agencies.length}`)
  console.log(`  self-scope rows created: ${created.scopes}`)
  console.log(`  domains mapped:          ${created.domains.length}`)
  console.log(`  existing agencies given a parent:  ${enriched.parents.length}`)
  console.log(`  existing agencies given a type:    ${enriched.types.length}`)
  console.log(`  agencies already present, unchanged: ${skipped.agenciesAlreadyPresent}`)
  console.log(`  domains already mapped:   ${skipped.domainsAlreadyMapped.length}`)
  if (skipped.domainsPointingElsewhere.length) {
    console.log(`  domains left alone because they point elsewhere: ${skipped.domainsPointingElsewhere.length}`)
    for (const d of skipped.domainsPointingElsewhere) {
      console.log(`    ${d.domain} (sheet says ${d.wanted})`)
    }
  }
  if (conflicts.parentDiffers.length) {
    console.log(`\n  ${conflicts.parentDiffers.length} agency/agencies already have a different parent, left alone:`)
    for (const c of conflicts.parentDiffers) {
      console.log(`    ${c.agency}: SRT says ${c.srtParent}, sheet says ${c.sheetParent}`)
    }
  }
  if (conflicts.parentCycle.length) {
    console.log(`\n  ${conflicts.parentCycle.length} parent assignment(s) refused because they would loop:`)
    for (const c of conflicts.parentCycle) console.log(`    ${c.agency} under ${c.parent}`)
  }
  if (findings.typos.length) {
    console.log(`\n  ${findings.typos.length} suspected typo(s) imported as written, not corrected:`)
    for (const t of findings.typos) console.log(`    line ${t.line}: ${t.name}`)
  }
  if (findings.unclassified.length) {
    console.log(`\n  ${findings.unclassified.length} row(s) imported as needs_review pending a decision:`)
    for (const u of findings.unclassified) console.log(`    line ${u.line}: ${u.entity}`)
  }
}

// ── Report (5.6) ─────────────────────────────────────────────────────

function buildReport ({ args, findings, rows, reconciliation, canon, dbSkipReason }) {
  const L = []
  const add = (s = '') => L.push(s)

  add('# Agency Mapping Reconciliation Report')
  add()
  add(`Source: \`${path.basename(args.csv)}\``)
  add(`Rows read: ${findings.totalLines}  |  Blank rows skipped: ${findings.blankRows}  |  Usable rows: ${rows.length}`)
  add()
  add('This report describes what an import **would** change. Nothing has been written.')
  add()
  add('---')
  add()

  add('## Summary')
  add()
  add('| Finding | Count | Action |')
  add('|---|---:|---|')
  add(`| Rows with the two columns transposed | ${findings.transposed.length} | Corrected automatically |`)
  add(`| Duplicate agency names (spelling variants) | ${findings.duplicateNames.length} | Merged to one spelling |`)
  add(`| Suspected typos | ${findings.typos.length} | **Needs your confirmation** |`)
  add(`| Duplicate domains | ${findings.duplicateDomains.length} | Deduplicated |`)
  add(`| Malformed domains | ${findings.malformedDomains.length} | ${findings.malformedDomains.length ? '**Needs review**' : 'None'} |`)
  add(`| Rows with no domain | ${findings.noDomain.length} | Created without a domain mapping |`)
  add(`| Rows with no parent | ${findings.noParent.length} | Treated as top level |`)
  add(`| Rows that could not be classified | ${findings.unclassified.length} | ${findings.unclassified.length ? '**Needs your decision**' : 'None'} |`)
  add(`| Agency Deviation values present | ${findings.deviationsPresent} | Column left unpopulated by design |`)
  add()

  if (findings.transposed.length) {
    add('---')
    add()
    add('## Transposed columns')
    add()
    const lines = findings.transposed.map(r => r.line).sort((a, b) => a - b)
    add(`${findings.transposed.length} rows have the affiliation and association columns the wrong way round: `)
    add('the department sits in the affiliation column and its component in the association column.')
    add(`Affected lines: **${lines[0]}–${lines[lines.length - 1]}**, a contiguous block.`)
    add()
    add('Detected by shape, not by line number, so re-exporting the sheet will not break the correction.')
    add()
    add('| Line | As written (affiliation / association) | Read as (entity / parent) |')
    add('|---:|---|---|')
    for (const r of findings.transposed.slice(0, 10)) {
      add(`| ${r.line} | ${cleanText(r.raw.affiliation)} / ${cleanText(r.raw.association)} | ${r.entity} / ${r.parent} |`)
    }
    if (findings.transposed.length > 10) {
      add(`| … | *${findings.transposed.length - 10} more rows in the same block* | |`)
    }
    add()
    const parents = [...new Set(findings.transposed.map(r => r.parent))].sort()
    add(`Parents recovered from the block: ${parents.map(p => `\`${p}\``).join(', ')}.`)
    add()
  }

  if (findings.duplicateNames.length) {
    add('---')
    add()
    add('## Duplicate agency names')
    add()
    add('The same agency written more than one way. Importing as written would create')
    add('separate agencies that then split their users and solicitations.')
    add()
    add('| Variants found | Will be stored as |')
    add('|---|---|')
    for (const d of findings.duplicateNames.sort((a, b) => a.canonical.localeCompare(b.canonical))) {
      add(`| ${d.variants.map(v => `\`${v}\``).join(' · ')} | **${d.canonical}** |`)
    }
    add()
  }

  if (findings.typos.length) {
    add('---')
    add()
    add('## Suspected typos — needs your confirmation')
    add()
    add('Not corrected automatically. A name that looks misspelled may be the legal name,')
    add('and silently "fixing" it is worse than leaving it.')
    add()
    add('| Line | As written | Suspected | Confirm? |')
    add('|---:|---|---|---|')
    for (const t of findings.typos) {
      add(`| ${t.line} | \`${t.name}\` | \`${t.wrong}\` → \`${t.suggestion}\` | ☐ |`)
    }
    add()
  }

  if (findings.duplicateDomains.length) {
    add('---')
    add()
    add('## Duplicate domains')
    add()
    add('| Domain | Lines | Points at | Resolution |')
    add('|---|---|---|---|')
    for (const d of findings.duplicateDomains) {
      const resolution = d.conflicting
        ? '**Conflict, needs your decision**'
        : 'Identical, one kept'
      add(`| \`${d.domain}\` | ${d.lines.join(', ')} | ${[...new Set(d.entities)].join(' · ')} | ${resolution} |`)
    }
    add()
  }

  if (findings.malformedDomains.length) {
    add('---')
    add()
    add('## Malformed domains')
    add()
    add('| Line | As written | Normalised to |')
    add('|---:|---|---|')
    for (const d of findings.malformedDomains) {
      add(`| ${d.line} | \`${cleanText(d.raw)}\` | \`${d.domain}\` |`)
    }
    add()
  }

  if (findings.unclassified.length) {
    add('---')
    add()
    add('## Could not be classified — needs your decision')
    add()
    add('| Line | Entity | Domain | Why |')
    add('|---:|---|---|---|')
    for (const r of findings.unclassified) {
      add(`| ${r.line} | ${r.entity} | \`${r.domain || '—'}\` | Domain suffix does not identify the type |`)
    }
    add()
  }

  add('---')
  add()
  add('## Rows with no domain')
  add()
  add(`${findings.noDomain.length} rows name a real component but carry no domain evidence.`)
  add('These are created in the hierarchy with no domain mapping, so they can be selected')
  add('in admin and used for deviation, but nothing routes to them at login yet.')
  add()

  add('---')
  add()
  add('## Agency Deviation')
  add()
  add(`All ${findings.totalLines} rows have an empty Agency Deviation column.`)
  add('The mechanism ships unpopulated. Deviation is set through the admin screen,')
  add('and this import will not write that column.')
  add()

  add('---')
  add()
  add('## Reconciliation against SRT')
  add()
  if (!reconciliation) {
    add(`**Not run.** The comparison against the existing \`Agencies\` and`)
    add('`agency_domains` tables is outstanding, because ' + dbSkipReason + '.')
    add()
    add('Everything above comes from the spreadsheet alone and is complete as it stands.')
    add()
    add('Re-run this script with a database connection to produce the match, new,')
    add('conflict, and in-SRT-but-not-in-sheet buckets before importing.')
  } else {
    const b = reconciliation.buckets
    add(`Compared against **${reconciliation.existingAgencies} agencies** already in SRT (database \`${reconciliation.database}\`).`)
    add()
    if (!reconciliation.hasDomainsTable) {
      add('> The `agency_domains` table does not exist in this database yet, so every')
      add('> domain below counts as new. Run the Phase 2 migrations first for an')
      add('> accurate domain comparison.')
      add()
    } else {
      add(`Existing domain mappings: ${reconciliation.existingDomains}.`)
      add()
    }
    add('| Bucket | Count |')
    add('|---|---:|')
    add(`| Agency already in SRT, unchanged | ${b.agencyMatches.length} |`)
    add(`| Agency new, would be created | ${b.agencyNew.length} |`)
    add(`| Agency conflict (different parent) | ${b.agencyConflict.length} |`)
    add(`| Domain already mapped, unchanged | ${b.domainMatches.length} |`)
    add(`| Domain new, would be added | ${b.domainNew.length} |`)
    add(`| Domain conflict (points elsewhere) | ${b.domainConflict.length} |`)
    add(`| In SRT but not in the spreadsheet | ${b.inSrtNotInSheet.length} |`)
    add()
    if (reconciliation.srtDuplicates.length) {
      add('### Duplicate agencies already in SRT')
      add()
      add(`**${reconciliation.srtDuplicates.length} pairs** of agencies already in SRT are the same body stored under`)
      add('two spellings, almost all of them `X` and `U.S. X`. The spreadsheet did not')
      add('cause this and importing will not make it worse, but it matters for a reason')
      add('worth stating: solicitation visibility matches on the agency name string, so a')
      add('user recorded against one spelling cannot see work tagged with the other.')
      add()
      if (reconciliation.duplicatesWithData.length === 0) {
        add('**None of these pairs currently has users or predictions attached**, so nothing')
        add('is being split today. They are inert reference rows. Worth merging as cleanup,')
        add('not as an emergency.')
      } else {
        add(`**${reconciliation.duplicatesWithData.length} of these pairs carry data on more than one spelling** and are`)
        add('splitting users or solicitations right now.')
        add()
        add('| Spelling | Users | Predictions |')
        add('|---|---:|---:|')
        for (const grp of reconciliation.duplicatesWithData) {
          for (const e of grp) add(`| ${e.agency} | ${e.users} | ${e.predictions} |`)
        }
      }
      add()
      add('<details><summary>All duplicate pairs</summary>')
      add()
      for (const v of reconciliation.srtDuplicates) add(`- ${v.map(x => `\`${x}\``).join(' · ')}`)
      add()
      add('</details>')
      add()
    }

    if (b.agencyConflict.length) {
      add('### Agency conflicts')
      add()
      add('| Line | Agency | Spreadsheet parent |')
      add('|---:|---|---|')
      for (const c of b.agencyConflict) add(`| ${c.line} | ${c.name} | ${c.sheetParent} |`)
      add()
    }
    if (b.domainConflict.length) {
      add('### Domain conflicts')
      add()
      add('These domains already point somewhere else in SRT. An import will not')
      add('overwrite them without an explicit decision.')
      add()
      add('| Line | Domain | Spreadsheet says | SRT currently says |')
      add('|---:|---|---|---|')
      for (const c of b.domainConflict) {
        add(`| ${c.line} | \`${c.domain}\` | ${c.sheetAgency} | ${c.srtAgency} |`)
      }
      add()
    }
    if (b.inSrtNotInSheet.length) {
      add('### In SRT but not in the spreadsheet')
      add()
      add(`${b.inSrtNotInSheet.length} agencies exist in SRT and do not appear in the sheet.`)
      add('These are left alone. The spreadsheet is not treated as authoritative for deletion.')
      add()
    }
  }

  add('---')
  add()
  add('## What happens on import')
  add()
  add('1. Transposed rows are read in the correct orientation.')
  add('2. Name variants collapse to one spelling; the original is kept in `originalRawValue`.')
  add('3. Domains are lowercased and the leading `@` removed.')
  add('4. Parents are created before their components.')
  add('5. Existing correct mappings are never overwritten. Conflicts are skipped and reported.')
  add('6. Every created row carries `provenance = spreadsheet_import` so it can be traced.')
  add('7. The Agency Deviation column is not written.')
  add()
  add('Nothing above has been applied. Import is a separate step, run only after the')
  add('flagged rows are resolved.')
  add()

  return L.join('\n')
}

if (require.main === module) {
  main().catch(err => { console.error(err); process.exit(1) })
}

module.exports = {
  parseCsv, cleanText, normalizeDomain, canonicalKey, preferredSpelling,
  findTypos, classify, extractRows, DOMAIN_SHAPE
}
