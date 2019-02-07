'use strict';
module.exports = {
    up: (queryInterface, Sequelize) => {
        return queryInterface.sequelize.query('alter table "notice"  rename to "Notice"' )
            .then( () => {
                return queryInterface.renameTable("attachment", "Attachment")
            })
            .then( () => {
                return queryInterface.renameTable("notice_type", "Notice_Type")
            })
            .then( () => {
                return queryInterface.renameTable("model", "Model")
            })
    },
    down: (queryInterface, Sequelize) => {
        return queryInterface.renameTable("Notice", "notice")
            .then( () => {
                return queryInterface.renameTable("Attachment", "attachment")
            })
            .then( () => {
                return queryInterface.renameTable("Notice_type", "notice_Type")
            })
            .then( () => {
                return queryInterface.renameTable("Model", "model")
            })
    }
};