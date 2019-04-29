/** @module PredictionRoutes */

/**
 * Prediction routes
 */
const logger = require('../config/winston')
const db = require('../models/index')
const SqlString = require('sequelize/lib/sql-string')
const path = require('path')
const env = process.env.NODE_ENV || 'development'
const config = require(path.join(__dirname, '/../config/config.json'))[env]

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
  o.title = (notice.notice_data !== undefined && notice.notice_data.subject !== undefined ) ? notice.notice_data.subject : 'filename not available'
  o.url = (notice.notice_data !== undefined) ? notice.notice_data.url : ''
  o.reviewRec = (notice.compliant === 1) ? 'Compliant' : 'Non-compliant (Action Required)'
  o.agency = notice.agency
  o.numDocs = (notice.attachment_json) ? notice.attachment_json.length : 0
  o.solNum = notice.solicitation_number
  o.noticeType = notice.notice_type
  o.date = notice.date
  o.office = (notice.notice_data !== undefined) ? notice.notice_data.office : ''
  o.predictions = {
    value: (notice.compliant === 1) ? 'GREEN' : 'RED'
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
  let merged = {}

  for (let p of predictionList) {
    if (merged[p.solNum]) {
      let newer = (merged[p.solNum].date > p.date) ? merged[p.solNum] : p
      let older = (merged[p.solNum].date > p.date) ? p : merged[p.solNum]
      merged[p.solNum] = mergeOnePrediction(older, newer)
    } else {
      merged[p.solNum] = Object.assign({}, p)
    }
  }

  return (Object.keys(merged)).map(key => merged[key])
}

/**
 * Helper function to convert a date string to YYYY-MM-DD format
 * @param {string} origDate - date in either MM/DD/YYYY or MM-DD-YYYY format
 * @return {string} date in YYYY-MM-DD format
 */
function makePostgresDate (origDate) {
  let split = origDate.split('/')
  if (split.length < 3) {
    split = origDate.split('-')
  }
  if (split.length < 3) { return '' }
  if (split[0] > 1900) {
    // looks like it may have already been in year-month-day format
    return origDate
  }
  return split[2] + '-' + split[0] + '-' + split[1]
}

/**
 * Returns all predictions that match the given filter
 *
 * @param {PredictionFilter} filter Return predictions that match the given filter
 * @return {Promise<Array(Prediction)>} All predictions that match the filter
 */
/** @namespace filter.numDocs */
function getPredictions (filter) {
  let agency = (filter.agency) ? filter.agency.split(' (')[0] : undefined
  let office = filter.office
  let numDocs = filter.numDocs
  let solNum = filter.solNum
  let startDate = (filter.startDate) ? filter.startDate : filter.fromPeriod
  let endDate = (filter.endDate) ? filter.endDate : filter.toPeriod
  let eitLikelihood = filter.eitLikelihood

  let whereArray = ['1 = 1']
  if (office && office !== '') {
    whereArray.push("notice_data->>'office' = " + SqlString.escape(office, null, 'postgres'))
  }
  if (agency && agency !== '' && agency !== 'Government-wide') {
    whereArray.push('agency = ' + SqlString.escape(agency, null, 'postgres'))
  }
  if (numDocs && numDocs !== '') {
    whereArray.push('attachment_count = ' + SqlString.escape(numDocs, null, 'postgres'))
  }
  if (solNum && solNum !== '') {
    whereArray.push('solicitation_number = ' + SqlString.escape(solNum, null, 'postgres'))
  }
  if (eitLikelihood && eitLikelihood !== '') {
    // this is a no-op for now since all records added to the database should have eitLikelihood true
  }
  if (startDate && startDate !== '') {
    whereArray.push('date > ' + SqlString.escape(makePostgresDate(startDate), null, 'postgres'))
    whereArray.push('date is not null')
  }
  if (endDate && endDate !== '') {
    whereArray.push('date < ' + SqlString.escape(makePostgresDate(endDate), null, 'postgres'))
    whereArray.push('date is not null')
  }

  let where = whereArray.join(' AND ')
  let sql = `
            -- noinspection SqlResolve
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
            WHERE ${where} 
            order by id desc`

  return db.sequelize.query(sql, { type: db.sequelize.QueryTypes.SELECT })
    .then(notices => {
      let data = []
      for (let i = 0; i < notices.length; i++) {
        data.push(makeOnePrediction(notices[i]))
      }
      return mergePredictions(data)
    })
    .catch(e => {
      logger.log('error', e, { tag: 'getPredictions', sql: sql })
      return null
    })
}

/**
 * prediction routes
 */
