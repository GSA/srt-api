/** @module PredictionRoutes */
// noinspection JSUnresolvedVariable
/** @type {Prediction} **/
const Prediction = require('../models').Prediction
/** @type {Solicitation} **/
const Solicitation = require('../models').Solicitation
const SurveyResponse = require('../models').SurveyResponse
const notice_type = require('../models').notice_type
const Notice = require('../models').notice
const survey_routes = require('../routes/survey.routes')
const notice_type_utils = require('../shared/notice_type_utils')
const lodash = require('lodash');
/**
 * Prediction routes
 */
const logger = require('../config/winston')
const {performance, perfObserver} = require('../shared/perfMon')
const db = require('../models/index')
/**
 * @typedef {Object} SqlString
 * @property {function} escape
 */
const SqlString = require('sequelize/lib/sql-string')
const env = process.env.NODE_ENV || 'development'
const config = require('../config/config.js')[env]
const configuration = require('../config/configuration')
const getConfig = configuration.getConfig
const cloneDeep = require('clone-deep')
const Op = require('sequelize').Op
const authRoutes = require('./auth.routes')
const moment = require('moment')

let background_count = 0

/**
 * PredictionFilter
 * @typedef {Object} PredictionFilter
 * @property {string} agency Limit results to the given agency
 * @property {string} office Limit results to the given office
 * @property {string} solNum Solicitation number. Also known as notice number
 * @property {string} startDate Date in YYYY-MM-DD format
 * @property {string} endDate Date in YYYY-MM-DD format
 * @property {string} category_list - "Yes" or "No" value indicating if you want to receive IT Solicitation or non IT solicitations
 *
 *
 */

/**
 * A prediction object as expected by the client UI
 * @typedef {Object} Prediction
 * @property {Number} id - Database ID of the prediction. This value shouldn't be used if possible. It will refer to the id of the last notice row associated with this prediction.
 * @property {string} title - Solicitation title for this prediction
 * @property {string} url - Solicitation title for this prediction
 * @property {string} reviewRec - Prediction for the solicitation. One of "Compliant", "Non-compliant (Action Required)", or "Undetermined"
 * @property {string} numDocs - Number of attachments associated with the solicitation
 * @property {string} solNum - Notice number for this prediction
 * @property {string} noticeType - Notice type for the associated solicitation
 * @property {string} date - Date the solicitation was last updated in the database
 * @property {string} office - Office associated with the solicitation
 * @property {Object} predictions - Has one element named value of "RED" or "GREEN" for non / compliant solicitations. Don't know why it's a plural noun.
 * @property {EIT} category_list - Is the solicitation an IT solicitation?
 * @property {Number} undetermined - Boolean representation showing if the solicitation has an undetermined prediction. 0 for false (determined) and 1 for true (undetermined)
 * @property {action} action - Date/status of the last action. (quirk of the legacy code causes this to not be set until the second action occurs_
 * @property {string} actionStatus
 * @property {string} actionDate
 * @property {string} feedback
 * @property {string} history
 *
 * @property {Contact} contactInfo
 */

/**
 * A solicitation object as expected by the client UI
 * @typedef {Object} Solicitation
 * @property {Number} id - Database ID of the prediction. This value shouldn't be used if possible. It will refer to the id of the last notice row associated with this prediction.
 * @property {string} solNum - Notice number for this prediction
 * @property {boolean} active - Solicitation is active t/f
 */


/**
 * Action record
 * @typedef {Object} action - Status of the last action for a solicitation/prediction
 * @property {date} actionDate - Date the action occurred
 * @property {string} actionStatus - Text description of the action. ex. "Email sent to POC"
 */

/**
 * IT Likelihood record
 * @typedef {Object} EIT
 * @typedef {Object} EIT
 * @property {string} naics - NAICS number for the solicitation
 * @property {string} value - "Yes" if this solicitation is IT related or "No" if it is not
 */

/**
 * Contact record
 * @typedef {Object} Contact
 * @property {string} contact - "contact" value - not sure what this would be. Maybe the raw data from FedBizOps?
 * @property {string} name - contact name
 * @property {string} position - contact position
 * @property {string} email - contact email
 */

/**
 * Takes a notice row from the database and converts
 * it to a prediction record
 *
 * @param {Object} notice notice record from the database
 * @return {Prediction} prediction record built from the given notice row
 *
 */
