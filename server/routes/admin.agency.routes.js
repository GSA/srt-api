/** @module AdminAgencyRoutes */

/**
 * Admin management of the agency hierarchy, email domain mappings, solicitation
 * access scope, and deviation inheritance.
 *
 * This replaces the two hardcoded config maps that previously drove agency
 * resolution (AGENCY_LOOKUP and UNIQUE_EMAIL_AGENCY_MAPPING). Everything these
 * routes manage used to require a code change and a deploy.
 *
 * The one invariant worth stating plainly, because the whole design turns on it:
 * solicitation access and deviation inheritance are separate relationships and
 * are edited through separate endpoints. Setting one never moves the other.
 * Access lives in agency_solicitation_scope. Deviation lives in
 * Agencies.deviationSourceId with fallback up parentId.
 */

const db = require('../models/index')
const Agency = require('../models').Agency
const AgencyDomain = require('../models').AgencyDomain
const AgencySolicitationScope = require('../models').AgencySolicitationScope
const AgencyAlias = require('../models').AgencyAlias
const User = require('../models').User
const logger = require('../config/winston')
const jwt = require('jsonwebtoken')

const AGENCY_TYPES = [
  'federal_agency', 'federal_component', 'state_local',
  'education', 'other', 'needs_review'
]

/** Types that may exist at the top of the hierarchy with no parent. */
const TOP_LEVEL_TYPES = ['federal_agency', 'state_local', 'education', 'other']

function getAdminEmail (req) {
  try {
    return jwt.decode(req.headers['authorization'].split(' ')[1]).user.email
  } catch (e) {
    return 'unknown'
  }
}

/**
 * Walk a self-referencing column upward and report whether pointing `startId` at
 * `targetId` would close a loop.
 *
 * Phase 3 capped the read path at depth 10 so a cycle could not hang a request.
 * That cap is a backstop, not a licence to create cycles: this is the check that
 * stops one being written in the first place, and it returns a validation error
 * the admin can act on rather than failing silently at read time.
 */
async function wouldCreateCycle (startId, targetId, column) {
  if (!targetId) return false
  if (Number(startId) === Number(targetId)) return true

  let cursor = targetId
  let depth = 0
  while (cursor && depth < 50) {
    const node = await Agency.findByPk(cursor)
    if (!node) return false
    const next = node[column]
    if (Number(next) === Number(startId)) return true
    cursor = next
    depth++
  }
  // A pre-existing cycle upstream. Refuse the edit rather than extend it.
  return depth >= 50
}

