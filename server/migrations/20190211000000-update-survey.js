'use strict'
// noinspection SpellCheckingInspection
let upData = [
  {
    question: 'Did the tool correctly identify this solicitation as an Information and Communication Technology (ICT) or Electronic and Information Technology (E&IT)?',
    choices: JSON.stringify(['Yes', 'No']),
    section: 'Section1',
    type: 'choose one',
    answer: '',
    note: '',
    choicesNote: JSON.stringify(['Select this if answer is yes', 'Select this if answer is no']),
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    question: 'What type of deliverable(s) does this solicitation contain?',
    choices: JSON.stringify([]),
    section: 'Section1',
    type: 'essay',
    answer: '',
    note: '',
    choicesNote: JSON.stringify(['Select this if answer is yes', 'Select this if answer is no']),
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    question: 'Does the solicitation include a report generated from the Accessibility Requirements Tool (ART)?',
    choices: JSON.stringify(['Yes', 'No']),
    section: 'Section1',
    type: 'choose one',
    answer: '',
    note: '',
    choicesNote: JSON.stringify(['Select this if answer is yes', 'Select this if answer is no']),
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    question: 'Does the solicitation ask for a Voluntary Product Accessibility Template (VPAT)?',
    choices: JSON.stringify(['Yes', 'No']),
    section: 'Section1',
    type: 'choose one',
    answer: '',
    note: '',
    choicesNote: JSON.stringify(['Select this if answer is yes', 'Select this if answer is no']),
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    question: 'Did the tool correctly identify this solicitation as being in non-compliant with Section 508?',
    choices: JSON.stringify(['Yes', 'No']),
    section: 'Section1',
    type: 'choose one',
    answer: '',
    note: '',
    choicesNote: JSON.stringify(['Select this if answer is yes', 'Select this if answer is no']),
    createdAt: new Date(),
    updatedAt: new Date()
  },

  {
    question: 'Why is the solicitation NOT Section 508 compliant? (Multiple Choice) ',
    choices: JSON.stringify([
      'This solicitation had no mention or only a vague, non-specific Section 508 reference',
      'All or portions of the solicitation, associated documents, or attachments were in an inaccessible format',
      'The solicitation stated an exception that did not apply; and add as last box the answer: Other -  Please explain',
      'The solicitation made a statement or implied that Section 508 exception should be determined by the vendor',
      'The solicitation made a statement or implied that determination of the Section 508 applicability should be determined by the vendor',
      'Other -  Please explain'
    ]),
    section: 'Section2',
    type: 'multiple response',
    answer: '',
    note: '',
    choicesNote: JSON.stringify([
      '',
      '',
      '',
      '',
      '',
      ''
    ]),
    createdAt: new Date(),
    updatedAt: new Date()
  },

  {
    question: 'Other explanation',
    choices: JSON.stringify([ ]),
    section: 'Section2',
    type: 'essay',
    answer: '',
    note: 'Why is the solicitation NOT Section 508 compliant?',
    choicesNote: JSON.stringify([]),
    createdAt: new Date(),
    updatedAt: new Date()
  },

  {
    question: 'Which specific document(s) in this solicitation should contain Section 508 requirements? (Multiple Choice)',
    choices: JSON.stringify([
      'Statement of Work (SOW)',
      'Statement of Objectives (SOO)',
      'Performance Work Statement (PWS)',
      'Request for Information (RFI)',
      'Request for Quotation (RFQ)',
      'All of the Above',
      'Other -  Please explain'
    ]),
    section: 'Section3',
    type: 'multiple response',
    answer: '',
    note: '',
    choicesNote: JSON.stringify([
      '',
      '',
      '',
      '',
      '',
      ''
    ]),
    createdAt: new Date(),
    updatedAt: new Date()

  },

  {
    question: 'Other explanation',
    choices: JSON.stringify([ ]),
    section: 'Section2',
    type: 'essay',
    answer: '',
    note: 'Which specific document(s) in this solicitation should contain Section 508 requirements?',
    choicesNote: JSON.stringify([]),
    createdAt: new Date(),
    updatedAt: new Date()
  },

  {
    question: 'Which specific document(s) in this solicitation should contain Section 508 requirements? (Multiple Choice)',
    choices: JSON.stringify([
      'Statement of Work (SOW)',
      'Statement of Objectives (SOO)',
      'Performance Work Statement (PWS)',
      'Request for Information (RFI)',
      'Request for Quotation (RFQ)',
      'All of the above',
      'Other -  Please explain'
    ]),
    section: 'Section3',
    type: 'multiple response',
    answer: 'multiple response',
    note: '',
    choicesNote: JSON.stringify([
      '',
      '',
      '',
      '',
      '',
      '',
      ''
    ]),
    createdAt: new Date(),
    updatedAt: new Date()

  },

  {
    question: 'Other explanation',
    choices: JSON.stringify([ ]),
    section: 'Section2',
    type: 'essay',
    answer: '',
    note: 'Which specific document(s) in this solicitation should contain Section 508 requirements?',
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
