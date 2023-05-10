/* jshint indent: 2 */

const { Association } = require("sequelize");

module.exports = function(sequelize, DataTypes) {
  const Attachment =  sequelize.define('attachment', 
  {
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
    },
    solicitation_id: {
      type: DataTypes.INTEGER,
      references: {
        model: 'solicitation',
        key: 'id'
      }
    },
    createdAt: { type: DataTypes.DATE, allowNull: false },
    updatedAt: { type: DataTypes.DATE },
    machine_readable: {
      type: DataTypes.BOOLEAN,
      allowNull: true
    },
    filename: { type: DataTypes.TEXT, allowNull: false },
  }, {
    tableName: 'attachment'
  });

  Attachment.associate = function(models) {
      // associations can be defined here
      Attachment.belongsTo(models.Solicitation, { foreignKey: 'solicitation_id' });
  }


  return Attachment

};
