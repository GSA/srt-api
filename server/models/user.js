'use strict';
// sequelize model:generate --force --name User --attributes firstName:string,lastName:string,agency:string,email:string,password:string,position:string,isAccepted:BOOLEAN,isRejected:BOOLEAN,userRole:string,rejectionNote:string,creationDate:string,tempPassword:string
module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    firstName: DataTypes.STRING,
    lastName: DataTypes.STRING,
    agency: DataTypes.STRING,
    email: DataTypes.STRING,
    password: DataTypes.STRING,
    position: DataTypes.STRING,
    isAccepted: DataTypes.BOOLEAN,
    isRejected: DataTypes.BOOLEAN,
    userRole: DataTypes.STRING,
    rejectionNote: DataTypes.STRING,
    creationDate: DataTypes.STRING,
    tempPassword: DataTypes.STRING,
    maxId: DataTypes.STRING
  }, {});
  User.associate = function(models) {
    // associations can be defined here
  };
  return User;
};
