
module.exports = (sequelize, DataTypes) => {
    const Solicitation = sequelize.define('Solicitation',
        {
            id: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true, autoIncrement:true },
            solNum: { type: DataTypes.STRING},
            active: { type: DataTypes.BOOLEAN },
            createdAt: { type: DataTypes.DATE, allowNull: false },
            updatedAt: { type: DataTypes.DATE },
            title: {type: DataTypes.STRING},
            url: { type: DataTypes.STRING },
            agency: { type: DataTypes.STRING},
            agency_id: { type: DataTypes.INTEGER},
            numDocs: { type: DataTypes.INTEGER },
            noticeData: { type: DataTypes.JSONB },
            notice_type_id: { type: DataTypes.INTEGER},
            noticeType: { type: DataTypes.STRING },
            date: { type: DataTypes.DATE },
            office: { type: DataTypes.STRING },
            predictions: { type: DataTypes.JSONB },
            na_flag: { type: DataTypes.BOOLEAN },
            category_list: { type: DataTypes.JSONB },
            undetermined: { type: DataTypes.BOOLEAN },
            history: { type: DataTypes.JSONB },
            action: { type: DataTypes.JSONB },
            actionStatus: { type: DataTypes.STRING },
            actionDate: { type: DataTypes.DATE },
            contactInfo: { type: DataTypes.JSONB },
            parseStatus: { type: DataTypes.JSONB },
            reviewRec: { type: DataTypes.STRING },
            searchText: { type: DataTypes.STRING },
            compliant: { type: DataTypes.INTEGER},
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

        Solicitation.hasMany(models.attachment, { onDelete: 'CASCADE' });


    }

    return Solicitation
};
