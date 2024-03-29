
module.exports = (sequelize, DataTypes) => {
  const Prediction = sequelize.define('Prediction',
    {
      id: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true, autoIncrement:true },
      title: {type: DataTypes.STRING, allowNull: false },
      url: { type: DataTypes.STRING },
      agency: { type: DataTypes.STRING, allowNull: false },
      numDocs: { type: DataTypes.INTEGER },
      solNum: { type: DataTypes.STRING, allowNull: false },
      noticeType: { type: DataTypes.STRING, allowNull: false },
      date: { type: DataTypes.DATE },
      office: { type: DataTypes.STRING },
      predictions: { type: DataTypes.JSONB },
      na_flag: { type: DataTypes.BOOLEAN },
      category_list: { type: DataTypes.JSONB },
      undetermined: { type: DataTypes.BOOLEAN },
      action: { type: DataTypes.JSONB },
      actionStatus: { type: DataTypes.STRING },
      actionDate: { type: DataTypes.DATE },
//      feedback: { type: DataTypes.JSONB },
      history: { type: DataTypes.JSONB },
      contactInfo: { type: DataTypes.JSONB },
      parseStatus: { type: DataTypes.JSONB },
      reviewRec: { type: DataTypes.STRING },
      searchText: { type: DataTypes.STRING },
      active: { type: DataTypes.BOOLEAN }
    }, {} );

    Prediction.associate = function (models) {
        // associations can be defined here
        Prediction.hasMany(models.SurveyResponse, {
            sourceKey: 'solNum',
            foreignKey: 'solNum',
            as: 'feedback'
        })
  }

  return Prediction
};
