'use strict';
module.exports = {
    up: (queryInterface, Sequelize) => {

        return queryInterface.sequelize.query("delete from attachment where notice_id in (select id from notice where notice_data = '\"test\"' )" )
            .then( () => {
                return queryInterface.sequelize.query("delete from notice where notice_data = '\"test\"'")
            })
            .then( () => {
                return queryInterface.sequelize.query("insert into \"Users\" (\"firstName\", \"lastName\", agency, email, password, \"tempPassword\", \"userRole\", position, \"isAccepted\", \"isRejected\", \"createdAt\", \"updatedAt\") " +
                    "values ('Al', 'Crowley', 'General Services Administration', 'al@bwnj.net', '23Hilltop!', '23Hilltop!', 'Administrator', 'Principal Engineer', true, false , now(), now() );")
            })
    },
    down: (queryInterface, Sequelize) => {
        return queryInterface.sequelize.query("delete from attachment where notice_id in (select id from notice where notice_data = '\"test\"' )" )
            .then( () => {
                return queryInterface.sequelize.query("delete from notice where notice_data = '\"test\"'")
            })
            .then( () => {
                return queryInterface.sequelize.query("delete from \"Users\" where email = 'al@bwnj.net'");
            })
    }
};