/** @namespace notice.history */
/** @namespace notice.feedback */
/** @namespace notice.parseStatus */
/** @namespace notice.numDocs */
/** @namespace notice.attachment_json */
/** @namespace notice.spamProtect */
async function makeOnePrediction (notice) {
  performance.mark("makeOnePrediction-start")

  let o = {} // Object.assign({}, template);

  logger.log("debug", `makeOnePrediction starting for ${notice.solicitation_number}`)

  try {
    o.id = notice.id
    o.title = (notice.notice_data && notice.notice_data.subject) ? notice.notice_data.subject : 'title not available'
    o.url = (notice.notice_data !== undefined) ? notice.notice_data.url : ''
    o.agency = mapAgency(notice.agency)
    o.numDocs = (notice.attachment_json) ? notice.attachment_json.length : 0
    o.solNum = notice.solicitation_number
    o.noticeType = notice.notice_type
    if ( ! o.noticeType) {
      o.noticeType = 'Unknown'
      logger.log ("error", `Solicitation ${o.solNum} did not have a notice type`, {tag: "makeOnePrediction", notice: notice})
    }
    o.date = notice.date
    o.office = (notice.notice_data !== undefined) ? notice.notice_data.office : ''
    o.predictions = {
      value: (notice.na_flag) ? 'black' : (notice.compliant === 1) ? 'green' : 'red',
      history: [{
        date: notice.date,
        value: (notice.compliant === 1) ? 'green' : 'red'
      }]
    }
    o.na_flag = notice.na_flag
    if (o.na_flag) {
      o.reviewRec = "Not Applicable"
    } else {
      o.reviewRec = (notice.compliant === 1) ? 'Compliant' : 'Non-compliant (Action Required)'
    }
    o.category_list = {
      naics: notice.naics,
      value: 'Yes'
    }
    o.undetermined = 0 // (getRandomInt(0, 2) == 0);

    if (Array.isArray(notice.action) && notice.action.length > 0) {
      o.action = notice.action
      if (!Array.isArray(o.action)) {
        o.action = [o.action]
      }
    } else {
      o.action = [{ date: o.date, user: "", action: configuration.getConfig("constants:CREATED_ACTION"), status: "complete" }]
    }

    if (o.action != null && (Array.isArray(o.action)) && o.action.length > 0) {
      let a = o.action[o.action.length -1]
      o.actionStatus = a.action
      o.actionDate = a.date
    } else {
      o.actionStatus = o.actionDate = ''
    }

    // o.feedback = notice.feedback ? notice.feedback : []
    let [response_code, survey_response] = await survey_routes.getLatestSurveyResponse(notice.solicitation_number)
    o.feedback = notice.feedback ? notice.feedback : survey_response.responses
    o.history = notice.history ? notice.history : []

    let email = ''
    if (notice.notice_data && notice.notice_data.emails && notice.notice_data.emails.length) {
      // noinspection JSUnresolvedVariable
      if (config.spamProtect) {
        notice.notice_data.emails = notice.notice_data.emails.map(e => e + '.nospam')
      }
      email = notice.notice_data.emails.join(', ')
    }

    o.contactInfo = {
      contact: (notice.notice_data) ? notice.notice_data.contact : '',
      name: '',
      position: '',
      email: email

    }

    // add the posted date to each attachment
    const attachments = (notice.attachment_json !== undefined && notice.attachment_json != null) ? notice.attachment_json : []
    o.parseStatus = []
    const noticeList = []
    const date_map = {} // map from the notice ID to the posted date

    // first gather up all the notices so we can make a single query
    for (const attachment of attachments) {
      noticeList.push(attachment.notice_id);
    }

    // get the notices that are related to all the attachments
    notices = await Notice.findAll({where: {id: {[Op.in] : noticeList}}});
    for (const n of notices) {
      date_map[n.id] = n.date
    }

    // loop through the attachments and add in the postedDate to each one
    for (const attachment of attachments) {
      attachment.postedDate = date_map[attachment.notice_id]
      o.parseStatus.push(Object.assign(attachment))
    }

    o.searchText = [o.solNum, o.noticeType, o.title, o.date, o.reviewRec, o.actionStatus, o.actionDate, o.agency, o.office].join(' ').toLowerCase()
  } catch (e) {
    logger.log("error", "Error building a prediction object", {tag: "MakeOnePrediction", error: e.message, trace: e.stack})
  }

  performance.mark("makeOnePrediction-end")
  performance.measure(`makeOnePrediction-${notice.solicitation_number}`, "makeOnePrediction-start", "makeOnePrediction-end")

  return o
}

