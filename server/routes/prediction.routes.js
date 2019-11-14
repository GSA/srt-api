/** @module PredictionRoutes */
const Prediction = require('../models').Prediction

/**
 * Prediction routes
 */
const logger = require('../config/winston')
const db = require('../models/index')
/**
 * @typedef {Object} SqlString
 * @property {function} escape
 */
const SqlString = require('sequelize/lib/sql-string')
const env = process.env.NODE_ENV || 'development'
const config = require('../config/config.js')[env]
const cloneDeep = require('clone-deep')
const Op = require('sequelize').Op

/**
 * PredictionFilter
 * @typedef {Object} PredictionFilter
 * @property {string} agency Limit results to the given agency
 * @property {string} office Limit results to the given office
 * @property {string} solNum Solicitation number. Also known as notice number
 * @property {string} startDate Date in YYYY-MM-DD format
 * @property {string} endDate Date in YYYY-MM-DD format
 * @property {string} eitLikelihood - "Yes" or "No" value indicating if you want to receive IT Solicitation or non IT solicitations
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
 * @property {EIT} eitLikelihood - Is the solicitation an IT solicitation?
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
 * Action record
 * @typedef {Object} action - Status of the last action for a solicitation/prediction
 * @property {date} actionDate - Date the action occurred
 * @property {string} actionStatus - Text description of the action. ex. "Email sent to POC"
 */

/**
 * IT Likelihood record
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
function makeOnePrediction (notice) {
  let o = {} // Object.assign({}, template);

  o.id = notice.id
  o.title = (notice.notice_data && notice.notice_data.subject) ? notice.notice_data.subject : 'title not available'
  o.url = (notice.notice_data !== undefined) ? notice.notice_data.url : ''
  o.agency = notice.agency
  o.numDocs = (notice.attachment_json) ? notice.attachment_json.length : 0
  o.solNum = notice.solicitation_number
  o.noticeType = notice.notice_type
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
  o.eitLikelihood = {
    naics: notice.naics,
    value: 'Yes'
  }
  o.undetermined = 0 // (getRandomInt(0, 2) == 0);
  o.action = notice.action
  o.actionStatus = (o.action != null) ? o.action.actionStatus : ''
  o.actionDate = (o.action != null) ? o.action.actionDate : ''
  o.feedback = notice.feedback ? notice.feedback : []
  o.history = notice.history ? notice.history : []

  let email = ''
  if (notice.notice_data && notice.notice_data.emails && notice.notice_data.emails.length) {
    if (config.spamProtect) {
      notice.notice_data.emails = notice.notice_data.emails.map(e => e + '.nospam')
    }
    email = notice.notice_data.emails.join(', ')
  }

  o.contactInfo = {
    contact: (notice.notice_data) ? notice.notice_data.contact : '',
    name: 'Contact Name',
    position: 'Position',
    email: email

  }

  o.parseStatus = (notice.attachment_json !== undefined && notice.attachment_json != null) ? notice.attachment_json : []

  o.searchText = [o.solNum, o.noticeType, o.title, o.date, o.reviewRec, o.actionStatus, o.actionDate, o.agency, o.office].join(' ').toLowerCase()

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
 * @param {PredictionFilter} filter Return predictions that match the given filter
 * @return {Promise<Array(Prediction)>} All predictions that match the filter
 */
/** @namespace filter.numDocs */
async function getPredictions (filter) {


  await updatePredictionTable()

  let attributes = {
    offset: filter.first,
    limit:filter.rows
  }

  // filter out rows
  if (filter.globalFilter) {
    if (attributes.where === undefined) { attributes.where = {} }
    attributes.where.searchText = { [Op.like]: `%${filter.globalFilter.toLowerCase()}%` }
  }
  for (let f of ['office', 'agency', 'title', 'solNum', 'reviewRec' ]) {
    normalizeMatchFilter(filter, f)
  }

  // process PrimeNG filters: filter.filters = { field: { value: 'x', matchMode: 'equals' } }
  if (filter.filters) {
    for (f in filter.filters) {
      if (filter.filters[f].matchMode == 'equals') {
        if (attributes.where === undefined) { attributes.where = {} }
        attributes.where[f] = filter.filters[f].value
      }
    }
  }


  // process dates
  if (filter.startDate) {
    if (attributes.where === undefined) { attributes.where = {} }
    attributes.where.date =  { [Op.gt] : filter.startDate }
  }
  if (filter.endDate) {
    if (attributes.where === undefined) { attributes.where = {} }
    attributes.where.date = (attributes.where.date) ?
      Object.assign(attributes.where.date, { [Op.lt] : filter.endDate }) :
      { [Op.lt] : filter.endDate }
  }

  // set order
  attributes.order = []
  if (filter.sortField !== 'unsorted' && filter.sortField){
    filter.sortField
    attributes.order.push([filter.sortField ] )
    if (filter.sortOrder && filter.sortOrder < 0 ) {
      attributes.order[0].push('DESC')
    }
  }
  attributes.order.push( [ 'id' ] ) // always end with an order by id to keep the ordering deterministic

  let preds = await Prediction.findAll( attributes )

  return {
    predictions: preds,
    first: filter.first,
    rows: Math.min(filter.rows,preds.length),
    totalCount: preds.length
  }
}

