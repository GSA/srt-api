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
        select * from (
                select distinct on (r1.solicitation_number,objfeedback ->> 'questionID')
                    r1.solicitation_number        as "solNum",
                    (objhistory ->> 'date')::text as date,
                    r1.agency,
                    title,
                    action,
                    history,
                    (objaction ->> 'user')::text as email,                                                                                         
                    (objhistory ->> 'user')::text as name,
                    r1.feedback,
                    objfeedback ->> 'questionID'  as questionID,
                    objfeedback ->> 'question'    as question,
                    objfeedback ->> 'answer'      as answer,
                    objfeedback ->> 'note'        as note,
                    id as notice_id
                from (select distinct on (n.solicitation_number)
                          n.solicitation_number,
                          n.agency,
                          n.id,
                          n.action,
                          n.feedback,
                          p.history,
                          p.title 
                      from notice n
                               inner join public."Predictions" p on n.solicitation_number = p."solNum"
                      where (n.feedback::text <> '[]')
                      order by solicitation_number, id desc) as r1
                         join jsonb_array_elements(r1.feedback) objfeedback ON true
                         join jsonb_array_elements(r1.history) objhistory
                              ON (objhistory ->> 'action')::text like '%feedback%'
                         left join jsonb_array_elements(r1.action) objaction
                                   ON ((objaction ->> 'action')::text like '%feedback%' and
                                       lower((objaction ->> 'user')::text) like lower(substr((objhistory ->> 'user')::text, 1, position(' ' in (objhistory ->> 'user')::text) - 1)) ||
                                                                                '.%' ||
                                                                                lower(substr((objhistory ->> 'user')::text, position(' ' in (objhistory ->> 'user')::text) + 1)) || '%')
                order by r1.solicitation_number, objfeedback ->> 'questionID'
            ) unordered
        order by to_date(date, 'MM/DD/YYYY') desc, "solNum", questionID::int
    `

    try {
      let rows = await db.sequelize.query(sql, { type: db.sequelize.QueryTypes.SELECT })
      let result = []
      for (const r of rows) {
        result.push(
          Object.assign({
            note: r.note, answer: r.answer, question: r.question, questionID: r.questionid, date: r.date,
            solicitation_number: r.solNum, email: `${r.name || ''} ${r.email || ''}`, title: r.title, id: r.notice_id,
            agency: r.agency
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
