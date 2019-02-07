'use strict';
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('Surveys', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      question: {
        type: Sequelize.TEXT
      },
      choices: {
        type: Sequelize.JSONB
      },
      section: {
        type: Sequelize.STRING(2000)
      },
      type: {
        type: Sequelize.STRING(2000)
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
    })
        .then( () => {
          return queryInterface.bulkInsert("Surveys",
              [
                {
                  question: "Was the classification correct?",
                  choices: JSON.stringify(["Yes", "No" ]),
                  section: "Section1",
                  type: "choose one",
                  answer: "-Answer-",
                  note: "Please consider only the classification and no issues with the data.",
                  choicesNote: JSON.stringify(["Select this if answer is yes", "Select this if answer is no"]),
                  createdAt: new Date(),
                  updatedAt: new Date()
                },
                {
                  question: "How did you verify these results. Check all that apply",
                  choices: JSON.stringify(["Reading", "Searching", "Guessing" ]),
                  section: "Section2",
                  type: "choose one",
                  answer: "-Answer-",
                  note: "Please consider only the information listed above and not the classification.",
                  choicesNote: JSON.stringify([
                      "Select this if you have read all the supplied documentation",
                      "Select this if you have searched the digital text",
                      "Select this if you are mostly guessing"
                  ]),
                  createdAt: new Date(),
                  updatedAt: new Date()
                },
                  {
                      question: "Other comments:",
                      choices: JSON.stringify([]),
                      section: "Section3",
                      type: "essay",
                      answer: "essay answer",
                      note: "Do you have any additional feedback?",
                      choicesNote: JSON.stringify([
                      ]),
                      createdAt: new Date(),
                      updatedAt: new Date()

                  }
              ])

        })
  },
  down: (queryInterface, Sequelize) => {
    return queryInterface.dropTable('Surveys');
  }
};