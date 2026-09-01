'use strict'

/**
 * Resolves the two agency relationships that Phase 2 deliberately separated:
 *
 *   solicitationScopeFor(user)  what solicitations the user may see
 *   deviationSourceFor(user)    whose agency deviation applies to the user
 *
 * They are computed from different tables and must never be derived from each
 * other. Changing a deviation must not widen visibility, and changing
 * visibility must not change which deviation applies.
 *
 * Both fall back to today's behaviour when the new data is absent, so this is
 * safe to deploy before the hierarchy is populated: a user with no agencyId, or
 * an agency with no scope rows, sees exactly what they saw before.
 */

const logger = require('../config/winston')

/**
 * Agency NAMES whose solicitations this user may see.
 *
 * Names rather than ids because solicitations store agency and office as
 * strings, not foreign keys. Phase 2 gave every agency a self-scope row, so
 * with seeded data this returns [user.agency] and the query is unchanged.
 *
 * @param {Object} user            user record, needs agency and optionally agencyId
 * @param {Object} models          sequelize models
 * @returns {Promise<string[]>}    agency names, never empty
 */
async function solicitationScopeFor (user, models) {
  const fallback = user && user.agency ? [user.agency] : []

  try {
    if (!user || !user.agencyId || !models || !models.AgencySolicitationScope) {
      return fallback
    }

    const rows = await models.AgencySolicitationScope.findAll({
      where: { agencyId: user.agencyId }
    })
    if (!rows.length) return fallback

    const ids = rows.map(r => r.visibleAgencyId)
    const agencies = await models.Agency.findAll({ where: { id: ids } })

    // Only agencies that are active and actually named contribute.
    const names = agencies
      .filter(a => a && a.agency && a.active !== false)
      .map(a => a.agency)

    if (!names.length) return fallback

    // Always include the user's own agency string. The scope table is keyed on
    // ids while solicitations are matched by name, and a rename would otherwise
    // silently remove a user's access to their own agency's work.
    if (user.agency && !names.includes(user.agency)) names.push(user.agency)

    // Alternate spellings of the same body. Solicitations arrive from SAM.gov
    // with the agency written however the posting office wrote it, so an agency
    // whose work is tagged "DEPT OF THE NAVY" is invisible to a user recorded
    // as "Department of the Navy" unless the two are known to be the same.
    //
    // This only widens visibility where an alias row exists, so an agency with
    // no aliases behaves exactly as before.
    if (models.AgencyAlias) {
      try {
        const aliases = await models.AgencyAlias.findAll({ where: { agency_id: ids } })
        for (const a of aliases) {
          if (a.alias && !names.includes(a.alias)) names.push(a.alias)
        }
      } catch (e) {
        // An alias lookup failure narrows visibility rather than failing the
        // request, which matches how the rest of this function degrades.
        logger.log('error', 'agency alias lookup failed, continuing without aliases', {
          error: e.message, userId: user.id, tag: 'agency_scope'
        })
      }
    }

    return names
  } catch (e) {
    // Visibility must never fail open or throw. Fall back to prior behaviour.
    logger.log('error', 'solicitationScopeFor failed, falling back to exact agency match', {
      error: e.message, userId: user && user.id, tag: 'agency_scope'
    })
    return fallback
  }
}

/**
 * The agency whose deviation applies to this user.
 *
 * An explicit deviationSourceId wins. Otherwise inheritance walks up the
 * parent chain, so a Navy user with no Navy-specific deviation inherits DOD.
 * Depth-capped: a cycle created through admin must not hang a request.
 *
 * @returns {Promise<Object|null>} the Agency whose deviation applies, or null
 */
async function deviationSourceFor (user, models) {
  try {
    if (!user || !user.agencyId || !models || !models.Agency) return null

    let current = await models.Agency.findByPk(user.agencyId)
    let depth = 0

    while (current && depth < 10) {
      if (current.deviationSourceId) {
        return models.Agency.findByPk(current.deviationSourceId)
      }
      if (!current.parentId) return current   // top of the chain owns its deviation
      current = await models.Agency.findByPk(current.parentId)
      depth++
    }

    if (depth >= 10) {
      logger.log('error', 'deviation inheritance exceeded depth limit, possible cycle', {
        userId: user.id, agencyId: user.agencyId, tag: 'agency_scope'
      })
    }
    return null
  } catch (e) {
    logger.log('error', 'deviationSourceFor failed', {
      error: e.message, userId: user && user.id, tag: 'agency_scope'
    })
    return null
  }
}

module.exports = { solicitationScopeFor, deviationSourceFor }
