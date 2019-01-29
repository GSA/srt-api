/* jshint indent: 2 */

module.exports = function(sequelize, DataTypes) {
  return sequelize.define('notice_type', {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      autoIncrement: true
    },
    notice_type: {
      type: DataTypes.STRING,
      allowNull: true
    }
  }, {
    tableName: 'notice_type'
  });
};
