'use strict'

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('winston_logs', {
      timestamp: {
        type: Sequelize.DATE
      },
      level: {
        type: Sequelize.STRING
      },
      message: {
        type: Sequelize.STRING
      },
      meta: {
        type: Sequelize.JSONB
      }
    })
  },
  down: (queryInterface) => {
    return queryInterface.dropTable('winston_logs')
  }
}
