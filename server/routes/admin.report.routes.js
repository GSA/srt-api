/** @module AdminReportRoutes */
const db = require('../models/index')
const {getConfig} = require('../config/configuration')
const moment = require('moment')
const logger = require('../config/winston')

module.exports = {

  /*
  Returns an object with the number of total logins for each day
   */

  dailyLogin : async function (req, res) {
    logger.log("debug", "Running daily login report")
    let dailyLogins = {}
    let sql = `select timestamp, message, meta#>>'{cas_userinfo, email-address}' as email from winston_logs where message like '%authenticated with MAX CAS ID%'`
    let rows = await db.sequelize.query(sql, { type: db.sequelize.QueryTypes.SELECT })

    for (let r of rows) {
      let day = moment(r.timestamp).format('MM/DD/YYYY')
      dailyLogins[day] = (dailyLogins[day] || 0) + 1
    }
    return res.status(200).send(dailyLogins)
  },

  /*
  Returns a report of each user's last login, and logins per 7 days / 30 days / all time
   */
  userLogin : async function (req, res) {
    logger.log("debug", "Running user login report")
    let userLogins = {}
    let sql = `select timestamp, message, meta#>>'{cas_userinfo, email-address}' as email from winston_logs where message like '%authenticated with MAX CAS ID%'`
    let rows = await db.sequelize.query(sql, { type: db.sequelize.QueryTypes.SELECT })

    for (let r of rows) {
      let day = moment(r.timestamp).format('MM/DD/YYYY')
      let email = r.email
      userLogins[day] = (userLogins[day]) ? userLogins[day] : {}
      userLogins[day][email] = (userLogins[day][email] || 0) + 1
    }
    return res.status(200).send(userLogins)
  },

  /*
  Gathers the feedback data and returns it as an array with one question/answer per entry
   */
  feedback : async function (req, res) {
    logger.log("debug", "Running feedback report")
    const sql = `
        select distinct on (P."solNum", (objaction ->> 'date')::date ,(objfeedback ->> 'questionID')::int )
            P."solNum",
            P.title,
            n.notice_id,                                                                                                            
            ((objaction ->> 'user')::text)       as email,
            CASE WHEN objaction ->> 'date' is null THEN null ELSE ((objaction ->> 'date')::date)::text END  as date,
            objfeedback ->> 'questionID'         as questionid,
            objfeedback ->> 'question'           As question,
            objfeedback ->> 'answer'             As answer,
            objfeedback ->> 'note'               as note
        FROM Public."Predictions" P
                 JOIN jsonb_array_elements(P."feedback") objfeedback ON true
                 left JOIN jsonb_array_elements(P."action") objaction
                           ON (objaction ->> 'action')::text like '%feedback%'
                 LEFT JOIN (select max(id) as notice_id, solicitation_number from notice group by solicitation_number) n
                           ON n.solicitation_number = P."solNum"
        where (P.feedback::text <> '[]')
          and jsonb_array_length(case
                                     when jsonb_typeof(P.feedback) = 'array'
                                         then P.feedback
                                     else '[]'::jsonb
            end) > 0
        order by (objaction ->> 'date')::date desc nulls last, P."solNum", (objfeedback ->> 'questionID')::int,
                 objaction ->> 'user'
    `


    try {
      let rows = await db.sequelize.query(sql, { type: db.sequelize.QueryTypes.SELECT })
      let result = []
      for (const r of rows) {
        result.push(
          Object.assign({
            note: r.note, answer: r.answer, question: r.question, questionID: r.questionid, date: r.date,
            solicitation_number: r.solNum, email: r.email, title: r.title, id: r.notice_id,
          }))
      }
      return res.status(200).send(result)
    } catch (e) {
      logger.log("error", "Error running feedback report", {tag: "feedback report", "error-message": e.message, err:e } )
      e.message //?
      return res.status(500).send({})
    }
  }


}
