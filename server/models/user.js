'use strict';
module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    firstName: DataTypes.STRING,
    lastName: DataTypes.STRING,
    agency: DataTypes.STRING,
    email: DataTypes.STRING,
    password: DataTypes.STRING,
    position: DataTypes.STRING,
    isAccepted: DataTypes.STRING,
    isRejected: DataTypes.STRING,
    userRole: DataTypes.STRING,
    rejectionNote: DataTypes.STRING,
    creationDate: DataTypes.STRING,
    tempPassword: DataTypes.STRING
  }, {});
  User.associate = function(models) {
    // associations can be defined here
  };
  return User;
};