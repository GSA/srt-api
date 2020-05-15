/** @module AdminReportRoutes */
const logger = require('../config/winston')
// noinspection JSUnresolvedVariable
const Agency = require('../models').Agency
const db = require('../models/index')
const jwt = require('jsonwebtoken')


module.exports = {


  dailyLogin : async function (req, res) {

    let dailyLogins = {}
    let sql = `select timestamp, message, meta#>>'{cas_userinfo, email-address}' as email from winston_logs where message like '%authenticated with MAX CAS ID%'`
    let rows = await db.sequelize.query(sql, { type: db.sequelize.QueryTypes.SELECT })

    for (r of rows) {
      let day = r.timestamp.toLocaleDateString()
      dailyLogins[day] = (dailyLogins[day] || 0) + 1
    }

    return res.status(200).send(dailyLogins)
  },

  userLogin : async function (req, res) {
    let userLogins = {}
    let sql = `select timestamp, message, meta#>>'{cas_userinfo, email-address}' as email from winston_logs where message like '%authenticated with MAX CAS ID%'`
    let rows = await db.sequelize.query(sql, { type: db.sequelize.QueryTypes.SELECT })

    for (r of rows) {
      let day = r.timestamp.toLocaleDateString()
      let email = r.email
      userLogins[day] = (userLogins[day]) ? userLogins[day] : {}
      userLogins[day][email] = (userLogins[day][email] || 0) + 1
    }

    return res.status(200).send(userLogins)

  }


}
