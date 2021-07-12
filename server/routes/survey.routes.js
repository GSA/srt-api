/** @module SurveyRoutes */

/**
 * API routes related to surveys
 */

const logger = require('../config/winston')
// noinspection JSUnresolvedVariable
const Survey = require('../models').Survey
const Notice = require('../models').notice
const User = require('../models').User
const SurveyResponse = require('../models').SurveyResponse
const SurveyResponseArchive = require('../models').SurveyResponseArchive
const authRoutes = require('../routes/auth.routes')
// const memoize = require('memoizee')

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

/***
 * Always add a new row to the survey_responses table so we have a timestamp of when each response was made
 * and we can connect it to the state of the solicitation / attachments at that time.
 * @param solNum
 * @param response
 * @param maxId
 * @returns {Promise<(number|{})[]|(number|*)[]|(number|*[])[]>}
 */
async function updateSurveyResponse(solNum, response, maxId = null) {
  try {
    if (!Array.isArray(response)) {
      return [500, []]; // got something of the wrong type, return error
    }
    if (response.length == 0) {
      return [200, []]; // don't save a blank.
    }

    let orig_survey_response = await SurveyResponse.findOne({"where": {"solNum": solNum}})
    if (orig_survey_response) {
      await SurveyResponseArchive.create(
        {
          "solNum": orig_survey_response.solNum,
          "response": orig_survey_response.response,
          "maxId": orig_survey_response.maxId,
          "original_created_at": orig_survey_response.createdAt,
          "contemporary_notice_id": orig_survey_response.contemporary_notice_id
        });
      orig_survey_response.destroy();
    }
    survey_response = await SurveyResponse.create({"solNum": solNum,"response": response,  maxId: maxId})
    return [200, survey_response]


  } catch (e){
    logger.log("error", "Error updating survey response", {tag: "survey_response", "error-message": e.message, err:e } )
    return [500, {}]
  }
}

async function getLatestSurveyResponse(solNum) {
  try {
    // logger.log("debug", `Getting feedback for ${solNum}.  Results will be cached for 1 second`)
    logger.log("debug", `Getting feedback for ${solNum}.`)
    let survey_response = await SurveyResponse.findOne({ "where": { "solNum": solNum}, "order": [["createdAt", "DESC"]]})
    if (survey_response) {
      let user = await User.findOne( {"where": {"maxId": survey_response.maxId}})

      return [200, {responses: survey_response.response, solNum: solNum, date: survey_response.updatedAt, maxId: survey_response.maxId, name: `${user.firstName} ${user.lastName}`, email: user.email}]
    }
    return [404, []]

  } catch (e){
    e//?
    logger.log("error", "Error updating survey response", {tag: "survey_response", "error-message": e.message, err:e } )
    return [500,[]]
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
  getSurveyQuestions: (req, res) => {
    // return res.status(200).send(getMockSurvey());

    return Survey.findAll()
      .then((surveys) => {
        return res.status(200).send(surveys.map(s => makeOneSurvey(s)))
      })
      .catch((e) => {
        logger.log('error', 'error in: survey get', { error:e, tag: 'survey get' })
        res.status(400).send(e)
      })
  },

  /***
   * Gets the most recently submitted survey answers
   *
   * @param {Request} req
   * @param {Response} res
   * #return {Promise}
   *
   */
  get: async (req, res) => {
      let solNum = req.params.solNum || req.body.solNum.toString()
      let [statusCode, send] = await getLatestSurveyResponse(solNum)
      return res.status(statusCode).send(send)
  },

  /***
   * Saves a new survey response for the supplied solNum
   *
   * @param {Request} req
   * @param {Response} res
   * #return {Promise}
   *
   */
  postResponse: async (req, res) => {
    try {
      const solNum = req.params.solNum || req.body.solNum.toString()
      const response = req.body.response || req.body.feedback // the current API calls this "feedback" but we should accept either.
      const user = authRoutes.userInfoFromReq(req)

      let [statusCode, send] = await updateSurveyResponse(solNum, response, user.maxId)

      return res.status(statusCode).send(send)
    } catch (e) {
      logger.log("error", "Error updating survey response", {tag: "survey response", "error-message": e.message, err:e } )
      e.message //?
      return res.status(500).send({})
    }
  },

  updateSurveyResponse : updateSurveyResponse,
  getLatestSurveyResponse: getLatestSurveyResponse //memoize(getLatestSurveyResponse, { length: false, promise: true, maxAge: 1000})


}
