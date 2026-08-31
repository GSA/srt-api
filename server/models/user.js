'use strict';
// sequelize model:generate --force --name User --attributes firstName:string,lastName:string,agency:string,email:string,password:string,position:string,isAccepted:BOOLEAN,isRejected:BOOLEAN,userRole:string,rejectionNote:string,creationDate:string,tempPassword:string
module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    firstName: DataTypes.STRING,
    lastName: DataTypes.STRING,
    agency: DataTypes.STRING,
    // Foreign key into Agencies. Added alongside the agency name string rather
    // than replacing it, because the rest of the application still reads the
    // name. Scope resolution depends on this being declared: solicitationScopeFor
    // falls back to an exact name match when it is null, so an undeclared column
    // here would silently disable agency scoping everywhere.
    agencyId: DataTypes.INTEGER,
    // original email domain when agency could not be resolved; see
    // grabAgencyFromEmail in auth.routes.js
    unresolvedDomain: DataTypes.STRING,
    email: DataTypes.STRING,
    password: DataTypes.STRING,
    position: DataTypes.STRING,
    isAccepted: DataTypes.BOOLEAN,
    isRejected: DataTypes.BOOLEAN,
    userRole: DataTypes.STRING,
    rejectionNote: DataTypes.STRING,
    reviewStatus: DataTypes.STRING,
    creationDate: DataTypes.STRING,
    tempPassword: DataTypes.STRING,
    maxId: DataTypes.STRING
  }, {});
  User.associate = function(models) {
    User.belongsTo(models.Agency, { foreignKey: 'agencyId' })
  };
  return User;
};
