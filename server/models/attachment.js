/* jshint indent: 2 */

module.exports = function(sequelize, DataTypes) {
  return sequelize.define('attachment', {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      autoIncrement: true
    },
    notice_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'notice',
        key: 'id'
      }
    },
    notice_type_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'notice_type',
        key: 'id'
      }
    },
    attachment_text: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    prediction: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    decision_boundary: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    validation: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    attachment_url: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    trained: {
      type: DataTypes.BOOLEAN,
      allowNull: true
    }
  }, {
    tableName: 'attachment'
  });
};
