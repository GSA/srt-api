/** @module AdminReportRoutes */
const db = require('../models/index')
const {getConfig} = require('../config/configuration')
const moment = require('moment')
const logger = require('../config/winston')
const analyticsRoutes = require('../routes/analytics.routes')
const predictionRoutes = require('./prediction.routes')
const authRoutes = require('./auth.routes')
const json2cvs = require('json2csv')
const { formatDateAsString } = require('../shared/time')

/*
 Helper function to run reports on all predictions
*/
async function runGenericMetricReport (user, report_function) {
  try {

    let solStats = undefined
    let first = 0
    let rows = 5000
    while (true) {
      let result = await predictionRoutes.getPredictions({'first': first, 'rows': rows, 'ignoreDateCutoff': true, 'sortField': 'date'}, user);
      solStats = await report_function(result.predictions, solStats)
      logger.log("info", `Running solicitation download report, asking for ${rows} solicitations with offset ${first}. We got ${result.rows}. Total solicitations in report is ${result.totalCount} `)
      
      if (result.rows == 0 || result.predictions.length === 0) {
        break;
      }
      first += result.rows
    }

    return solStats //?


  } catch (e) {
    e.message //?
    // logger.log("error", `Error running report ${report_function.name}`, {tag: "solicitationDownloads report", "error-message": e.message, err:e } )
    return res.status(500).send({})
  }


}


function sendSolicitationDownloadsCSV(solStats, res) {
  const dateHeader = 'Date'
  const newHeader = 'Newly Added Solicitations'
  const updateHeader = 'Updated Solicitations'

  const solStatsOrganizedForCSV = []
  const bothByDate = {}
  for (key of Object.keys(solStats.newSolicitationsByDate)) {
    bothByDate[key] = {}
    bothByDate[key][newHeader] = solStats.newSolicitationsByDate[key]
    bothByDate[key][updateHeader] =  0
  }
  for (key of Object.keys(solStats.updatedSolicitationsByDate)) {
    if (key in bothByDate) {
      bothByDate[key][updateHeader] = solStats.updatedSolicitationsByDate[key]
    } else {
      bothByDate[key] = {}
      bothByDate[key][updateHeader] = solStats.updatedSolicitationsByDate[key]
      bothByDate[key][newHeader] = 0
    }
  }

  for (key of Object.keys(bothByDate)) {
    const row = {}
    // key will be in YYYYMMDD format. Convert it to MM/DD/YYYY
    let date = key.substring(4,6) + "-" + key.substring(6,8) + "-" + key.substring(0,4)
    row[dateHeader] = date
    row[newHeader] = bothByDate[key][newHeader]
    row[updateHeader] = bothByDate[key][updateHeader]
    solStatsOrganizedForCSV.push(row)
  }

  const parser = new json2cvs.Parser({fields: [dateHeader, newHeader, updateHeader]})
  const csv_data = parser.parse(solStatsOrganizedForCSV)



  res.header('Content-Type', 'text/csv')
  res.attachment("solicitation-report.csv")
  res.status(200)
  return res.send(csv_data)

}

function sendPredictionReportCSV(solStats, res) {

  // first, normalize the agency name columns so we have the same column list for each date
  // get all the headers
  let headers = new Set()
  for (let day in solStats.stateByDate) {
    for (let header in solStats.stateByDate[day]) {
      headers.add(header)
    }
  }

  // add in any missing headers for each day
  for (let day in solStats.stateByDate) {
    for (let header of headers) {
      if (solStats.stateByDate[day][header] === undefined) {
        solStats.stateByDate[day][header] = 0
      }
    }
  }
  const solStatsOrganizedForCSV = []
  for (let day in solStats.stateByDate) {
    let row = solStats.stateByDate[day]
    solStatsOrganizedForCSV.push(row)
  }

  const parser = new json2cvs.Parser({fields: Array.from(headers)})
  const csv_data = parser.parse(solStatsOrganizedForCSV)



  res.header('Content-Type', 'text/csv')
  res.attachment("solicitation-report.csv")
  res.status(200)
  return res.send(csv_data)
}