/**
 * Takes two arrays and returns an array containing a clone (not ref copy) of each element in the
 * two input arrays. Values in array a will come before values from b in the return
 *
 * @param {Array} a
 * @param {Array} b
 * @return {Array} - Array containing clean copies of all elements in a and b
 */
function deepConcat (a, b) {
  let res = []
  if (a !== null && a !== undefined && a.length !== undefined && a.length > 0) {
    for (let e of a) {
      res.push(Object.assign({}, e))
    }
  }
  if (b !== null && b !== undefined && b.length !== undefined && b.length > 0) {
    for (let e of b) {
      res.push(Object.assign({}, e))
    }
  }
  return res
}

/**
 * Merges two prediction. Necessary because the underlying database has multiple notice rows for each solicitation.
 * This merge function lets us sequentially merge each row from the notice table into a single prediction record.
 *
 * @param {Prediction} older Older prediction to be merged
 * @param {Prediction} newer Newer prediction to be merged. Newer single values will often overwrite older single values. Lists will be concatenated.
 * @return {Prediction} Prediction having merged data from the older and newer parameters.
 */
/** @namespace older.parseStatus */
function mergeOnePrediction (older, newer) {
  let merge = Object.assign({}, older, newer)

  // history and feedback should be merged oldest to newest
  merge.history = deepConcat(older.history, newer.history)
  merge.feedback = deepConcat(older.feedback, newer.feedback)
  merge.parseStatus = deepConcat(older.parseStatus, newer.parseStatus)

  merge.predictions = Object.assign({}, newer.predictions)
  merge.predictions.history = deepConcat(older.predictions.history, newer.predictions.history)
  merge.contactInfo = Object.assign({}, newer.contactInfo)

  merge.numDocs = older.numDocs + newer.numDocs

  if ((!newer.actionDate) || (!older.actionDate)) {
    merge.actionDate = older.actionDate || newer.actionDate
  } else {
    merge.actionDate = (older.actionDate > newer.actionDate) ? older.actionDate : newer.actionDate
  }

  return merge
}

/**
 * Takes in an array of Predictions and merges all the entries that have a matching solNum (aka notice number)
 *
 * @param predictionList possibly with duplicates
 * @return Array Merged prediction list
 */
function mergePredictions (predictionList) {
  performance.mark("mergePredictions-start")

  let merged = []
  let dupeIndex = {}

  for (let p of predictionList) {
    if (dupeIndex[p.solNum] !== undefined) {
      let indexOfDuplicate = dupeIndex[p.solNum]
      let newer = (merged[indexOfDuplicate].date > p.date) ? merged[indexOfDuplicate] : p
      let older = (merged[indexOfDuplicate].date > p.date) ? p : merged[indexOfDuplicate]
      merged[indexOfDuplicate] = mergeOnePrediction(older, newer)
    } else {
      merged.push(Object.assign({}, p))
      dupeIndex[ p.solNum ] = merged.length - 1
    }
  }

  performance.mark("mergePredictions-end")
  performance.measure("mergePredictions", "mergePredictions-start", "mergePredictions-end")

  return (Object.keys(merged)).map(key => merged[key])
}



/***
 * moves equality entries that were put directly in the filter to use the format PrimeNG uses
 *
 * @param filter
 * @param field
 */
function normalizeMatchFilter(filter, field){
  // special case: agency == 'government wide' means all agencies, so don't filter by that!
  if (field === 'agency' && filter[field] && filter[field].toLowerCase() === 'government-wide' ) {
    return;
  }

  if (filter[field]) {
    if ( filter.filters === undefined) { filter.filters = {} }
    filter.filters[field] = { value: filter[field] , matchMode: 'equals' }
  }
}

