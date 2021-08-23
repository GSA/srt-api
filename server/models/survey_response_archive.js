'use strict';
module.exports = (sequelize, DataTypes) => {
  const SurveyResponseArchive = sequelize.define('SurveyResponseArchive', {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      autoIncrement: true
    },
    solNum: DataTypes.STRING,
    maxId: DataTypes.STRING,
    contemporary_notice_id: DataTypes.INTEGER,
    response: DataTypes.JSONB,
    original_created_at: DataTypes.DATE
  }, {
    tableName: 'survey_responses_archive'
  });
  SurveyResponseArchive.associate = function(models) {
    // associations can be defined here
  };
  return SurveyResponseArchive;
};
