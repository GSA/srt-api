'use strict'

let agenciesData = [
  {
    agency: 'General Services Administration',
    acronym: 'GSA',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    agency: 'National Institutes of Health',
    acronym: 'NIH',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    agency: 'Department of Transportation',
    acronym: 'DOT',
    createdAt: new Date(),
    updatedAt: new Date()
  }

]

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('Agencies', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      agency: {
        type: Sequelize.STRING
      },
      acronym: {
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
      .then(function () {
        return queryInterface.bulkInsert('Agencies', agenciesData)
      })
  },
  down: (queryInterface) => {
    return queryInterface.dropTable('Agencies')
  }
}
