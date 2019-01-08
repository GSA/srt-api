'use strict';
module.exports = {
  up: (queryInterface, Sequelize) => {

    return queryInterface.renameColumn("Users", "isAccepted", "isAcceptedOld")
        .then( () => {
          return queryInterface.renameColumn("Users", "isRejected", "isRejectedOld")
        })
        .then ( () => {
            return queryInterface.addColumn("Users", "isAccepted", {type:'boolean', defaultValue: false});
        })
        .then ( () => {
            return queryInterface.addColumn("Users", "isRejected", {type:'boolean', defaultValue: false});
        })
  },
  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn("Users", "isAccepted")
        .then( () => {
            return queryInterface.removeColumn("Users", "isRejected")
        })
        .then ( () => {
            return queryInterface.addColumn("Users", "isAccepted", {type:"string", defaultValue: "0"})
                .then( () => {
                    return queryInterface.addColumn("Users", "isRejected", {type:"string", defaultValue: "0"})
                });

        })

  }
};