/**
 * Returns all predictions that match the given filter
 *
 *  * filter format:
 *   {
 *     first - offset to the first record to return
 *     rows - number of rows to return
 *     globalFilter - free text search
 *     filters - object describing the filters:
 *       {
 *         agency -
 *         solNum -
 *         startDate -
 *         endDate -
 *         sortField
 *         sortOrder
 *       }
 *     ignoreDateCutoff - if set to true, don't enforce the date cuttoff. Allows reporting on historical date
 *   }

 *
 * @param {PredictionFilter} filter Return predictions that match the given filter
 * @return {Promise<Array(Prediction)>} All predictions that match the filter
 */
/** @namespace filter.numDocs */
async function getPredictions (filter, user) {
  try {
    logger.debug("Starting getPredictions", { filter, userAgency: user?.agency, userRole: user?.userRole })
    
    let first = filter.first || 0
    let max_fetch_rows = filter.rows || configuration.getConfig("defaultMaxPredictions", 1000)

    if ( user === undefined || user.agency === undefined || user.userRole === undefined ) {
      logger.warn("Missing user information - returning empty result")
      return []
    }

    let attributes = {
      offset: first,
      limit: max_fetch_rows,
      include: [{
        model: SurveyResponse,
        as: 'feedback'
      }],
    }

    let types = configuration.getConfig("VisibleNoticeTypes", ['Solicitation', 'Combined Synopsis/Solicitation', 'RFQ'])
    logger.debug("Filtering by notice types", { types })
    
    attributes.where = {
      noticeType: {
        [Op.in]: types
      }
    }

    if (filter.globalFilter) {
      logger.debug("Applying global filter", { searchText: filter.globalFilter.toLowerCase() })
      attributes.where.searchText = { [Op.like]: `%${filter.globalFilter.toLowerCase()}%` }
    }

    for (let f of ['office', 'agency', 'title', 'solNum', 'reviewRec', 'id']) {
      normalizeMatchFilter(filter, f)
    }

    if (filter.filters) {
      logger.debug("Processing PrimeNG filters", { filters: filter.filters })
      for (let f in filter.filters) {
        if (filter.filters.hasOwnProperty(f) && filter.filters[f].matchMode === 'equals') {
          attributes.where[f] = {[Op.eq]: filter.filters[f].value}
          logger.debug(`Applied filter for field ${f}`, { value: filter.filters[f].value })
        }
      }
    }

    if (!filter.ignoreDateCutoff) {
      logger.debug("Applying date cutoff filters")
      if ((!filter.filters) || (!filter.filters.hasOwnProperty('solNum'))) {
        if (configuration.getConfig("minPredictionCutoffDate")) {
          const cutoffDate = configuration.getConfig("minPredictionCutoffDate")
          logger.debug("Using minPredictionCutoffDate", { cutoffDate })
          attributes.where.date = {[Op.gt]: cutoffDate}
        } else if (configuration.getConfig("predictionCutoffDays")) {
          const numDays = configuration.getConfig("predictionCutoffDays")
          const today = new Date()
          let cutoff = new Date()
          cutoff.setDate(today.getDate() - numDays)
          logger.debug("Using predictionCutoffDays", { numDays, cutoffDate: cutoff })
          attributes.where.date = {[Op.gt]: cutoff}
        }
      }
    }

    if (filter.startDate) {
      const start = Date.parse(filter.startDate)
      const cutoff = Date.parse(configuration.getConfig("minPredictionCutoffDate", '1990-01-01'))
      logger.debug("Processing start date filter", { startDate: filter.startDate, cutoffDate: cutoff })
      if (start > cutoff) {
        attributes.where.date = { [Op.gt]: filter.startDate }
      }
    }

    if (filter.endDate) {
      logger.debug("Processing end date filter", { endDate: filter.endDate })
      attributes.where.date = (attributes.where.date) ?
        Object.assign(attributes.where.date, { [Op.lt]: filter.endDate }) :
        { [Op.lt]: filter.endDate }
    }

    // Agency access control - check both agency and office fields
    if (!authRoutes.isGSAAdmin(user.agency, user.userRole)) {
      logger.debug("Restricting to user's agency and office", { agency: user.agency })
      attributes.where[Op.or] = [
        { agency: { [Op.eq]: user.agency } },
        { office: { [Op.eq]: user.agency } }
      ]
    } else {
      logger.debug("GSA Admin detected - no agency restriction applied")
    }

    // Set order
    attributes.order = []
    if (filter.sortField !== 'unsorted' && filter.sortField) {
      let direction = filter.sortOrder && filter.sortOrder < 0 ? 'DESC' : 'ASC'
      logger.debug("Applying sort", { field: filter.sortField, direction })
      attributes.order.push([filter.sortField, direction])
    }
    attributes.order.push(['id', 'DESC'])

    attributes.raw = true
    attributes.nest = true

    attributes.where = removeEmptyFrom(attributes.where)
    logger.debug("Final query attributes", { attributes })

    let preds = await Solicitation.findAndCountAll(attributes)
    logger.debug("Query complete", { 
      rowCount: preds.count, 
      firstRow: first, 
      maxRows: max_fetch_rows,
      returnedRows: preds.rows.length 
    })

    return {
      predictions: preds.rows,
      first: first,
      rows: Math.min(max_fetch_rows, preds.count),
      totalCount: preds.count
    }
  } catch (e) {
    logger.error("Error in getPredictions", { 
      error: e.message,
      stack: e.stack,
      filter,
      userAgency: user?.agency
    })
    return {
      predictions: [],
      first: 0,
      rows: 0,
      totalCount: 0
    }
  }
}

