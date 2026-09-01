'use strict';

/**
 * Alternate spellings of an agency name.
 *
 * Solicitations arrive from SAM.gov with the agency written however the posting
 * office wrote it: "DEPT OF THE NAVY", "Department of the Navy", "NAVY". SRT
 * matches visibility on that string, so without a way to say "these are the same
 * body", a user recorded under one spelling cannot see work tagged with another.
 *
 * The table was created in 2021 and seeded with 31 aliases, but nothing ever
 * read it. This model and the scope resolver put it to use.
 */
module.exports = (sequelize, DataTypes) => {
  const AgencyAlias = sequelize.define('AgencyAlias', {
    agency_id: DataTypes.INTEGER,
    alias: DataTypes.STRING
  }, {
    tableName: 'agency_alias',
    // The 2021 table uses snake_case for its foreign key and has no
    // Sequelize-managed timestamp defaults.
    underscored: false
  });

  AgencyAlias.associate = function (models) {
    AgencyAlias.belongsTo(models.Agency, { foreignKey: 'agency_id' })
  };

  return AgencyAlias;
};
