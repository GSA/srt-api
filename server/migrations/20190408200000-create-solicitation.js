// server/migrations/20190408200000-create-solicitation.js
module.exports = {
    up: async (queryInterface, Sequelize) => {
      await queryInterface.createTable('solicitations', {  // Changed to match tableName in model
        id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true
        },
        solNum: { type: Sequelize.STRING },
        active: { type: Sequelize.BOOLEAN },
        title: { type: Sequelize.STRING },
        url: { type: Sequelize.STRING },
        agency: { type: Sequelize.STRING },
        agency_id: { type: Sequelize.INTEGER },
        numDocs: { type: Sequelize.INTEGER },
        noticeData: { type: Sequelize.JSONB },
        notice_type_id: { type: Sequelize.INTEGER },
        noticeType: { type: Sequelize.STRING },
        date: { type: Sequelize.DATE },
        office: { type: Sequelize.STRING },
        predictions: { type: Sequelize.JSONB },
        na_flag: { type: Sequelize.BOOLEAN },
        category_list: { type: Sequelize.JSONB },
        undetermined: { type: Sequelize.BOOLEAN },
        history: { type: Sequelize.JSONB },
        action: { type: Sequelize.JSONB },
        actionStatus: { type: Sequelize.STRING },
        actionDate: { type: Sequelize.DATE },
        contactInfo: { type: Sequelize.JSONB },
        parseStatus: { type: Sequelize.JSONB },
        reviewRec: { type: Sequelize.STRING },
        searchText: { type: Sequelize.STRING },
        compliant: { type: Sequelize.INTEGER },
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
      await queryInterface.dropTable('solicitations');
    }
  };