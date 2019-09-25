'use strict'
// noinspection SpellCheckingInspection
let upData = [
  {
    question: 'Did the tool correctly identify this solicitation as an Information and Communication Technology (ICT)?',
    choices: JSON.stringify(['Yes', 'No']),
    section: 'Section1',
    type: 'choose one',
    answer: '',
    note: '',
    choicesNote: JSON.stringify(['', '']),
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    question: 'Did the tool correctly identify this solicitation as non-compliant with Section 508?',
    choices: JSON.stringify(['Yes', 'No']),
    section: 'Section1',
    type: 'choose one',
    answer: '',
    note: '',
    choicesNote: JSON.stringify(['', '']),
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    question: 'Other comments such as recommendations to improve the tool or \n' +
      ' why the solicitation NOT Section 508 compliant?',
    choices: null,
    section: 'Section1',
    type: 'essay',
    answer: '',
    note: '',
    choicesNote: JSON.stringify([]),
    createdAt: new Date(),
    updatedAt: new Date()
  }
]

module.exports = {

  up: (queryInterface) => {
    return queryInterface.bulkDelete('Surveys', {})
      .then(() => {
        return queryInterface.bulkInsert('Surveys', upData)
      })
  },

  down: (queryInterface) => {
    return queryInterface.bulkDelete('Surveys', {})
  }
}
