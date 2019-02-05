'use strict';


module.exports = {
    up: (queryInterface, Sequelize) => {

        return queryInterface.addColumn("notice", "feedback", {type: "jsonb"})
            .then( () => {
                return queryInterface.removeColumn("notice", "action");
            })
            .then( () => {
                return queryInterface.addColumn("notice", "action", {type: "jsonb"})
            })
            .then( () => {
                return queryInterface.addColumn("notice", "history", {type: "jsonb"})
            })
    },
    down: (queryInterface, Sequelize) => {
        return queryInterface.removeColumn("notice", "feedback")
            .then(() => {
                return queryInterface.removeColumn("notice", "history");
            })
            .then(() => {
                return queryInterface.removeColumn("notice", "action");
            })
            .then(() => {
                return queryInterface.addColumn("notice", "action", {type: "jsonb"})
            })
    }

};