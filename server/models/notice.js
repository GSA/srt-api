/* jshint indent: 2 */

module.exports = function(sequelize, DataTypes) {
  return sequelize.define('notice', {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      autoIncrement: true
    },
    notice_type_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'notice_type',
        key: 'id'
      }
    },
    solicitation_number: {
      type: DataTypes.STRING,
      allowNull: true
    },
    agency: {
      type: DataTypes.STRING,
      allowNull: true
    },
    date: {
      type: DataTypes.DATE,
      allowNull: true
    },
    notice_data: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    compliant: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    action: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    feedback: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    history: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    na_flag: {
      type: DataTypes.BOOLEAN,
      allowNull: true
    }
  }, {
    tableName: 'notice'
  });
};
