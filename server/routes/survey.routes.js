/** @module SurveyRoutes */

/**
 * API routes related to surveys
 */

const logger = require('../config/winston')
// noinspection JSUnresolvedVariable
const Survey = require('../models').Survey

/**
 * Takes a survey record from the database and reformat it as expected by the client UI
 *
 * @param s Survey
 * @returns {{ChoicesNote: string[], Answer: string, Type: string, Choices: string[], Note: string, Question: string, ID: *, Section: string}}
 */
function makeOneSurvey (s) {
  return {
    ID: s.id,
    Question: s.question,
    Choices: s.choices,
    Section: s.section,
    Type: s.type,
    Answer: s.answer,
    Note: s.note,
    ChoicesNote: s.choicesNote
  }
}

/**
 * agency routes
 */
module.exports = {

  /**
     * <b> GET /api/surveys<b><br><br>
     *
     * Sends an array of Survey objects to the response.
     * All survey rows in the database are returned. No parameters are used.
     *
     * @param {Request} req
     * @param {Response} res
     * @return {Promise}
     */
  get: (req, res) => {
    // return res.status(200).send(getMockSurvey());

    return Survey.findAll()
      .then((surveys) => {
        return res.status(200).send(surveys.map(s => makeOneSurvey(s)))
      })
      .catch((e) => {
        logger.log('error', 'error in: survey get', { error:e, tag: 'survey get' })
        res.status(400).send(e)
      })
  }

}

// function getMockSurvey () {
//     return [
//         {
//             ID: "1",
//             Question : "Was the classification correct?",
//             Choices: ["Yes", "No"],
//             Section: "Section1",
//             Type: "multiple response",
//             Answer: "-Answer-",
//             Note: "Please consider only the classification and no issues with the data.",
//             ChoicesNote: ["Select this if answer is yes", "Select this if answer is no"]
//         },
//         {
//             ID: "2",
//             Question : "Was the information correct?",
//             Choices: ["Yes", "No"],
//             Section: "Section2",
//             Type: "multiple response",
//             Answer: "-Answer-",
//             Note: "Please consider only the information listed above and not the classification.",
//             ChoicesNote: ["Select this if answer is yes", "Select this if answer is no"]
//         },
//
//     ];
// }