/**
 * prediction routes
 */
module.exports = {

  getPredictions: getPredictions,
  mergePredictions: mergePredictions,
  makeOnePrediction: makeOnePrediction,
  updatePredictionTable: updatePredictionTable,

  /**
     * Finds all the predictions that match the filter and send them out to the response.
     *
     * @param {Object} req
     * @param {PredictionFilter} req.body
     * @param {Response} res
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
    let validKeys = ['agency', 'office', 'numDocs', 'solNum', 'eitLikelihood', 'startDate', 'fromPeriod', 'endDate', 'toPeriod']
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

    // if there isn't any bouding on the result count, limit it to the first 100
    req.body.first = (req.body.first !== undefined) ? req.body.first : 0
    req.body.rows = (req.body.rows !== undefined) ? req.body.rows : 100

    return getPredictions(req.body)
      .then((predictions) => {
        if (predictions == null) {
          return res.status(500).send({})
        }
        return res.status(200).send(predictions)
      })
      .catch(e => {
        logger.log('error', 'error in: predictionFilter', { error:e, tag: 'predictionFilter' })
        e //?
        return res.status(500).send(data)
      })
  },

}


async function updatePredictionTable  () {

  let actualCount = 0
  let outdatedPredictions = await getOutdatedPrediction()
  while (outdatedPredictions && outdatedPredictions.length > 0) {
    actualCount ++
    let pred = outdatedPredictions.pop()
    pred.actionDate = makeDate(pred.actionDate)
    pred.date = makeDate(pred.date)

    // TODO: fix race condition
    try {
      delete (pred.id) // remove the id since that should be auto-increment
      await Prediction.destroy({ where: { solNum: pred.solNum } }) // delete any outdated prediction
      await Prediction.create(pred);
    } catch(e) {
      e //?
      logger.log("error", "problem updating the prediction table", {tag: 'updatePredictionTable', error: e})
    }

    if (outdatedPredictions.length == 0) {
      outdatedPredictions = await getOutdatedPrediction()
    }
  }
  logger.log("info", `Updated ${actualCount} prediction records`)
  return actualCount
}

function getOutdatedPrediction() {

  let sql = `select n.*, notice_type, attachment_json
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
                  (SELECT DISTINCT solicitation_number
                   FROM notice nn
                   LEFT JOIN "Predictions" pp on pp."solNum" = nn.solicitation_number
                   WHERE (nn."updatedAt" > pp."updatedAt" or
                         pp."updatedAt" is null) and
                         nn.solicitation_number != '' and nn.solicitation_number is not null limit 1000)`

  return db.sequelize.query(sql, { type: db.sequelize.QueryTypes.SELECT })
    .then(notices => {
      let data = []
      for (let i = 0; i < notices.length; i++) {
        data[i] =cloneDeep(makeOnePrediction(notices[i]))
      }
      let merged = mergePredictions(data)
      return merged
    })
    .catch(e => {
      e //?
      logger.log('error', 'error in: getOutdatedPrediction', { error:e, tag: 'getOutdatedPrediction', sql: sql })
      return null
    })
}

function makeDate(x) {
  let d
  if (x == undefined || x == '') {
    d = new Date(2000,1,1)
  } else {
    d = new Date(x)
  }
  return  d.toLocaleDateString() + ' ' + d.toLocaleTimeString()
}

