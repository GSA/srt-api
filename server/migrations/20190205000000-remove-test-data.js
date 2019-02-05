'use strict';
module.exports = {
    up: (queryInterface, Sequelize) => {

        return queryInterface.sequelize.query("delete from attachment where notice_id in (select id from notice where notice_data = '\"test\"' )" )
            .then( () => {
                return queryInterface.sequelize.query("delete from notice where notice_data = '\"test\"'")
            })
    },
    down: (queryInterface, Sequelize) => {
        return queryInterface.sequelize.query("delete from attachment where notice_id in (select id from notice where notice_data = '\"test\"' )" )
            .then( () => {
                return queryInterface.sequelize.query("delete from notice where notice_data = '\"test\"'")
            })
    }
};