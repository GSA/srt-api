// server/migrations/20200624143600-add-history-columns.js
module.exports = {
    up: async (queryInterface, Sequelize) => {
      try {
        await queryInterface.addColumn('notice', 'history', {
          type: Sequelize.JSONB,
          allowNull: true
        });
      } catch (error) {
        if (!error.message.includes('already exists')) {
          throw error;
        }
      }
    },
    down: async (queryInterface) => {
      try {
        await queryInterface.removeColumn('notice', 'history');
      } catch (error) {
        // Column might not exist, that's okay
      }
    }
  };