const logger = require('../config/winston');
const db = require('../models/index');
const User = require('../models').User;

function getMockSurvey () {
    return [
        {
            ID: "1",
            Question : "Was the classification correct?",
            Choices: ["Yes", "No"],
            Section: "Section1",
            Type: "Multiple Choice",
            Answer: "-Answer-",
            Note: "Please consider only the classification and no issues with the data.",
            ChoicesNote: ["Select this if answer is yes", "Select this if answer is no"]
        },
        {
            ID: "2",
            Question : "Was the information correct?",
            Choices: ["Yes", "No"],
            Section: "Section2",
            Type: "Multiple Choice",
            Answer: "-Answer-",
            Note: "Please consider only the information listed above and not the classification.",
            ChoicesNote: ["Select this if answer is yes", "Select this if answer is no"]
        },

    ];
}


/**
 * agency routes
 */
module.exports = {

    get : (req, res) => {

        return res.status(200).send(getMockSurvey());
/*
        Survey.find()
            .then((survey) => {
                res.status(200).send(survey);
            })
            .catch((e) => {
                res.status(400).send(e);
            })
*/
    }

};


// app.get('/surveys', (req, res) => {
//     Survey.find().then((survey) => {
//         res.send(survey);
//     }, (e) => {
//         res.status(400).send(e);
//     });
// });
