'use strict';

/**
 * Maps an email domain to an agency. Replaces the two hardcoded config maps
 * (UNIQUE_EMAIL_AGENCY_MAPPING, 7 entries) that previously drove agency
 * resolution at login.
 *
 * Domains are stored lowercase and without a leading '@'. originalRawValue
 * keeps whatever arrived, so a spreadsheet import that needed normalising can
 * still be audited against its source.
 */
module.exports = (sequelize, DataTypes) => {
  const AgencyDomain = sequelize.define('AgencyDomain', {
    domain: DataTypes.STRING,
    agencyId: DataTypes.INTEGER,
    active: DataTypes.BOOLEAN,
    source: DataTypes.STRING,
    originalRawValue: DataTypes.STRING
  }, { tableName: 'agency_domains' });

  AgencyDomain.associate = function(models) {
    AgencyDomain.belongsTo(models.Agency, { foreignKey: 'agencyId' })
  };

  /** Normalise a raw domain or email fragment for storage and lookup. */
  AgencyDomain.normalize = function(value) {
    if (!value || typeof value !== 'string') return null
    return value.trim().toLowerCase().replace(/^@/, '') || null
  };

  return AgencyDomain;
};
