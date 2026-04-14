// server/migrations/20190210000000-create-surveys.js
module.exports = {
    up: async (queryInterface, Sequelize) => {
      await queryInterface.createTable('Surveys', {
        id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true
        },
        question: {
          type: Sequelize.TEXT
        },
        choices: {
          type: Sequelize.JSONB
        },
        section: {
          type: Sequelize.STRING
        },
        type: {
          type: Sequelize.STRING
        },
        answer: {
          type: Sequelize.TEXT
        },
        note: {
          type: Sequelize.TEXT
        },
        choicesNote: {
          type: Sequelize.JSONB
        },
        createdAt: {
          allowNull: false,
          type: Sequelize.DATE
        },
        updatedAt: {
          allowNull: false,
          type: Sequelize.DATE
        }
      });
    },
    down: async (queryInterface, Sequelize) => {
      await queryInterface.dropTable('Surveys');
    }
  };
  