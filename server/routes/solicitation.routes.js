/** @module SolicitationRoutes */

const logger = require('../config/winston')
// noinspection JSUnresolvedVariable
const Notice = require('../models').notice
const predictionRoute = require('../routes/prediction.routes')
const authRoutes = require('../routes/auth.routes')
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

  function auditSolicitationChange (notice_orig, notice_updated, req) {
    let actions = cloneDeep(notice_orig.action,true)

    if (actions === null) {
      console.log ('null action')
      actions = []
    }

    try {
      if (notice_orig.history && notice_updated.history) {
        let orig_hist_len = notice_orig.history.length
        let up_hist_len = notice_updated.history.length

        if (up_hist_len > orig_hist_len) {
          if (notice_updated.history[up_hist_len - 1].action === getConfig('constants:EMAIL_ACTION')) {
            actions.push(buildAction(req, getConfig('constants:EMAIL_ACTION')))
          }
        }
      }

      // do we have feedback in the updated entry? If so, we may want to update the actions to say feedback added
      if (Array.isArray(notice_updated.feedback) && notice_updated.feedback.length > 0) {
        const orig_feedback = notice_orig.feedback || []
        if (notice_updated.feedback.length !== orig_feedback.length) {
          logger.log("debug", "Set feedback action to " + getConfig('constants:FEEDBACK_ACTION'), { tag: "auditSolicitationChange", notice_updated: notice_updated, notice_orig: notice_orig })
          actions.push(buildAction(req, getConfig('constants:FEEDBACK_ACTION')))
        }
      }

      // na_flag may sometimes be undefined. For those cases we need a || construct to
      // set it to false so we can make a fair comparison
      if( (notice_orig.na_flag || false) !== (notice_updated.na_flag || false)) {
        if (notice_updated.na_flag) {
          actions.push(buildAction(req, getConfig('constants:NA_ACTION')))
        } else {
          actions.push(buildAction(req, getConfig('constants:UNDO_NA_ACTION')))
        }
      }

    } catch (e) {
      logger.log ("error", "Caught an error trying to audit a solicitation change", {tag: "auditSolicitationChange", error: e.message} )
    }


    return actions;
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
    get: function (req, res) {
      return Notice.findByPk(req.params.id)
        .then((notice) => {
          if ( ! notice ) {  // no notice found with that ID
            return res.status(404).send({})
          }
          let user = authRoutes.userInfoFromReq(req)
          return predictionRoute.getPredictions({ solNum: notice.solicitation_number }, user)
            .then(result => {
              // we should only have one 'prediction' since they will all merge by solicitation number
              // but for consistency we should set the ID number to the one requested rather than to
              // a pseudo-random choice
              result.predictions[0].id = parseInt(req.params.id)

              return res.status(200).send(result.predictions[0])
            })
        })
        .catch((e) => {
          e //?
          logger.log('error', 'error in: solicitation get', { error:e.message, tag: 'solicitation get' })
          return res.status(500).send('Error finding solicitation')
        })
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

    update: function(req, res) {
      // Be a GSA Admin or update sol from your org.

      let userInfo = authRoutes.userInfoFromReq(req)
      if (userInfo == null) {
        return res.status(401).send({ msg: 'Not authorized' })
      }

      return Notice.findAll({
        where: {solicitation_number: req.body.solicitation.solNum},
        order: [['date', 'desc']]
      })
        .then( (notices) => {
          // we are only going to work with the first entry - which is the newest row having the given notice_number
          let notice = (notices.length > 0) ? notices[0] : null
          if (notice == null) {
            logger.log('error', req.body, { tag: 'postSolicitation - solicitation not found' })
            return res.status(404).send({ msg: 'solicitation not found' })
          }

          // check that we are allowed to update this one
          if (userInfo.userRole !== 'Administrator' && userInfo.agency !== notice.agency ) {
            return res.status(401).send({ msg: 'Not authorized' })
          }

          // keep a clean copy to calculate NA changes for action status
          let original_notice = cloneDeep(notice.dataValues, true)

          if (notice.na_flag !== req.body.solicitation.na_flag) {
            notice.na_flag = req.body.solicitation.na_flag
            notice.action = auditSolicitationChange(original_notice, notice, req)
          }




          return notice.save()
            .then( (n) => {
              // noinspection JSUnresolvedVariable
              logger.log("info",
                `Updated Notice row for solicitation ${notice.solicitation_number}`,
                {
                      tag: 'solicitation update',
                      test_flag: req.body.solicitation.na_flag,
                      na_flag: (n.na_flag) ? "true" : "false"
                })
              return res.status(200).send(predictionRoute.makeOnePrediction(n))
            })
            .catch (error => {
              logger.log("error", "Error in solicitation update", {tag: 'solicitation update', error: error})
            })

        })
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
    postSolicitation: function (req, res) {

      return Notice.findAll({
        where: { solicitation_number: req.body.solNum.toString() },
        order: [['date', 'desc']]
      })
        .then((notices) => {
          // we are only going to work with the first entry - which is the newest row having the given notice_number
          /** @var Notice notice */
          let notice = (notices.length > 0) ? notices[0] : null
          if (notice == null) {
            logger.log('error', req.body, { tag: 'postSolicitation - solicitation not found' })
            return res.status(404).send({ msg: 'solicitation not found' })
          }

          // first do the audit
          if (! Array.isArray(notice.action)){
            notice.action = []
          }
          notice.action = auditSolicitationChange(notice, req.body, req)

          //now that audit is done, we can update.
          notice.history = req.body.history
          notice.feedback = cloneDeep(req.body.feedback)


          // noinspection JSUnresolvedFunction
          return notice.save()
            .then((doc) => {
              return res.status(200).send(predictionRoute.makeOnePrediction(doc))
            })
            .catch((e) => {
              logger.log('error', 'error in: postSolicitation - error on save', { error:e, tag: 'postSolicitation - error on save' })
              res.status(400).send({ msg: 'error updating solicitation' })
            })
        })
        .catch((e) => {
          logger.log('error', 'error in: postSolicitation - error during find', { error:e, tag: 'postSolicitation - error during find' })
          res.status(400).send({ msg: 'error updating solicitation' })
        })
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
    solicitationFeedback: (req, res) => {
      // translate mongo formatted parameters to postgres
      let where = [' 1 = 1 ']
      let limit = ''
      let order = ''
      if (req.body.solNum) {
        where.push(` solicitation_number = '${req.body.solNum}' `)
        limit = ' limit 1 ' // notice number should be unique, but isn't in the test data. Yikes!
        order = ' order by date desc ' // take the one with the most recent date
      }
      if (req.body['$where'] && req.body['$where'].match(/this.feedback.length.?>.?0/i)) {
        where.push(` jsonb_array_length(
                        case
                          when jsonb_typeof(feedback) = 'array' then feedback
                          else '[]'::jsonb
                        end
                     ) > 0 `)
      }

      let whereStr = where.join(' AND ')
      let sql = `select * from notice where ${whereStr} ${order} ${limit}`

      return db.sequelize.query(sql, { type: db.sequelize.QueryTypes.SELECT })
        .then((notice) => {
          res.status(200).send(notice.map(predictionRoute.makeOnePrediction))
        })
        .catch(e => {
          logger.log('error', 'error in: solicitationFeedback', { error:e, tag: 'solicitationFeedback' })
          res.status(400).send(e)
        })
    }

  }
}
