'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addConstraint('Surveys', { // Table name
      fields: ['surveyTitle'], // Column(s) to make unique
      type: 'unique',
      name: 'unique_survey_title' // Optional name for the constraint
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeConstraint('Surveys', 'unique_survey_title');
  }
};