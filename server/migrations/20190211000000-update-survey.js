'use strict';
module.exports = {
    up: (queryInterface, Sequelize) => {
        return queryInterface.bulkDelete('Surveys', {})
            .then(() => {
                return queryInterface.bulkInsert("Surveys",
                    [
                        {
                            question: "Did the tool correctly identify this solicitation as an Information and Communication Technology (ICT) or Electronic and Information Technology (E&IT)?",
                            choices: JSON.stringify(["Yes", "No"]),
                            section: "Section1",
                            type: "choose one",
                            answer: "-Answer-",
                            note: "",
                            choicesNote: JSON.stringify(["Select this if answer is yes", "Select this if answer is no"]),
                            createdAt: new Date(),
                            updatedAt: new Date()
                        },
                        {
                            question: "What type of deliverable(s) does this solicitation contain?",
                            choices: JSON.stringify([]),
                            section: "Section1",
                            type: "essay",
                            answer: "-Answer-",
                            note: "",
                            choicesNote: JSON.stringify(["Select this if answer is yes", "Select this if answer is no"]),
                            createdAt: new Date(),
                            updatedAt: new Date()
                        },
                        {
                            question: "Does the solicitation include a report generated from the Accessibility Requirements Tool (ART)?",
                            choices: JSON.stringify(["Yes", "No"]),
                            section: "Section1",
                            type: "choose one",
                            answer: "-Answer-",
                            note: "",
                            choicesNote: JSON.stringify(["Select this if answer is yes", "Select this if answer is no"]),
                            createdAt: new Date(),
                            updatedAt: new Date()
                        },
                        {
                            question: "Does the solicitation ask for a Voluntary Product Accessibility Template (VPAT)?",
                            choices: JSON.stringify(["Yes", "No"]),
                            section: "Section1",
                            type: "choose one",
                            answer: "-Answer-",
                            note: "",
                            choicesNote: JSON.stringify(["Select this if answer is yes", "Select this if answer is no"]),
                            createdAt: new Date(),
                            updatedAt: new Date()
                        },
                        {
                            question: "Did the tool correctly identify this solicitation as being in non-compliant with Section 508?",
                            choices: JSON.stringify(["Yes", "No"]),
                            section: "Section1",
                            type: "choose one",
                            answer: "-Answer-",
                            note: "",
                            choicesNote: JSON.stringify(["Select this if answer is yes", "Select this if answer is no"]),
                            createdAt: new Date(),
                            updatedAt: new Date()
                        },

                        {
                            question: "Why is the solicitation NOT Section 508 compliant? (Multiple Choice) ",
                            choices: JSON.stringify([
                                "This solicitation had no mention or only a vague, non-specific Section 508 reference",
                                "All or portions of the solicitation, associated documents, or attachments were in an inaccessible format",
                                "The solicitation stated an exception that did not apply; and add as last box the answer: Other -  Please explain",
                                "The solicitation made a statement or implied that Section 508 exception should be determined by the vendor",
                                "The solicitation made a statement or implied that determination of the Section 508 applicability should be determined by the vendor",
                                "Other -  Please explain"
                            ]),
                            section: "Section2",
                            type: "choose one",
                            answer: "-Answer-",
                            note: "Please consider only the information listed above and not the classification.",
                            choicesNote: JSON.stringify([
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                            ]),
                            createdAt: new Date(),
                            updatedAt: new Date()
                        },
                        {
                            question: "Which specific document(s) in this solicitation should contain Section 508 requirements? (Multiple Choice)",
                            choices: JSON.stringify([
                                "Statement of Work (SOW)",
                                "Statement of Objectives (SOO)",
                                "Performance Work Statement (PWS)",
                                "Request for Information (RFI)",
                                "Request for Quotation (RFQ)",
                                "Requirement Documents"
                            ]),
                            section: "Section3",
                            type: "essay",
                            answer: "essay answer",
                            note: "Do you have any additional feedback?",
                            choicesNote: JSON.stringify([
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                            ]),
                            createdAt: new Date(),
                            updatedAt: new Date()

                        },
                        {
                            question: "Which specific document(s) in this solicitation should contain Section 508 requirements? (Multiple Choice)",
                            choices: JSON.stringify([
                                "Statement of Work (SOW)",
                                "Statement of Objectives (SOO)",
                                "Performance Work Statement (PWS)",
                                "Request for Information (RFI)",
                                "Request for Quotation (RFQ)",
                                "All of the above",
                                "Other -  Please explain"
                            ]),
                            section: "Section3",
                            type: "essay",
                            answer: "essay answer",
                            note: "Do you have any additional feedback?",
                            choicesNote: JSON.stringify([
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                            ]),
                            createdAt: new Date(),
                            updatedAt: new Date()

                        }
                    ])


            });
    },

    down: (queryInterface, Sequelize) => {
        return queryInterface.bulkDelete('Surveys', {} )
            .then(() => {
                return queryInterface.bulkInsert("Surveys",
                    [
                        {
                            question: "Was the classification correct?",
                            choices: JSON.stringify(["Yes", "No"]),
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
                            choices: JSON.stringify(["Reading", "Searching", "Guessing"]),
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
                            choicesNote: JSON.stringify([]),
                            createdAt: new Date(),
                            updatedAt: new Date()

                        }
                    ])

            })
    }
};