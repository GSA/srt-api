'use strict';

// sequelize model:generate --force --name Agency --attributes agency:string,acronym:string

module.exports = (sequelize, DataTypes) => {
  const Agency = sequelize.define('Agency', {
    agency: DataTypes.STRING,
    acronym: DataTypes.STRING
  }, {});
  Agency.associate = function(models) {
    // associations can be defined here
  };
  return Agency;
};