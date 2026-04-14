// server/migrations/20190408300000-create-attachment.js
module.exports = {
    up: async (queryInterface, Sequelize) => {
      await queryInterface.createTable('attachment', {
        id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true
        },
        notice_id: {
          type: Sequelize.INTEGER,
          references: {
            model: 'notice',
            key: 'id'
          }
        },
        notice_type_id: {
          type: Sequelize.INTEGER,
          references: {
            model: 'notice_type',
            key: 'id'
          }
        },
        attachment_text: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        prediction: {
          type: Sequelize.INTEGER,
          allowNull: true
        },
        decision_boundary: {
          type: Sequelize.INTEGER,
          allowNull: true
        },
        validation: {
          type: Sequelize.INTEGER,
          allowNull: true
        },
        attachment_url: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        trained: {
          type: Sequelize.BOOLEAN,
          allowNull: true
        },
        solicitation_id: {
          type: Sequelize.INTEGER,
          references: {
            model: 'solicitations',
            key: 'id'
          }
        },
        machine_readable: {
          type: Sequelize.BOOLEAN,
          allowNull: true
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
      await queryInterface.dropTable('attachment');
    }
  };