async function calcPredictionReport(allSolicitations, stats = undefined) {
  const COMP = 1
  const NONCOMP = 2
  const NA = 3

  try {
    if (!stats) {
      stats = {
        totalSolicitations: 0,
        totalCompliant: 0,
        totalNonCompliant: 0,
        totalNotApplicable: 0,
        stateByDate: {},
      }
    }

    for (let sol of allSolicitations) {
      stats.totalSolicitations++;
      let day = formatDateAsString(sol.date) //?
      let state = undefined
      let agency = sol.agency

      if (stats.stateByDate[day] === undefined) {
        stats.stateByDate[day] = {
          'date': day,
          'total for day': 0,
          'compliant all agencies': 0,
          'non-compliant all agencies': 0,
          'not applicable all agencies': 0
        }
      }
      if(stats.stateByDate[day][agency+' compliant'] === undefined) {
        stats.stateByDate[day][agency+' compliant'] = 0
        stats.stateByDate[day][agency+' non-compliant'] = 0
        stats.stateByDate[day][agency+' not applicable'] = 0
      }

      stats.stateByDate[day]['total for day'] += 1

      if (sol.na_flag) {
        state = 'not applicable'
        stats.totalNotApplicable += 1
        stats.stateByDate[day][agency+' not applicable'] += 1
        stats.stateByDate[day]['not applicable all agencies'] += 1
      } else {
        if (sol.predictions.value == 'green') {
          state = 'compliant'
          stats.totalCompliant += 1
          stats.stateByDate[day][agency+' compliant'] += 1
          stats.stateByDate[day]['compliant all agencies'] += 1
        } else {
          state = 'non-compliant'
          stats.totalNonCompliant += 1
          stats.stateByDate[day][agency+' non-compliant'] += 1
          stats.stateByDate[day]['non-compliant all agencies'] += 1
        }
      }

    }

    return stats
  } catch (e) {
    logger.log("error", "Error calculating stats", {tag: "calcSolicitations", error: e})
  }
}

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
    let sql = `select timestamp, message, COALESCE(meta#>>'{cas_userinfo, user, email}', meta#>>'{cas_userinfo, email-address}') as email from winston_logs where message like '%authenticated with%'`
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
      select sr."solNum",
             jsonb_array_elements(response) -> 'question'::varchar as question,
             jsonb_array_elements(response) -> 'answer'::varchar   as answer,
             jsonb_array_elements(response) -> 'questionID'::varchar   as questionID,
             s."noticeData"->'subject'::varchar as title,
             to_char(date, 'MM/DD/YYYY') as notice_date,
             to_char(sr."updatedAt", 'MM/DD/YYYY') as survey_response_date,
             s.agency,
             sr."maxId",
             email,
             "lastName",
             "firstName",
             s.id as solicitation_id
      from survey_responses sr
             left join solicitations s on sr."solNum" = s."solNum"
             left join "Users" u on sr."maxId" = u."maxId"
      order by survey_response_date desc, "solNum", jsonb_array_elements(response) -> 'questionID'
    `

    try {
      let rows = await db.sequelize.query(sql, { type: db.sequelize.QueryTypes.SELECT })
      let result = []
      for (const r of rows) {
        result.push(
          Object.assign({
            note: r.note, answer: r.answer, question: r.question, questionID: r.questionid, date: r.survey_response_date,
            solicitation_number: r.solNum, email: `${r.name || ''} ${r.email || ''}`, title: r.title, id: r.notice_id,
            agency: r.agency, id: r.solicitation_id
          }))
      }
      return res.status(200).send(result)
    } catch (e) {
      logger.log("error", "Error running feedback report", {tag: "feedback report", "error-message": e.message, err:e } )
      e.message //?
      return res.status(500).send({})
    }
  },

  /*
  Gathers the solicitation download  data and returns it as an array or CSV
   */
  solicitationDownloads : async function (req, res) {
    try {
      let user = authRoutes.userInfoFromReq(req)
      let solStats = await runGenericMetricReport(user, analyticsRoutes.calcSolicitations)

      if (req.query.format && req.query.format.toLocaleLowerCase()== 'csv') {
        logger.debug(`Solicitation Statitiscs to be sent as CSV - ${solStats}`)
        return sendSolicitationDownloadsCSV(solStats, res)
      } else {
        return res.status(200).send(solStats)
      }

    } catch (e) {
      logger.log("error", "Error running solicitation download report", {tag: "solicitationDownloads report", "error-message": e.message, err:e } )
      e.message //?
      return res.status(500).send({})
    }
  },

  /*
  Looks at all solicitations and reports on their compliance by agency
   */
  predictionReport : async function (req, res) {
    try {
      let user = authRoutes.userInfoFromReq(req)
      let solStats = await runGenericMetricReport(user, calcPredictionReport )

      if (req.query.format && req.query.format.toLocaleLowerCase()== 'csv') {
        return sendPredictionReportCSV(solStats, res)
      } else {
        return res.status(200).send(solStats)
      }

    } catch (e) {
      logger.log("error", "Error running solicitation download report", {tag: "solicitationDownloads report", "error-message": e.message, err:e } )
      e.message //?
      return res.status(500).send({})
    }
  },


  noticeTypeChangeReport : async function(req, res) {
    try {
      let sql = `with most_recent_notice_by_solicitation_number as
                          (select n1.id, n1.solicitation_number, n1.date, notice_type_id
                           from notice n1
                                    inner join (select solicitation_number, max(date) as max_date from notice group by solicitation_number) n2
                                               on n1.solicitation_number = n2.solicitation_number and n1.date = n2.max_date)
                         ,
                      solicitations_that_that_transitioned_to_untracked_notice_type as
                          (select notice.solicitation_number as solicitation_number, max(notice.date)
                           from notice
                                    join most_recent_notice_by_solicitation_number vmrnbsn on notice.solicitation_number = vmrnbsn.solicitation_number
                           where notice.notice_type_id in (select id from notice_type where notice_type.notice_type in ('Combined Synopsis/Solicitation', 'Solicitation'))
                             and vmrnbsn.notice_type_id not in (select id from notice_type where notice_type.notice_type in ('Combined Synopsis/Solicitation', 'Solicitation'))
                           group by notice.solicitation_number)

                 select count(*) as count, agency, day from (
                                                                select solicitation_number, agency,  to_char(min(date), 'MM-DD-YYYY') as day
                                                                from notice
                                                                where solicitation_number in (select solicitation_number
                                                                                              from solicitations_that_that_transitioned_to_untracked_notice_type)
                                                                  and notice_type_id not in (select id
                                                                                             from notice_type
                                                                                             where notice_type.notice_type in
                                                                                                   ('Combined Synopsis/Solicitation', 'Solicitation'))
                                                                group by solicitation_number, agency
                                                            )  t
                 group by day, agency
                 order by day::date ;
      `

      let rows = await db.sequelize.query(sql, { type: db.sequelize.QueryTypes.SELECT })

      let stats = {};

      // first, normalize the agency name columns so we have the same column list for each date
      // get all the headers
      let headers = new Set()
      headers.add("date");
      headers.add("Total for day");
      for (let row of rows) {
          headers.add(row.agency)
      }

      // add in any missing headers for each day
      for (let row of rows) {
        let day = row.day
        if (stats[day] === undefined) {
          stats[day] = {'date' : day, "Total for day" : 0};
        }
        for (let header of headers) {
          if (stats[day][header] === undefined) {
            stats[day][header] = 0
          }
        }
      }
      for (let row of rows) {
        stats[row.day][row.agency] = parseInt(row.count)
        stats[row.day]["Total for day"] += parseInt(row.count)
      }


      let statsOrganizedForCSV = [];
      for (let day in stats) {
        statsOrganizedForCSV.push (stats[day])
      }


      const parser = new json2cvs.Parser({fields: Array.from(headers)})
      const csv_data = parser.parse(statsOrganizedForCSV)

      res.header('Content-Type', 'text/csv')
      res.attachment("solicitation-report.csv")
      res.status(200)
      return res.send(csv_data)


    } catch (e) {
      logger.log("error", "Error running noticeTypeChagneReport", {tag: "noticeTypeChagneReport report", "error-message": e.message, err:e } )
      e.message //?
      return res.status(500).send({})
    }

  }

}
