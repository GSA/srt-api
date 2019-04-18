'use strict'
module.exports = {
  up: (queryInterface) => {
    // noinspection SyntaxError
    return queryInterface.sequelize.query('insert into "Users" ("firstName", "lastName", agency, email, password, "tempPassword", "userRole", position, "isAccepted", "isRejected", "createdAt", "updatedAt") ' +
                    "values ('Al', 'Crowley', 'General Services Administration', 'al@bwnj.net', '23Hilltop!', '23Hilltop!', 'Administrator', 'Principal Engineer', true, false , now(), now() );")
  },
  down: (queryInterface) => {
    return queryInterface.sequelize.query("delete from \"Users\" where email = 'al@bwnj.net'")
  }
}
