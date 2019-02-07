'use strict';
module.exports = (sequelize, DataTypes) => {
  const Survey = sequelize.define('Survey', {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      autoIncrement: true
    },
    question: DataTypes.TEXT,
    choices: DataTypes.JSONB,
    section: DataTypes.STRING,
    type: DataTypes.STRING,
    answer: DataTypes.TEXT,
    note: DataTypes.TEXT,
    choicesNote: DataTypes.JSONB
  }, {});
  Survey.associate = function(models) {
    // associations can be defined here
  };
  return Survey;
};