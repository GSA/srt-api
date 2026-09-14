/**
 * Hide agency rows inherited from the pre-2019 configuration that nothing
 * points at: no users, no solicitations (by name OR any alias), no mapped
 * domain, no children, not referenced by anyone's scope or deviation.
 *
 * Hiding sets active=false. Rows are never deleted and can be restored by
 * flipping the flag back. Dry run by default; pass --apply to commit.
 */
const { Client } = require('pg')
const cfg = require('../config/dbConfig')[process.env.NODE_ENV || 'development']
const APPLY = process.argv.includes('--apply')

function visSnapshot (agencies, scope, aliases, solCount) {
  const byId = new Map(agencies.map(a => [a.id, a]))
  const scopeBy = new Map(); const aliasBy = new Map()
  for (const s of scope) { if (!scopeBy.has(s.agencyId)) scopeBy.set(s.agencyId, []); scopeBy.get(s.agencyId).push(s.visibleAgencyId) }
  for (const a of aliases) { if (!aliasBy.has(a.agency_id)) aliasBy.set(a.agency_id, []); aliasBy.get(a.agency_id).push(a.alias) }
  const snap = new Map()
  for (const a of agencies) {
    if (a.active === false) continue
    const names = new Set()
    for (const id of (scopeBy.get(a.id) || [a.id])) {
      const t = byId.get(id); if (!t) continue
      names.add(t.agency); for (const al of (aliasBy.get(id) || [])) names.add(al)
    }
    let n = 0; for (const nm of names) n += (solCount.get(nm) || 0)
    snap.set(a.id, n)
  }
  return snap
}

;(async () => {
  const c = new Client({ host: cfg.host, port: cfg.port, user: cfg.username, password: cfg.password, database: cfg.database, ...(cfg.dialectOptions && cfg.dialectOptions.ssl ? { ssl: cfg.dialectOptions.ssl } : {}) })
  await c.connect(); const q = (s, p) => c.query(s, p).then(r => r.rows)
  await q('BEGIN')

  // One pass over solicitations; every name/alias counted from the same map.
  const solRows = await q(`select agency nm, count(*)::int n from solicitations where agency is not null group by 1
                           union all select office nm, count(*)::int n from solicitations where office is not null group by 1`)
  const solCount = new Map()
  for (const r of solRows) solCount.set(r.nm, (solCount.get(r.nm) || 0) + r.n)

  const agencies = await q('select id, agency, active, "parentId", "agencyType", "deviationSourceId" from "Agencies"')
  const scope = await q('select "agencyId", "visibleAgencyId" from agency_solicitation_scope')
  const aliases = await q('select agency_id, alias from agency_alias')
  const before = visSnapshot(agencies, scope, aliases, solCount)

  const aliasBy = new Map()
  for (const a of aliases) { if (!aliasBy.has(a.agency_id)) aliasBy.set(a.agency_id, []); aliasBy.get(a.agency_id).push(a.alias) }
  const userCount = new Map((await q('select "agencyId" id, count(*)::int n from "Users" where "agencyId" is not null group by 1')).map(r => [r.id, r.n]))
  const domCount = new Map((await q('select "agencyId" id, count(*)::int n from agency_domains where active is distinct from false group by 1')).map(r => [r.id, r.n]))
  const childOf = new Set(agencies.filter(a => a.parentId).map(a => a.parentId))
  const scopeTargets = new Set(scope.filter(s => s.agencyId !== s.visibleAgencyId).map(s => s.visibleAgencyId))
  const scopeSources = new Set(scope.filter(s => s.agencyId !== s.visibleAgencyId).map(s => s.agencyId))
  const devTargets = new Set(agencies.filter(a => a.deviationSourceId).map(a => a.deviationSourceId))

  const candidates = [], kept = []
  for (const a of agencies) {
    if (a.active === false || a.agencyType !== 'needs_review') continue
    const names = [a.agency, ...(aliasBy.get(a.id) || [])]
    const sols = names.reduce((t, nm) => t + (solCount.get(nm) || 0), 0)
    const why = []
    if (userCount.get(a.id)) why.push(`${userCount.get(a.id)} users`)
    if (sols) why.push(`${sols} solicitations`)
    if (domCount.get(a.id)) why.push(`${domCount.get(a.id)} domains`)
    if (childOf.has(a.id)) why.push('has components')
    if (scopeTargets.has(a.id)) why.push('visible to another agency')
    if (scopeSources.has(a.id)) why.push('has a cross-agency scope')
    if (devTargets.has(a.id)) why.push('is a deviation source')
    if (why.length) kept.push([a, why]); else candidates.push(a)
  }

  console.log(`needs_review + active rows examined: ${candidates.length + kept.length}`)
  console.log(`  KEEP (something points at them): ${kept.length}`)
  for (const [a, why] of kept.sort((x, y) => x[0].agency.localeCompare(y[0].agency)))
    console.log(`      ${a.agency.padEnd(52)} ${why.join(', ')}`)
  console.log(`\n  HIDE (nothing points at them): ${candidates.length}`)
  console.log('      first 15: ' + candidates.slice(0, 15).map(a => a.agency).join(' | '))

  if (candidates.length) {
    await q(`update "Agencies" set active=false, "updatedAt"=now() where id = any($1)`, [candidates.map(a => a.id)])
  }
  const after = visSnapshot(await q('select id, agency, active, "parentId", "agencyType", "deviationSourceId" from "Agencies"'), scope, aliases, solCount)

  let lost = 0
  for (const [id, n] of before) { const m = after.get(id); if (m === undefined && n > 0) { lost++; console.log(`  LOSS: agency ${id} vanished while showing ${n} rows`) } else if (m !== undefined && m < n) { lost++; console.log(`  LOSS: agency ${id} ${n} -> ${m}`) } }
  console.log(lost ? `\nVisibility check FAILED (${lost}). Rolling back.` : '\nVisibility check: no agency can see fewer solicitation rows than before.')

  const orphan = (await q(`select count(*)::int n from "Agencies" a where a."parentId" is not null and not exists (select 1 from "Agencies" p where p.id=a."parentId" and p.active is distinct from false)`))[0].n
  const usersDead = (await q(`select count(*)::int n from "Users" u where u."agencyId" is not null and not exists (select 1 from "Agencies" a where a.id=u."agencyId" and a.active is distinct from false)`))[0].n
  console.log(`agencies whose parent would be hidden: ${orphan}`)
  console.log(`users left pointing at a hidden agency: ${usersDead}`)

  if (APPLY && !lost && !orphan && !usersDead) { await q('COMMIT'); console.log(`\nApplied. ${candidates.length} rows hidden (active=false, recoverable).`) }
  else { await q('ROLLBACK'); console.log(APPLY ? '\nRefused to commit — a check failed above.' : '\nDry run. Nothing changed. Pass --apply to perform.') }
  await c.end()
})().catch(e => { console.error(e); process.exit(1) })