function mapAgency(agency) {
  const key = "AGENCY_MAP:" + agency
  const mapped = configuration.getConfig(key, null)
  return (mapped) ? mapped : agency
}

/***
 * Invalidates a
 *
 * @param sol_num
 * @returns {Promise<number>}
 */
async function invalidate (sol_num) {
  let sql = `delete from "Predictions" where "solNum" = '${sol_num}' `
  await db.sequelize.query(sql, { type: db.sequelize.QueryTypes.SELECT })
  return updatePredictionTable()
}


/**
 * prediction routes
 */
module.exports = {

  getPredictions: getPredictions,
  mergePredictions: mergePredictions,
  makeOnePrediction: makeOnePrediction,
  updatePredictionTable: updatePredictionTable,
  mapAgency: mapAgency,
  invalidate: invalidate,
  prepareSolicitationTable: prepareSolicitationTable,

/**
     * Finds all the predictions that match the filter and send them out to the response.
     *
     * @param {Object} req
     * @param {PredictionFilter} req.body
     * @param {{set: *, json: *, send: *, status: *}} res
     * @return {Promise}
     */
  predictionFilter: function (req, res) {
    let data = []

    // currently unsupported filters
    // let parseStatus = req.body.parsing_report
    // let contactInfo = req.body.contactInfo
    // let reviewRec = req.body.reviewRec
    // let reviewStatus = req.body.reviewStatus

    let keys = Object.keys(req.body)

    // verify that only supported filter params are used
    let validKeys = ['agency', 'office', 'numDocs', 'solNum', 'category_list', 'startDate', 'fromPeriod', 'endDate', 'toPeriod', 'noticeType']
    // add in the keys used by the PrimeNG table lazy loader
    validKeys.push('first', 'filters', 'globalFilter', 'multiSortMeta', 'rows', 'sortField', 'sortOrder')
    for (let i = 0; i < keys.length; i++) {
      if (req.body[keys[i]] !== '' && !validKeys.includes(keys[i])) {
        logger.log('error', 'Received unsupported filter parameter '+ keys[i], { body: req.body, tag: 'predictionFilter'})
        return res.status(500).send({ message: 'Received unsupported filter parameter ' + keys[i] })
      }
    }

    // We should support these keys, but currently don't due to the issue with duplicate notice_numbers
    let unsupportedKeys = ['numDocs', 'parseStatus', 'contactInfo', 'reviewRec', 'reviewStatus']
    if (keys
      .map(k => unsupportedKeys.includes(k) && (req.body[k] !== ''))
      .reduce((accum, current) => accum || current, false)) {
      return res.status(501).send('The server does not yet support filter by ' + JSON.stringify(unsupportedKeys))
    }

    // if there isn't any bounding on the result count, limit it to the first 100
    req.body.first = (req.body.first !== undefined) ? req.body.first : 0
    req.body.rows = (req.body.rows !== undefined) ? req.body.rows : 100
    let user = authRoutes.userInfoFromReq(req)

    return getPredictions(req.body, user)
      .then((predictions) => {
        if (predictions == null) {
          return res.status(500).send({})
        }
        return res.status(200).send(predictions)
      })
      .catch(e => {
        logger.log('error', 'error in: predictionFilter', { error:e, tag: 'predictionFilter' })
        return res.status(500).send(data)
      })
  },

}

