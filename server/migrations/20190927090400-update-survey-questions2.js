'use strict'
// noinspection SpellCheckingInspection
let upData = [
  {
    id: 1,
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
    id: 2,
    question: 'Did the tool correctly predict compliance with Section 508? ',
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
    id: 3,
    question: 'Other comments such as recommendations to improve the tool or ' +
      'why the solicitation is NOT Section 508 compliant?',
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

let downData = [
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
      ' why the solicitation is NOT Section 508 compliant?',
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
      .then(() => {
        return queryInterface.bulkInsert('Surveys', downData)
      })
  }
}
