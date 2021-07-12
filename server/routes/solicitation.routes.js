/** @module SolicitationRoutes */

const logger = require('../config/winston')
// noinspection JSUnresolvedVariable
const Notice = require('../models').notice
const Solicitation = require('../models').Solicitation
const predictionRoute = require('../routes/prediction.routes')
const authRoutes = require('../routes/auth.routes')
const surveyRoutes = require('../routes/survey.routes')
const cloneDeep = require('clone-deep')
const {getConfig} = require('../config/configuration')
const { formatDateAsString } = require('../shared/time')



/**
 * API routes related to solicitations
 */

module.exports = function (db, userRoutes) {

  function buildAction(req, action_string) {
    return {
      "action": action_string,
      "date": formatDateAsString(new Date()),
      "status": action_string,
      "user": userRoutes.whoAmI(req)
    }
  }

  function auditSolicitationChange (sol_original, sol_updated, req) {
    let actions = cloneDeep(sol_original.action,true)
    let action_status = sol_original.actionStatus

    if (actions === null) {
      actions = []
    }

    try {
      if (sol_original.history && sol_updated.history) {
        let orig_hist_len = sol_original.history.length
        let up_hist_len = sol_updated.history.length

        if (up_hist_len > orig_hist_len) {
          if (sol_updated.history[up_hist_len - 1].action === getConfig('constants:EMAIL_ACTION')) {
            actions.push(buildAction(req, getConfig('constants:EMAIL_ACTION')))
          }
        }
      }

      // do we have feedback in the updated entry? If so, we may want to update the actions to say feedback added
      if (Array.isArray(sol_updated.feedback) && sol_updated.feedback.length > 0) {
        const orig_feedback = sol_original.feedback || []
        if (sol_updated.feedback.length !== orig_feedback.length) {
          logger.log("debug", "Set feedback action to " + getConfig('constants:FEEDBACK_ACTION'), { tag: "auditSolicitationChange", notice_updated: sol_updated, notice_orig: sol_original })
          actions.push(buildAction(req, getConfig('constants:FEEDBACK_ACTION')))
        }
      }

      // na_flag may sometimes be undefined. For those cases we need a || construct to
      // set it to false so we can make a fair comparison
      if( (sol_original.na_flag || false) !== (sol_updated.na_flag || false)) {
        if (sol_updated.na_flag) {
          actions.push(buildAction(req, getConfig('constants:NA_ACTION')))
          action_status = "Solicitation marked not applicable"
        } else {
          actions.push(buildAction(req, getConfig('constants:UNDO_NA_ACTION')))
          action_status = "Not applicable status removed"
        }
      }

    } catch (e) {
      logger.log ("error", "Caught an error trying to audit a solicitation change", {tag: "auditSolicitationChange", error: e.message} )
    }


    return [actions, action_status];
  }

  return {

    // app.get('/solicitation/:id', (req, res) => {
    //     Prediction.findById(req.params.id).then((solicitation) => {
    //         res.send(solicitation);
    //     }, (e) => {
    //         res.status(400).send(e);
    //     });
    // });

    /**
         * <b> GET /api/solicitation/:id </b> <br><br>
         *
         * Sends a object of type module:prediction.Prediction to the response.
         *
         * @param {Request} req
         * @param {Object} req.params
         * @param {string} req.params.id
         * @param res
         * @return Promise
         */
    get: async function (req, res) {

      try {
        let user = authRoutes.userInfoFromReq(req)
        let preds = await predictionRoute.getPredictions({filters : {id: { matchMode: "equals", value: req.params.id}}}, user)
        if (preds && preds.predictions.length > 0) {
          return res.status(200).send(preds.predictions[0])
        } else {
          return res.status(404).send({})
        }
      } catch (e) {
        e //?
        logger.log('error', 'error in: solicitation get', {error: e.message, tag: 'solicitation get'})
        return res.status(500).send('Error finding solicitation')
      }
    },


    /**
     * Updates some pieces of a solicitation.
     * Only changes the most recent entry in the Notice table.
     * Columns affected:
     *   na_flag
     *
     * @param {Request} req
     * @param {solicitation} req.body.solicitation
     * @param {Response} res
     * @return {Promise<T>|*}
     */

    update: async function(req, res) {
      // Be a GSA Admin or update sol from your org.

      try {
        let userInfo = authRoutes.userInfoFromReq(req)
        if (userInfo == null) {
          return res.status(401).send({msg: 'Not authorized'})
        }

        let solicitation = await Solicitation.findOne({where: {solNum: req.body.solicitation.solNum}})
        if (solicitation == null) {
          logger.log('error', req.body, {tag: 'postSolicitation - solicitation not found'})
          return res.status(404).send({msg: 'solicitation not found'})
        }

        if (userInfo.userRole !== 'Administrator' && userInfo.agency !== solicitation.agency) {
          return res.status(401).send({msg: 'Not authorized'})
        }

        // keep a clean copy to calculate NA changes for action status
        let original_sol = cloneDeep(solicitation.dataValues, true)

        if (solicitation.na_flag !== req.body.solicitation.na_flag) {
          let updated_action = []
          let updated_action_status = ""
          solicitation.na_flag = req.body.solicitation.na_flag;
          // setting the na_flag means we need to change the prediction (stored in reviewReq) to NA
          if (solicitation.na_flag) {
            solicitation.reviewRec = "Not Applicable"
            solicitation.history.push({date: formatDateAsString(new Date(), {zeroPad: true}), user: userInfo.firstName + ' ' + userInfo.lastName, action: "Solicitation marked as Not Applicable", status:""})
            solicitation.changed('history', true)
          } else {
            solicitation.reviewRec = (solicitation.predictions.value == "red") ? "Non-compliant (Action Required)" : "Compliant"
            solicitation.history.push({date: formatDateAsString(new Date(), {zeroPad: true}), user: userInfo.firstName + ' ' + userInfo.lastName, action: "Not Applicable marker removed", status:""})
            solicitation.changed('history', true)
          }
          [updated_action, updated_action_status] = auditSolicitationChange(original_sol, solicitation, req);
          solicitation.action =  updated_action;
          solicitation.actionStatus = updated_action_status
        }

        await solicitation.save()
        logger.log("info",
          `Updated solicitation ${solicitation.solNum}`,
          {
            tag: 'solicitation update',
            test_flag: req.body.solicitation.na_flag,
            na_flag: (solicitation.na_flag) ? "true" : "false"
          })
        return res.status(200).send(solicitation)
      } catch (error) {
        logger.log("error", "Error in solicitation update", {tag: 'solicitation update', error: error})
      }
    },

    auditSolicitationChange: auditSolicitationChange,


    /**
         * <b> POST /api/solicitation </b><br><br>
         *
         * Updates the history list of selected solicitation
         *
         * @param {Request} req
         * @param {Object} req.body
         * @param {string} req.body.solNum solicitation number (also known as notice number) of the record to update.
         * @param {Array(History)} req.body.history
         * @param {Array(Feedback)} req.body.feedback
         * @param res
         * @return {Promise}
         */
    postSolicitation: async function (req, res) {
      let rest = null


        //TODO: verify conversion to solicitations table.

        try {

            let solicitation = await Solicitation.findOne({
                where: {solNum: req.body.solNum.toString()},
            })

            if (solicitation == null) {
                logger.log('error', req.body, {tag: 'postSolicitation - solicitation not found'})
                return res.status(404).send({msg: 'solicitation not found'})
            }

            // first do the audit
            if (!Array.isArray(solicitation.action)) {
                solicitation.action = []
            }
            [solicitation.action, ...rest] = auditSolicitationChange(solicitation, req.body, req)

            //now that audit is done, we can update.
            solicitation.history = req.body.history


            try {
                let doc = await solicitation.save()
                let feedback = cloneDeep(req.body.feedback) || []
                if (req.body.newFeedbackSubmission && Array.isArray(feedback) && (feedback.length > 0)) {
                    await surveyRoutes.updateSurveyResponse(solicitation.solNum, feedback, authRoutes.userInfoFromReq(req).maxId)
                    solicitation.actionStatus = getConfig("constants:FEEDBACK_ACTION")
                }

                solicitation.save()

                let sol_plus_feedback = cloneDeep(solicitation.dataValues)
                let updated_feedback = await surveyRoutes.getLatestSurveyResponse(solicitation.solNum);
                sol_plus_feedback.feedback = updated_feedback[1].responses
                // solicitation.feedback = await surveyRoutes.getLatestSurveyResponse(solicitation.solNum)

                return res.status(200).send(sol_plus_feedback)
            } catch (e) {
                logger.log('error', 'error in: postSolicitation - error on save', {error: e, tag: 'postSolicitation - error on save' })
                res.status(400).send({msg: 'error updating solicitation'})
            }

        } catch(e) {
            logger.log('error', 'error in: postSolicitation - error during find', {error: e, tag: 'postSolicitation - error during find'
            })
            res.status(400).send({msg: 'error updating solicitation'})
        }
    }, // end postSolicitation

    /**
         * <b>POST /api/solicitation/feedback<b><br><br>
         *
         * Send a Array of Prediction Objects matching the parameters.
         * If a solicitation number is provide, send just that one element in the array
         *
         *
         * @param {Object} req
         * @param {Object} req.body
         * @param {string} req.body.solNum If provided, only respond with data for the given solicitation number
         * @param {string} req.body.$where MongoDB style selector. We only support feedback length
         * @param {Object} res
         * @return {Promise}
         *
         */
    solicitationFeedback: async (req, res) => {

        const [statusCode, data] = await surveyRoutes.getLatestSurveyResponse(req.body.solNum)
        return res.status(statusCode).send(data)

      // // translate mongo formatted parameters to postgres
      // let where = [' 1 = 1 ']
      // let limit = ''
      // let order = ''
      // if (req.body.solNum) {
      //   where.push(` solicitation_number = '${req.body.solNum}' `)
      //   limit = ' limit 1 ' // notice number should be unique, but isn't in the test data. Yikes!
      //   order = ' order by date desc ' // take the one with the most recent date
      // }
      // if (req.body['$where'] && req.body['$where'].match(/this.feedback.length.?>.?0/i)) {
      //   where.push(` jsonb_array_length(
      //                   case
      //                     when jsonb_typeof(feedback) = 'array' then feedback
      //                     else '[]'::jsonb
      //                   end
      //                ) > 0 `)
      // }
      //
      // let whereStr = where.join(' AND ')
      // let sql = `select * from notice where ${whereStr} ${order} ${limit}`
      //
      // return db.sequelize.query(sql, { type: db.sequelize.QueryTypes.SELECT })
      //   .then(async (notice) => {
      //     const result = []
      //     for (const n of notice) {
      //       const pred = await predictionRoute.makeOnePrediction(n)
      //       result.push(pred)
      //     }
      //     res.status(200).send(result)
      //   })
      //   .catch(e => {
      //     logger.log('error', 'error in: solicitationFeedback', { error:e, tag: 'solicitationFeedback' })
      //     res.status(400).send(e)
      //   })
    }

  }
}
