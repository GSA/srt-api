'use strict'

/**
 * Adds Users.unresolvedDomain.
 *
 * grabAgencyFromEmail now returns 'Needs Review' for an email domain it cannot
 * map, instead of letting the raw domain label become the agency name. That
 * sentinel tells an administrator that the user needs categorising but not what
 * they are categorising, so the original domain is retained here.
 *
 * Nullable and additive. Guarded so it is safe to re-run.
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable('Users')
    if (!table.unresolvedDomain) {
      await queryInterface.addColumn('Users', 'unresolvedDomain', {
        type: Sequelize.STRING,
        allowNull: true
      })
    }
  },

  down: async (queryInterface) => {
    const table = await queryInterface.describeTable('Users')
    if (table.unresolvedDomain) {
      await queryInterface.removeColumn('Users', 'unresolvedDomain')
    }
  }
}
