// server/migrations/20190408100000-create-notice.js
module.exports = {
    up: async (queryInterface, Sequelize) => {
      await queryInterface.createTable('notice', {
        id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true
        },
        notice_type_id: {
          type: Sequelize.INTEGER,
          references: {
            model: 'notice_type',
            key: 'id'
          }
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
      await queryInterface.dropTable('notice');
    }
  };