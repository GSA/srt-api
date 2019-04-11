/** @module SolicitationRoutes */

const logger = require('../config/winston')
// noinspection JSUnresolvedVariable
const Notice = require('../models').notice
const predictionRoute = require('../routes/prediction.routes')

/**
 * API routes related to solicitations
 */

module.exports = function (db) {
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
      return Notice.findById(req.params.id)
        .then((notice) => {
          return predictionRoute.getPredictions({ solNum: notice.solicitation_number })
            .then(predictions => {
              return res.status(200).send(predictions[0]) // we should only have one since they will all merge by solicitation number
            })
        })
        .catch((e) => {
          logger.log('error', e, { tag: 'solicitation get' })
          return res.status(400).send('Error finding solicitation')
        })
    },

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
      let status = req.body.history.filter(function (e) {
        return e['status'] !== ''
      })

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

          notice.history = req.body.history
          notice.feedback = req.body.feedback
          if (status.length > 1) {
            notice.action = {
              actionStatus: status[status.length - 1]['status'],
              actionDate: status[status.length - 1]['date']
            }
          }
          // noinspection JSUnresolvedFunction
          return notice.save()
            .then((doc) => {
              // logger.log("error", predictionRoute.makeOnePrediction(doc) , {tag:"notice"})
              return res.status(200).send(predictionRoute.makeOnePrediction(doc))
            })
            .catch((e) => {
              logger.log('error', e, { tag: 'postSolicitation - error on save' })
              res.status(400).send({ msg: 'error updating solicitation' })
            })
        })
        .catch((e) => {
          logger.log('error', e, { tag: 'postSolicitation - error during find' })
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
        where.push(` jsonb_array_length(feedback) > 0 `)
      }

      let whereStr = where.join(' AND ')
      let sql = `select * from notice where ${whereStr} ${order} ${limit}`

      return db.sequelize.query(sql, { type: db.sequelize.QueryTypes.SELECT })
        .then((notice) => {
          res.status(200).send(notice.map(predictionRoute.makeOnePrediction))
        })
        .catch(e => {
          logger.log('error', e, { tag: 'solicitationFeedback' })
          res.status(400).send(e)
        })
    }

  }
}
