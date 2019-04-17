'use strict'

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('Users', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      firstName: {
        type: Sequelize.STRING
      },
      lastName: {
        type: Sequelize.STRING
      },
      agency: {
        type: Sequelize.STRING
      },
      email: {
        type: Sequelize.STRING
      },
      password: {
        type: Sequelize.STRING
      },
      position: {
        type: Sequelize.STRING
      },
      isAccepted: {
        type: Sequelize.BOOLEAN
      },
      isRejected: {
        type: Sequelize.BOOLEAN
      },
      userRole: {
        type: Sequelize.STRING
      },
      rejectionNote: {
        type: Sequelize.STRING
      },
      creationDate: {
        type: Sequelize.STRING
      },
      tempPassword: {
        type: Sequelize.STRING
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    })
  },
  down: (queryInterface) => {
    return queryInterface.dropTable('Users')
  }
}
