'use strict';

/**
 * Which agencies' solicitations a given agency's users may see.
 *
 * Explicit rather than derived from the hierarchy, because the rules are not
 * uniform. A Navy user sees only Navy solicitations even though Navy sits under
 * DOD, while a CMS user may legitimately be scoped to both CMS and HHS.
 * Deriving scope from parentId cannot express both.
 *
 * This is the counterpart to Agency.deviationSourceId, and the two must stay
 * independent: changing one must never move the other.
 */
module.exports = (sequelize, DataTypes) => {
  const AgencySolicitationScope = sequelize.define('AgencySolicitationScope', {
    agencyId: DataTypes.INTEGER,
    visibleAgencyId: DataTypes.INTEGER
  }, { tableName: 'agency_solicitation_scope' });

  AgencySolicitationScope.associate = function(models) {
    AgencySolicitationScope.belongsTo(models.Agency, { as: 'agency', foreignKey: 'agencyId' })
    AgencySolicitationScope.belongsTo(models.Agency, { as: 'visibleAgency', foreignKey: 'visibleAgencyId' })
  };

  /**
   * Agency ids whose solicitations this agency's users may see. Defaults to the
   * agency itself when no scope rows exist, which preserves today's behaviour
   * (exact agency match) for anything not yet configured.
   */
  AgencySolicitationScope.visibleAgencyIdsFor = async function(agencyId) {
    if (!agencyId) return []
    const rows = await AgencySolicitationScope.findAll({ where: { agencyId } })
    return rows.length ? rows.map(r => r.visibleAgencyId) : [agencyId]
  };

  return AgencySolicitationScope;
};