async function prepareSolicitationTable() {
  try {
    await db.sequelize.query(`
        insert into solicitations ("solNum", "createdAt", "updatedAt")
         (select distinct solicitation_number, to_timestamp('2010-10-10', 'YYYY-MM-DD') at time zone 'Etc/UTC' ,  to_timestamp('2010-10-10', 'YYYY-MM-DD') at time zone 'Etc/UTC' 
          from notice
          where solicitation_number not in (select "solNum" from solicitations)   )
    `)
  } catch (e) {
    logger.log("error", "Error preparing the solication table", {tag: "prepareSolTable", error: e})
    throw (e)
  }
}

async function updatePredictionTable  (clearAllAfterDate, background = false) {
  return;
  // performance.mark("updatePredictionTable-start")
  //
  // let fetch_limit = 10
  //
  // if (background) {
  //   background_count -= 1
  //   logger.info (`starting a background job.  background count is now ${background_count} in the queue`)
  // }
  //
  // logger.debug(`starting updatePredictionTable. Clear all after date set to ${clearAllAfterDate}`, {tag: "updatePredictionTable"})
  //
  // if (clearAllAfterDate) {
  //   let sql = `delete from "Predictions" where "updatedAt" > '${clearAllAfterDate}' `
  //   logger.debug(`Clearing all predictions after ${clearAllAfterDate}`, {tag: "updatePredictionTable", sql: sql})
  //   // noinspection JSUnresolvedFunction
  //   await db.sequelize.query(sql, { type: db.sequelize.QueryTypes.SELECT })
  // }
  //
  // await prepareSolicitationTable()
  //
  // // lets try only running for max number of seconds before returning
  // const maxSeconds = getConfig("updatePredictionTableMaxRunTime", 10)
  // const queueDelaySeconds = getConfig("updatePredictionTableQueueDelay", 30)
  //
  //
  // const start = new Date()
  // const startSeconds = Math.round(start.getTime() / 1000)
  // let now = new Date()
  // let nowSeconds = Math.round(now.getTime() / 1000)
  //
  // let actualCount = 0
  // let outdatedPredictions = await getOutdatedPrediction(fetch_limit)
  // let msg = (outdatedPredictions.length < fetch_limit)
  //   ? `${outdatedPredictions.length}`
  //   : `${outdatedPredictions.length}+`
  //   logger.debug(`there are ${msg} outdated predictions to update`)
  //
  // let timeout = false
  // while (outdatedPredictions && outdatedPredictions.length > 0 ) {
  //   if ((nowSeconds - startSeconds) > maxSeconds) {
  //     timeout = true
  //     break
  //   }
  //   now = new Date()
  //   nowSeconds = Math.round(now.getTime() / 1000)
  //   actualCount ++
  //   let pred = outdatedPredictions.pop()
  //   pred.actionDate = makeDate(pred.actionDate)
  //   pred.date = makeDate(pred.date)
  //
  //
  //   try {
  //     // get it's active/inactive status from the solicitations table
  //     let sol_row = await db.sequelize.query(`select active from solicitations where "solNum" = :sn`, { replacements: {"sn": pred.solNum}, type: db.sequelize.QueryTypes.SELECT })
  //     pred.active = sol_row[0]['active']
  //
  //     logger.log("debug", `Rebuilding prediction ${pred.solNum}`, {tag:'updatePredictionTable', prediction: pred})
  //     delete (pred.id) // remove the id since that should be auto-increment
  //     // noinspection JSCheckFunctionSignatures
  //     await Prediction.destroy({ where: { solNum: pred.solNum } }) // delete any outdated prediction
  //     // noinspection JSUnresolvedFunction
  //     await Prediction.create(pred);
  //
  //     // await prepareSolicitationTable()
  //
  //   } catch(e) {
  //     logger.log("error", "problem updating the prediction table", {tag: 'updatePredictionTable', "error-message": e.message, error: e})
  //   }
  //
  //   // we only get a few at a time so check to see if there are more when we run out of the current batch
  //   if (outdatedPredictions.length === 0) {
  //     outdatedPredictions = await getOutdatedPrediction(fetch_limit)
  //   }
  //
  //   if ((actualCount % 100) === 0) {
  //     logger.log("info", `Updated ${actualCount} prediction records.`)
  //   }
  // }
  // if (actualCount > 0) {
  //   logger.log("info", `Updated ${actualCount} prediction records`)
  // }
  //
  // if (timeout && background_count == 0) {
  //   background_count += 1
  //   const queueDelayMilliseconds = queueDelaySeconds * 1000
  //   logger.log("info", `Prediction update hit time of ${maxSeconds} seconds limit - queuing another round of updates in ${queueDelaySeconds}. ${background_count} in the queue`)
  //   setTimeout( function() { updatePredictionTable(null, true) } , queueDelayMilliseconds)
  // }
  //
  // performance.mark("updatePredictionTable-end")
  // performance.measure("updatePredictionTable", "updatePredictionTable-start", "updatePredictionTable-end")
  //
  //   return actualCount
}

