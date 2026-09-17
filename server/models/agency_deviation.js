'use strict';
module.exports = (sequelize, DataTypes) => {
  const AgencyDeviation = sequelize.define('AgencyDeviation', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    agency_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'agency_id'
    },
    regulation_part: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: 'regulation_part'
    },
    section: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: 'section'
    },
    language: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: 'language'
    }
  }, {
    tableName: 'agency_deviation',
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  });

  AgencyDeviation.associate = function(models) {
    // Uncomment if Agency has a matching primary key relationship
    AgencyDeviation.belongsTo(models.Agency, { foreignKey: 'agency_id' });
  };

  return AgencyDeviation;
};