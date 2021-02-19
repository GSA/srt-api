'use strict';
module.exports = (sequelize, DataTypes) => {
    const SurveyResponse = sequelize.define('SurveyResponse', {
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
    }, {
        tableName: 'survey_responses'
    });
    SurveyResponse.associate = function(models) {
        // associations can be defined here
    };
    return SurveyResponse;
};