async function getOutdatedPrediction(fetch_limit = 500) {

  try {
    performance.mark("getOutdatedPrediction-start")

    let sql = `
            select n.*, notice_type, attachment_json
            from notice n
            left join (
                  select notice_id, json_agg(src) as attachment_json, count(*) as attachment_count
                  from notice
                  left join (
                    select id, attachment_url, filename as name, case machine_readable when true then 'successfully parsed' else 'processing error' end as status, notice_id
                    from attachment
                    ) src on notice.id = src.notice_id
                  group by  notice_id
                  ) a on a.notice_id = n.id
            left join notice_type t on n.notice_type_id = t.id
                WHERE solicitation_number IN
                  ( 
                      (SELECT DISTINCT solicitation_number
                       FROM notice nn
                       LEFT JOIN "Predictions" pp on pp."solNum" = nn.solicitation_number
                       WHERE (COALESCE (nn."updatedAt", nn."createdAt") > pp."updatedAt" or
                             pp."updatedAt" is null) and
                             nn.solicitation_number != '' and nn.solicitation_number is not null
                        limit ${fetch_limit} )

                  UNION
                      
                    (SELECT DISTINCT solicitations."solNum"
                     FROM solicitations
                              LEFT JOIN "Predictions" pp on pp."solNum" = solicitations."solNum"
                     WHERE (COALESCE(solicitations."updatedAt", solicitations."createdAt") > pp."updatedAt" or
                            pp."updatedAt" is null)  
                     limit ${fetch_limit} )
                      
                  UNION

                    (SELECT DISTINCT sr."solNum"
                     FROM survey_responses sr
                              LEFT JOIN "Predictions" pp on pp."solNum" = sr."solNum"
                     WHERE (COALESCE(sr."updatedAt", sr."createdAt") > pp."updatedAt" or
                            pp."updatedAt" is null)
                     limit ${fetch_limit} )
                      
                ) and solicitation_number is not null and solicitation_number != ''
             `

    let notices = await db.sequelize.query(sql, {type: db.sequelize.QueryTypes.SELECT})

    let data = []
    let message = "Found the following outdated solicitations: "
    for (let i = 0; i < notices.length; i++) {
      data[i] = cloneDeep(await makeOnePrediction(notices[i]))
      message += " " + data[i].solNum
    }
    logger.log("debug", message)

    performance.mark("getOutdatedPrediction-end")
    performance.measure("getOutdatedPrediction", "getOutdatedPrediction-start", "getOutdatedPrediction-end")

    return mergePredictions(data)

  } catch (e) {
    logger.log('error', 'error in: getOutdatedPrediction', {error: e, tag: 'getOutdatedPrediction', sql: sql})
    return null
  }
}

function makeDate(x) {
  let d
  if (x === undefined || x === '') {
    d = new Date(2000,1,1)
  } else {
    d = new Date(x)
  }
  return moment(d).format('MM/DD/YYYY HH:mm ZZ')
}

function removeEmptyFrom(where) {
  // Loop through the where object and remove any empty objects
  for (let key in where) {
    // Looking at the individual sequelize.Op objects
    for (let o in where[key]) {
      if (lodash.isEmpty(where[key][o])) {
        logger.debug("Deleting key " + key)
        delete where[key];
      }
    }
  }
  return where;
}