module.exports = {

  getPredictions: getPredictions,
  mergePredictions: mergePredictions,

  makeOnePrediction: makeOnePrediction,

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
    for (let i = 0; i < keys.length; i++) {
      if (req.body[keys[i]] !== '' && !validKeys.includes(keys[i])) {
        logger.log('error', req.body, { tag: 'predictionFilter - ' + 'Received unsupported filter parameter ' + keys[i] })
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

    return getPredictions(req.body)
      .then((predictions) => {
        if (predictions == null) {
          return res.status(500).send({})
        }

        return res.status(200).send(predictions)
      })
      .catch(e => {
        logger.log('error', e, { tag: 'predictionFilter' })
        return res.status(500).send(data)
      })
  }
}

// *********************************************************
//  below code is used if you want to mock solicitation data
// *********************************************************
//
// Math.seed = 52;
//
// function getRandomInt(min, max) {
//     max = (max === undefined) ? 1 : max;
//     min = (min === undefined) ? 1 : min;
//
//     Math.seed = (Math.seed * 9301 + 49297) % 233280;
//     let rnd = Math.seed / 233280;
//
//     return Math.floor(min + rnd * (max - min));
// }
// function pickOne(a) {
//     return a[getRandomInt(0, a.length)]
// }
//
// let template =
//
//     {
//         solNum: "1234",
//         title: "sample title",
//         url: "http://www.tcg.com/",
//         predictions: {
//             value: "GREEN"
//         },
//         reviewRec: "Non-compliant", // one of "Compliant", "Non-compliant (Action Required)", or "Undetermined"
//         date: "01/01/2019",
//         numDocs: 3,
//         eitLikelihood: {
//             naics: "naics here",  // initial version uses NAICS code to determine
//             value: "45"
//         },
//         agency: "National Institutes of Health",
//         office: "Office of the Director",
//
//         contactInfo: {
//             contact: "contact str",
//             name: "Joe Smith",
//             position: "Manager",
//             email: "joe@example.com"
//         },
//         position: "pos string",
//         reviewStatus: "on time",
//         noticeType: "N type",
//         actionStatus: "ready",
//         actionDate: "02/02/2019",
//         parseStatus: [{
//             name: "attachment name",
//             status: "??? enumeration, one of 'successfully parsed', 'processing error'  maybe derived f"
//         }],
//         history: [{
//             date: "03/03/2018",
//             action: "sending",
//             user: "crowley",
//             status: "submitted"
//         }],
//         feedback: [{
//             questionID: "1",
//             question: "Is this a good solicitation?",
//             answer: "Yes",
//         }],
//         undetermined: true
//
//     };
//
// // let reviewRecArray = ["Compliant", "Non-compliant (Action Required)", "Undetermined"];
// let noticeTypeArray = ["Presolicitation", "Combined Synopsis/Solicitation", "Sources Sought", "Special Notice", "Other"];
// let actionStatusArray = ["Email Sent to POC", "reviewed solicitation action requested summary", "provided feedback on the solicitation prediction result"];
//
// function mockData() {
//     if (myCache.get("sample_data") != undefined) {
//         return myCache.get("sample_data");
//     }
//
//         let reviewRecArray = ["Compliant", "Non-compliant (Action Required)", "Undetermined"];
//         let noticeTypeArray = ["Presolicitation", "Combined Synopsis/Solicitation", "Sources Sought", "Special Notice", "Other"];
//         let actionStatusArray = ["Email Sent to POC", "reviewed solicitation action requested summary", "provided feedback on the solicitation prediction result"];
//         let template =
//
//             {
//                 solNum: "1234",
//                 title: "sample title",
//                 url: "http://www.tcg.com/",
//                 predictions: {
//                     value: "GREEN"
//                 },
//                 reviewRec: "Compliant", // one of "Compliant", "Non-compliant (Action Required)", or "Undetermined"
//                 date: "01/01/2019",
//                 numDocs: 3,
//                 eitLikelihood: {
//                     naics: "naics here",  // initial version uses NAICS code to determine
//                     value: "45"
//                 },
//                 agency: "National Institutes of Health",
//                 office: "Office of the Director",
//
//                 contactInfo: {
//                     contact: "contact str",
//                     name: "Joe Smith",
//                     position: "Manager",
//                     email: "joe@example.com"
//                 },
//                 position: "pos string",
//                 reviewStatus: "on time",
//                 noticeType: "N type",
//                 actionStatus: "ready",
//                 actionDate: "02/02/2019",
//                 parseStatus: [{
//                     name: "doc 1",
//                     status: "parsed"
//                 }],
//                 history: [{
//                     date: "03/03/2018",
//                     action: "sending",
//                     user: "crowley",
//                     status: "submitted"
//                 }],
//                 feedback: [{
//                     questionID: "1",
//                     question: "Is this a good solicitation?",
//                     answer: "Yes",
//                 }],
//                 undetermined: true
//
//             };
//
//         let sample_data = new Array();
//
//         for (let i = 0; i < 6000; i++) {
//             let o = Object.assign({}, template);
//
//             o.title = randomWords({exactly: 1, wordsPerString: getRandomInt(2, 7)})[0];
//             o.reviewRec = pickOne(reviewRecArray);
//             o.agency = pickOne(['Navy Department', 'Education Department',   'National Institutes of Health', 'National Library of Medicine']);
//             o.numDocs = getRandomInt(0,3);
//             o.solNum = getRandomInt(999, 99999999);
//             o.noticeType = pickOne(noticeTypeArray);
//             o.actionStatus = pickOne(actionStatusArray);
//             o.actionDate = new Date( getRandomInt(2018, 2020),  getRandomInt(0, 12),getRandomInt(1,27));;;
//             o.date = new Date( getRandomInt(2018, 2020),  getRandomInt(0, 12),getRandomInt(1,27));;
//             o.office = randomWords({exactly: 1, wordsPerString: getRandomInt(2, 4)})[0];
//             o.predictions = Object.assign({}, template.predictions);
//             o.predictions.value = pickOne(["RED", "GREEN"]);
//             o.eitLikelihood = Object.assign({}, template.eitLikelihood);
//             o.eitLikelihood.naics = getRandomInt(10, 99999);
//             o.eitLikelihood.value = pickOne(['Yes', 'No']);
//             o.undetermined = (getRandomInt(0,2) == 0);
//
//             o.parseStatus = [];
//             let count = getRandomInt(0,3);
//             for (let x=0; x < count; x++) {
//                 let stat = {};
//                 stat.name = "doc 1";
//                 stat.status = pickOne( ["successfully parsed", "processing error"] )
//                 o.parseStatus.push ( stat )
//             }
//
//             sample_data.push(o);
//         }
//
//         myCache.set("sample_data", sample_data);
//         return sample_data;
// }
