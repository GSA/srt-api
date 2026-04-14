// server/migrations/20190408000000-create-notice-type.js
module.exports = {
    up: async (queryInterface, Sequelize) => {
      await queryInterface.createTable('notice_type', {
        id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true
        },
        name: {
          type: Sequelize.TEXT,  // Changed from STRING/varchar(255) to TEXT to handle longer values
          allowNull: false
        },
        createdAt: {
          type: Sequelize.DATE,
          allowNull: false
        },
        updatedAt: {
          type: Sequelize.DATE
        }
      });
    },
    down: async (queryInterface) => {
      await queryInterface.dropTable('notice_type');
    }
  };