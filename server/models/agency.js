'use strict';

// sequelize model:generate --force --name Agency --attributes agency:string,acronym:string

module.exports = (sequelize, DataTypes) => {
  const Agency = sequelize.define('Agency', {
    agency: DataTypes.STRING,
    acronym: DataTypes.STRING,

    // Parent/component hierarchy. NULL means this is a top-level agency.
    parentId: DataTypes.INTEGER,

    // One of: federal_agency, federal_component, state_local, education,
    // other, needs_review. Enforced by a check constraint on the table.
    agencyType: DataTypes.STRING,

    // Whose deviation applies to users of this agency. NULL means inherit from
    // the parent; a value overrides. Deliberately independent of solicitation
    // access, which lives in agency_solicitation_scope.
    deviationSourceId: DataTypes.INTEGER,

    active: DataTypes.BOOLEAN,
    provenance: DataTypes.STRING
  }, {});

  Agency.associate = function(models) {
    Agency.belongsTo(models.Agency, { as: 'parent', foreignKey: 'parentId' })
    Agency.hasMany(models.Agency, { as: 'components', foreignKey: 'parentId' })
    Agency.belongsTo(models.Agency, { as: 'deviationSource', foreignKey: 'deviationSourceId' })
  };

  /**
   * Resolve which agency's deviation applies, walking up the hierarchy.
   * An explicit deviationSourceId wins; otherwise inherit from the parent.
   * Depth-capped so a cycle introduced through admin cannot hang a request.
   */
  Agency.resolveDeviationSource = async function(agencyId, depth = 0) {
    if (!agencyId || depth > 10) return null
    const a = await Agency.findByPk(agencyId)
    if (!a) return null
    if (a.deviationSourceId) return a.deviationSourceId
    if (a.parentId) return Agency.resolveDeviationSource(a.parentId, depth + 1)
    return a.id
  };

  return Agency;
};