module.exports = function (pgPool) {

  async function auditLog (req, action, targetType, targetId, details) {
    const adminEmail = getAdminEmail(req)
    try {
      await pgPool.query(
        `INSERT INTO admin_audit_log (admin_email, action, target_type, target_id, details, ip_address)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [adminEmail, action, targetType, String(targetId), JSON.stringify(details || {}), req.ip]
      )
    } catch (err) {
      logger.log('error', 'Failed to write agency audit log', { error: err.message, tag: 'admin-agency' })
    }
  }

  return {

    /**
     * GET /api/admin/agency-management
     *
     * The full picture in one call: every agency with its parent, type, domains,
     * user count, solicitation access scope, and resolved deviation source.
     *
     * Access and deviation are returned as separate fields on purpose (4.9), so
     * the UI can show side by side that a component inheriting DOD's deviation
     * does not thereby see DOD's solicitations.
     */
    listAgencyManagement: async function (req, res) {
      try {
        const [agencies, domains, scopes, aliases] = await Promise.all([
          Agency.findAll({ order: [['agency', 'ASC']] }),
          AgencyDomain.findAll(),
          AgencySolicitationScope.findAll(),
          // Alternate spellings. A merged duplicate lives on as an alias, so
          // without these the admin screen cannot explain why an agency
          // disappeared or which names it now answers to.
          AgencyAlias.findAll().catch(() => [])
        ])

        const byId = new Map(agencies.map(a => [a.id, a]))

        // User counts still key on the agency name string, because Users.agency
        // is the column the rest of the application reads. Users.agencyId is
        // populated alongside it and will become authoritative once every user
        // is backfilled.
        const userRows = await pgPool.query(`
          SELECT agency, COUNT(*) FILTER (WHERE "isAccepted" = true AND "isRejected" = false) AS active_users,
                 COUNT(*) AS total_users
          FROM "Users" GROUP BY agency
        `)
        const counts = new Map(userRows.rows.map(r => [r.agency, r]))

        const domainsByAgency = new Map()
        for (const d of domains) {
          if (!domainsByAgency.has(d.agencyId)) domainsByAgency.set(d.agencyId, [])
          domainsByAgency.get(d.agencyId).push({
            id: d.id, domain: d.domain, active: d.active,
            source: d.source, originalRawValue: d.originalRawValue
          })
        }

        const aliasesByAgency = new Map()
        for (const a of aliases) {
          if (!aliasesByAgency.has(a.agency_id)) aliasesByAgency.set(a.agency_id, [])
          aliasesByAgency.get(a.agency_id).push({ id: a.id, alias: a.alias })
        }

        const scopeByAgency = new Map()
        for (const s of scopes) {
          if (!scopeByAgency.has(s.agencyId)) scopeByAgency.set(s.agencyId, [])
          scopeByAgency.get(s.agencyId).push(s.visibleAgencyId)
        }

        const rows = []
        for (const a of agencies) {
          const parent = a.parentId ? byId.get(a.parentId) : null
          const deviationId = await Agency.resolveDeviationSource(a.id)
          const deviationAgency = deviationId ? byId.get(deviationId) : null
          const c = counts.get(a.agency) || {}

          // Absent scope rows mean "sees only itself", which is what the read
          // path falls back to. Report that explicitly so the UI never has to
          // infer it.
          const visibleIds = scopeByAgency.get(a.id) || [a.id]

          rows.push({
            id: a.id,
            agency: a.agency,
            acronym: a.acronym,
            agencyType: a.agencyType,
            active: a.active,
            provenance: a.provenance,
            parent: parent ? { id: parent.id, agency: parent.agency } : null,
            domains: domainsByAgency.get(a.id) || [],
            aliases: aliasesByAgency.get(a.id) || [],
            activeUsers: Number(c.active_users || 0),
            totalUsers: Number(c.total_users || 0),
            solicitationAccess: visibleIds.map(id => ({
              id, agency: byId.get(id) ? byId.get(id).agency : null
            })),
            solicitationAccessIsDefault: !scopeByAgency.has(a.id),
            deviationSource: deviationAgency
              ? { id: deviationAgency.id, agency: deviationAgency.agency }
              : null,
            deviationIsInherited: !a.deviationSourceId
          })
        }

        logger.log('info', 'Admin listed agency management view', {
          tag: 'admin-agency', admin: getAdminEmail(req), count: rows.length
        })
        return res.status(200).json({ agencies: rows, agencyTypes: AGENCY_TYPES })
      } catch (err) {
        logger.log('error', 'Failed to build agency management view', {
          error: err.message, tag: 'admin-agency'
        })
        return res.status(500).json({ error: 'Failed to load agency management data' })
      }
    },

    /**
     * POST /api/admin/agencies
     *
     * Creating a top-level agency is a deliberate administrative act. Anything
     * arriving without a parent has to be an explicitly chosen top-level type;
     * a component must name its parent. This is the admin-side half of the
     * guardrail that stops login traffic minting permanent agencies.
     */
    createAgency: async function (req, res) {
      try {
        const { agency, acronym, agencyType, parentId } = req.body

        if (!agency || !String(agency).trim()) {
          return res.status(400).json({ error: 'Agency name is required' })
        }
        if (!AGENCY_TYPES.includes(agencyType)) {
          return res.status(400).json({ error: `agencyType must be one of: ${AGENCY_TYPES.join(', ')}` })
        }
        if (!parentId && !TOP_LEVEL_TYPES.includes(agencyType)) {
          return res.status(400).json({
            error: `A ${agencyType} must have a parent. Only ${TOP_LEVEL_TYPES.join(', ')} may be top level.`
          })
        }
        if (parentId && !(await Agency.findByPk(parentId))) {
          return res.status(400).json({ error: 'Parent agency not found' })
        }

        const existing = await Agency.findOne({ where: { agency: String(agency).trim() } })
        if (existing) {
          return res.status(409).json({
            error: 'An agency with that name already exists', existingId: existing.id
          })
        }

        const created = await Agency.create({
          agency: String(agency).trim(),
          acronym: acronym ? String(acronym).trim() : null,
          agencyType,
          parentId: parentId || null,
          active: true,
          provenance: 'admin_created'
        })

        // Default scope: sees its own solicitations. Matches the seeded default
        // and the read-path fallback, so a new agency behaves predictably.
        await AgencySolicitationScope.create({ agencyId: created.id, visibleAgencyId: created.id })

        await auditLog(req, 'agency_create', 'agency', created.id, {
          agency: created.agency, agencyType, parentId: parentId || null
        })
        return res.status(201).json({ agency: created })
      } catch (err) {
        logger.log('error', 'Failed to create agency', { error: err.message, tag: 'admin-agency' })
        return res.status(500).json({ error: 'Failed to create agency' })
      }
    },

    /**
     * PUT /api/admin/agencies/:id
     *
     * Edit, deactivate, or reassign to a different parent (4.4, 4.5).
     * Deactivation is preferred over deletion for anything with users attached;
     * there is no delete endpoint for agencies at all.
     */
    updateAgency: async function (req, res) {
      try {
        const target = await Agency.findByPk(req.params.id)
        if (!target) return res.status(404).json({ error: 'Agency not found' })

        const { agency, acronym, agencyType, parentId, active } = req.body
        const before = {
          agency: target.agency, acronym: target.acronym, agencyType: target.agencyType,
          parentId: target.parentId, active: target.active
        }

        if (agencyType !== undefined && !AGENCY_TYPES.includes(agencyType)) {
          return res.status(400).json({ error: `agencyType must be one of: ${AGENCY_TYPES.join(', ')}` })
        }

        if (parentId !== undefined && parentId !== target.parentId) {
          if (parentId) {
            if (!(await Agency.findByPk(parentId))) {
              return res.status(400).json({ error: 'Parent agency not found' })
            }
            if (await wouldCreateCycle(target.id, parentId, 'parentId')) {
              return res.status(400).json({
                error: 'That parent would create a loop in the hierarchy'
              })
            }
          } else {
            const effectiveType = agencyType || target.agencyType
            if (!TOP_LEVEL_TYPES.includes(effectiveType)) {
              return res.status(400).json({
                error: `A ${effectiveType} cannot be top level. Set a parent, or change its type first.`
              })
            }
          }
          target.parentId = parentId || null
        }

        if (agency !== undefined) target.agency = String(agency).trim()
        if (acronym !== undefined) target.acronym = acronym ? String(acronym).trim() : null
        if (agencyType !== undefined) target.agencyType = agencyType

        if (active === false && target.active !== false) {
          const attached = await User.count({ where: { agency: target.agency } })
          logger.log('info', 'Agency deactivated', {
            tag: 'admin-agency', agency: target.agency, attachedUsers: attached
          })
        }
        if (active !== undefined) target.active = active

        await target.save()
        await auditLog(req, 'agency_update', 'agency', target.id, { before, after: req.body })
        return res.status(200).json({ agency: target })
      } catch (err) {
        logger.log('error', 'Failed to update agency', { error: err.message, tag: 'admin-agency' })
        return res.status(500).json({ error: 'Failed to update agency' })
      }
    },

    /**
     * PUT /api/admin/agencies/:id/scope
     *
     * Replace which agencies' solicitations this agency's users may see (4.7).
     * Multi-select, because access legitimately spans more than one entity.
     *
     * This endpoint touches agency_solicitation_scope only. It does not read or
     * write parentId or deviationSourceId.
     */
    setSolicitationScope: async function (req, res) {
      const t = await db.sequelize.transaction()
      try {
        const target = await Agency.findByPk(req.params.id, { transaction: t })
        if (!target) { await t.rollback(); return res.status(404).json({ error: 'Agency not found' }) }

        const { visibleAgencyIds } = req.body
        if (!Array.isArray(visibleAgencyIds)) {
          await t.rollback()
          return res.status(400).json({ error: 'visibleAgencyIds must be an array' })
        }

        const ids = [...new Set(visibleAgencyIds.map(Number).filter(Boolean))]
        // An agency always retains sight of its own solicitations. Removing that
        // is never a legitimate edit and would strip a user's own queue.
        if (!ids.includes(target.id)) ids.push(target.id)

        const found = await Agency.findAll({ where: { id: ids }, transaction: t })
        if (found.length !== ids.length) {
          await t.rollback()
          return res.status(400).json({ error: 'One or more agency ids do not exist' })
        }

        const before = (await AgencySolicitationScope.findAll({
          where: { agencyId: target.id }, transaction: t
        })).map(r => r.visibleAgencyId)

        await AgencySolicitationScope.destroy({ where: { agencyId: target.id }, transaction: t })
        await AgencySolicitationScope.bulkCreate(
          ids.map(visibleAgencyId => ({ agencyId: target.id, visibleAgencyId })),
          { transaction: t }
        )

        await t.commit()
        await auditLog(req, 'agency_scope_update', 'agency', target.id, { before, after: ids })
        return res.status(200).json({ agencyId: target.id, visibleAgencyIds: ids })
      } catch (err) {
        await t.rollback()
        logger.log('error', 'Failed to set solicitation scope', { error: err.message, tag: 'admin-agency' })
        return res.status(500).json({ error: 'Failed to set solicitation scope' })
      }
    },

    /**
     * PUT /api/admin/agencies/:id/deviation
     *
     * Set or clear which agency's deviation applies (4.9). Clearing returns the
     * agency to inheriting from its parent.
     *
     * This endpoint touches deviationSourceId only. It does not read or write
     * agency_solicitation_scope.
     */
    setDeviationSource: async function (req, res) {
      try {
        const target = await Agency.findByPk(req.params.id)
        if (!target) return res.status(404).json({ error: 'Agency not found' })

        const { deviationSourceId } = req.body
        const before = target.deviationSourceId

        if (deviationSourceId) {
          if (!(await Agency.findByPk(deviationSourceId))) {
            return res.status(400).json({ error: 'Deviation source agency not found' })
          }
          if (await wouldCreateCycle(target.id, deviationSourceId, 'deviationSourceId')) {
            return res.status(400).json({ error: 'That deviation source would create a loop' })
          }
        }

        target.deviationSourceId = deviationSourceId || null
        await target.save()

        const resolvedId = await Agency.resolveDeviationSource(target.id)
        const resolved = resolvedId ? await Agency.findByPk(resolvedId) : null

        await auditLog(req, 'agency_deviation_update', 'agency', target.id, {
          before, after: target.deviationSourceId
        })
        return res.status(200).json({
          agencyId: target.id,
          deviationSourceId: target.deviationSourceId,
          resolvedDeviationSource: resolved ? { id: resolved.id, agency: resolved.agency } : null,
          inherited: !target.deviationSourceId
        })
      } catch (err) {
        logger.log('error', 'Failed to set deviation source', { error: err.message, tag: 'admin-agency' })
        return res.status(500).json({ error: 'Failed to set deviation source' })
      }
    },

    /** POST /api/admin/agency-domains — map an email domain to an agency (4.3). */
    createDomain: async function (req, res) {
      try {
        const { domain, agencyId } = req.body
        const normalized = AgencyDomain.normalize(domain)
        if (!normalized) return res.status(400).json({ error: 'A domain is required' })
        if (!(await Agency.findByPk(agencyId))) {
          return res.status(400).json({ error: 'Agency not found' })
        }

        const existing = await AgencyDomain.findOne({ where: { domain: normalized } })
        if (existing) {
          return res.status(409).json({
            error: 'That domain is already mapped', existingId: existing.id, agencyId: existing.agencyId
          })
        }

        const created = await AgencyDomain.create({
          domain: normalized, agencyId, active: true,
          source: 'admin_created', originalRawValue: domain
        })
        await auditLog(req, 'domain_create', 'agency_domain', created.id, { domain: normalized, agencyId })
        return res.status(201).json({ domain: created })
      } catch (err) {
        logger.log('error', 'Failed to create domain mapping', { error: err.message, tag: 'admin-agency' })
        return res.status(500).json({ error: 'Failed to create domain mapping' })
      }
    },

    /**
     * PUT /api/admin/agency-domains/:id
     * Reassign a domain to a different agency or component, or deactivate it (4.6).
     */
    updateDomain: async function (req, res) {
      try {
        const target = await AgencyDomain.findByPk(req.params.id)
        if (!target) return res.status(404).json({ error: 'Domain mapping not found' })

        const { agencyId, active, domain } = req.body
        const before = { domain: target.domain, agencyId: target.agencyId, active: target.active }

        if (agencyId !== undefined) {
          if (!(await Agency.findByPk(agencyId))) {
            return res.status(400).json({ error: 'Agency not found' })
          }
          target.agencyId = agencyId
        }
        if (domain !== undefined) {
          const normalized = AgencyDomain.normalize(domain)
          if (!normalized) return res.status(400).json({ error: 'Invalid domain' })
          const clash = await AgencyDomain.findOne({ where: { domain: normalized } })
          if (clash && clash.id !== target.id) {
            return res.status(409).json({ error: 'That domain is already mapped', existingId: clash.id })
          }
          target.domain = normalized
        }
        if (active !== undefined) target.active = active

        await target.save()
        await auditLog(req, 'domain_update', 'agency_domain', target.id, { before, after: req.body })
        return res.status(200).json({ domain: target })
      } catch (err) {
        logger.log('error', 'Failed to update domain mapping', { error: err.message, tag: 'admin-agency' })
        return res.status(500).json({ error: 'Failed to update domain mapping' })
      }
    },

    /** DELETE /api/admin/agency-domains/:id — remove a mapping outright. */
    deleteDomain: async function (req, res) {
      try {
        const target = await AgencyDomain.findByPk(req.params.id)
        if (!target) return res.status(404).json({ error: 'Domain mapping not found' })
        const snapshot = { domain: target.domain, agencyId: target.agencyId }
        await target.destroy()
        await auditLog(req, 'domain_delete', 'agency_domain', req.params.id, snapshot)
        return res.status(200).json({ deleted: true, ...snapshot })
      } catch (err) {
        logger.log('error', 'Failed to delete domain mapping', { error: err.message, tag: 'admin-agency' })
        return res.status(500).json({ error: 'Failed to delete domain mapping' })
      }
    },

    /**
     * GET /api/admin/needs-review
     *
     * The categorisation queue (4.8). Users whose email domain did not resolve
     * to a known agency at login are parked here with the domain that failed.
     * Grouped by domain, because resolving one domain clears every user on it.
     */
    listNeedsReview: async function (req, res) {
      try {
        const result = await pgPool.query(`
          SELECT "unresolvedDomain" AS domain,
                 COUNT(*)::int AS user_count,
                 MIN("createdAt") AS first_seen,
                 MAX("createdAt") AS last_seen,
                 ARRAY_AGG(email ORDER BY "createdAt") AS emails
          FROM "Users"
          WHERE "unresolvedDomain" IS NOT NULL
          GROUP BY "unresolvedDomain"
          ORDER BY COUNT(*) DESC, MIN("createdAt") ASC
        `)

        logger.log('info', 'Admin listed needs-review queue', {
          tag: 'admin-agency', admin: getAdminEmail(req), domains: result.rows.length
        })
        return res.status(200).json({ pending: result.rows })
      } catch (err) {
        logger.log('error', 'Failed to list needs-review queue', { error: err.message, tag: 'admin-agency' })
        return res.status(500).json({ error: 'Failed to load the needs review queue' })
      }
    },

    /**
     * POST /api/admin/needs-review/resolve
     *
     * Resolve one unresolved domain to an agency (4.8). Creates the domain
     * mapping, then moves every user parked on that domain onto the agency and
     * clears their unresolvedDomain. Laura resolves once and the mapping is
     * reusable from then on.
     *
     * The guardrail (4.10): this will attach a domain to an existing agency, or
     * to a new component under a named parent. It will not create a top-level
     * agency. That remains a separate, deliberate act through createAgency.
     */
    resolveNeedsReview: async function (req, res) {
      const t = await db.sequelize.transaction()
      try {
        const { domain, agencyId, newComponent } = req.body
        const normalized = AgencyDomain.normalize(domain)
        if (!normalized) { await t.rollback(); return res.status(400).json({ error: 'A domain is required' }) }

        let resolvedAgency = null

        if (agencyId) {
          resolvedAgency = await Agency.findByPk(agencyId, { transaction: t })
          if (!resolvedAgency) {
            await t.rollback(); return res.status(400).json({ error: 'Agency not found' })
          }
        } else if (newComponent && newComponent.agency && newComponent.parentId) {
          const parent = await Agency.findByPk(newComponent.parentId, { transaction: t })
          if (!parent) {
            await t.rollback(); return res.status(400).json({ error: 'Parent agency not found' })
          }
          resolvedAgency = await Agency.create({
            agency: String(newComponent.agency).trim(),
            acronym: newComponent.acronym ? String(newComponent.acronym).trim() : null,
            agencyType: newComponent.agencyType || 'federal_component',
            parentId: parent.id,
            active: true,
            provenance: 'needs_review_resolution'
          }, { transaction: t })
          await AgencySolicitationScope.create(
            { agencyId: resolvedAgency.id, visibleAgencyId: resolvedAgency.id }, { transaction: t }
          )
        } else {
          await t.rollback()
          return res.status(400).json({
            error: 'Provide either an existing agencyId, or a newComponent with an agency name and a parentId. ' +
                   'Creating a top-level agency is done separately.'
          })
        }

        const existingDomain = await AgencyDomain.findOne({ where: { domain: normalized }, transaction: t })
        if (existingDomain) {
          existingDomain.agencyId = resolvedAgency.id
          existingDomain.active = true
          await existingDomain.save({ transaction: t })
        } else {
          await AgencyDomain.create({
            domain: normalized, agencyId: resolvedAgency.id, active: true,
            source: 'needs_review_resolution', originalRawValue: domain
          }, { transaction: t })
        }

        // Model.update rather than a raw query, so the affected count is
        // reliable across dialects and agencyId goes through the model.
        const [usersUpdated] = await User.update(
          {
            agency: resolvedAgency.agency,
            agencyId: resolvedAgency.id,
            unresolvedDomain: null
          },
          { where: { unresolvedDomain: normalized }, transaction: t }
        )

        await t.commit()
        await auditLog(req, 'needs_review_resolve', 'agency_domain', normalized, {
          domain: normalized, agencyId: resolvedAgency.id, agency: resolvedAgency.agency,
          createdComponent: !req.body.agencyId
        })

        return res.status(200).json({
          domain: normalized,
          agency: { id: resolvedAgency.id, agency: resolvedAgency.agency },
          usersUpdated
        })
      } catch (err) {
        await t.rollback()
        logger.log('error', 'Failed to resolve needs-review domain', { error: err.message, tag: 'admin-agency' })
        return res.status(500).json({ error: 'Failed to resolve the domain' })
      }
    }
  }
}

module.exports.AGENCY_TYPES = AGENCY_TYPES
module.exports.TOP_LEVEL_TYPES = TOP_LEVEL_TYPES
module.exports.wouldCreateCycle = wouldCreateCycle
