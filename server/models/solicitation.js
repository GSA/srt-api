
module.exports = (sequelize, DataTypes) => {
    const Solicitation = sequelize.define('Solicitation',
        {
            id: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true, autoIncrement:true },
            solNum: { type: DataTypes.STRING, allowNull: false },
            title: {type: DataTypes.STRING, allowNull: false },
            url: { type: DataTypes.STRING },
            agency: { type: DataTypes.STRING, allowNull: false },
            numDocs: { type: DataTypes.INTEGER },
            noticeData: { type: DataTypes.JSONB },
            notice_type_id: { type: DataTypes.INTEGER, allowNull: false },
            noticeType: { type: DataTypes.STRING },
            date: { type: DataTypes.DATE },
            office: { type: DataTypes.STRING },
            predictions: { type: DataTypes.JSONB },
            na_flag: { type: DataTypes.BOOLEAN },
            category_list: { type: DataTypes.JSONB },
            undetermined: { type: DataTypes.BOOLEAN },
            action: { type: DataTypes.JSONB },
            actionStatus: { type: DataTypes.STRING },
            actionDate: { type: DataTypes.DATE },
            history: { type: DataTypes.JSONB },
            contactInfo: { type: DataTypes.JSONB },
            parseStatus: { type: DataTypes.JSONB },
            reviewRec: { type: DataTypes.STRING },
            searchText: { type: DataTypes.STRING },
            active: { type: DataTypes.BOOLEAN }
      }, {
        tableName: 'solicitations'
      } );

    Solicitation.associate = function(models) {
        // associations can be defined here
        Solicitation.hasMany(models.SurveyResponse, {
                sourceKey: 'solNum',
                foreignKey: 'solNum',
                as: 'feedback'
        })
      Solicitation.hasOne(models.notice_type, {
        sourceKey: 'notice_type_id',
        foreignKey: 'id',
        as: 'notice_type'
      })

    }

    return Solicitation
};
