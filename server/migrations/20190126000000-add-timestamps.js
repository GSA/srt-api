'use strict';


module.exports = {
    up: (queryInterface, Sequelize) => {

        let sql = "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type LIKE '%TABLE' AND table_name != 'spatial_ref_sys'";

        return  Sequelize.query(sql, {type: db.sequelize.QueryTypes.SELECT})
            .then ( tables => {
                console.log(tables);
            })
            .then ( () => {
                return queryInterface.addColumn("notice", "createdAt", {type: "timestamptz", defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')})
            })
            .then ( () => {
                return queryInterface.addColumn("notice", "updatedAt", {type: "timestamptz", defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')});
            })
            .then ( () => {
                return queryInterface.addColumn("notice_type", "createdAt", {type: "timestamptz", defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')});
            })
            .then ( () => {
                return queryInterface.addColumn("notice_type", "updatedAt", {type: "timestamptz", defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')});
            })
            .then ( () => {
                return queryInterface.addColumn("attachment", "createdAt", {type: "timestamptz", defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')});
            })
            .then ( () => {
                return queryInterface.addColumn("attachment", "updatedAt", {type: "timestamptz", defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')});
            })
    },
    down: (queryInterface, Sequelize) => {
        return queryInterface.removeColumn("notice", "createdAt")
            .then( () => {
                return queryInterface.removeColumn("notice", "updatedAt")
            })
            .then( () => {
                return queryInterface.removeColumn("notice_type", "createdAt")
            })
            .then( () => {
                return queryInterface.removeColumn("notice_type", "updatedAt")
            })
            .then( () => {
                return queryInterface.removeColumn("attachment", "createdAt")
            })
            .then( () => {
                return queryInterface.removeColumn("attachment", "updatedAt")
            })

    }
};