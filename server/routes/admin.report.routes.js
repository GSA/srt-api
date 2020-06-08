/** @module AdminReportRoutes */
const db = require('../models/index')
const {getConfig} = require('../config/configuration')

module.exports = {

  /*
  Returns an object with the number of total logins for each day
   */

  dailyLogin : async function (req, res) {
    let dailyLogins = {}
    let sql = `select timestamp, message, meta#>>'{cas_userinfo, email-address}' as email from winston_logs where message like '%authenticated with MAX CAS ID%'`
    let rows = await db.sequelize.query(sql, { type: db.sequelize.QueryTypes.SELECT })

    for (let r of rows) {
      let day = r.timestamp.toLocaleDateString()
      dailyLogins[day] = (dailyLogins[day] || 0) + 1
    }
    return res.status(200).send(dailyLogins)
  },

  /*
  Returns a report of each user's last login, and logins per 7 days / 30 days / all time
   */
  userLogin : async function (req, res) {
    let userLogins = {}
    let sql = `select timestamp, message, meta#>>'{cas_userinfo, email-address}' as email from winston_logs where message like '%authenticated with MAX CAS ID%'`
    let rows = await db.sequelize.query(sql, { type: db.sequelize.QueryTypes.SELECT })

    for (let r of rows) {
      let day = r.timestamp.toLocaleDateString()
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
    const sql = `select  distinct single_action->>'user' as email, title,
                                  "solNum", "Predictions".feedback, "Predictions"."title", notice.id
                 from "Predictions"
                      join notice on "Predictions"."solNum" = notice.solicitation_number,
                      jsonb_array_elements("Predictions".action) single_action
                 where jsonb_array_length(
                               case
                                   when jsonb_typeof("Predictions".feedback) = 'array' then "Predictions".feedback
                                   else '[]'::jsonb
                                   end
                           ) > 0
                   and single_action->>'action' = '${getConfig("constants:FEEDBACK_ACTION")}';`

    let rows = await db.sequelize.query(sql, { type: db.sequelize.QueryTypes.SELECT })
    let result = []
    for (const r of rows) {
      for (const f of r.feedback) {
        let o = Object.assign({note: '', answer: '', question: '', questionID: '', solicitation_number: r.solNum, email: r.email, title: r.title, id: r.id}, f)
        result.push(o)
      }
    }
    return res.status(200).send(result)
  }


}
