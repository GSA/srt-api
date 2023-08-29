/** @module AnalyticsRoutes */

const logger = require('../config/winston')
const predictionRoutes = require('./prediction.routes')
const authRoutes = require('./auth.routes')

function formatDate(d) {
  let month = '' + (d.getMonth() + 1),
      day = '' + d.getDate(),
      year = d.getFullYear();

  if (month.length < 2)
    month = '0' + month;
  if (day.length < 2)
    day = '0' + day;

  return [year, month, day].join('');
}

/**
 *
 * Calculates total, new, and updated solicitaiton stats for the provided array of solicitations
 *
 *
 * @param allSolicitations
 * @param stats - Allows for pre-filled stats that will be added onto so we can process large datasets in chunks
 * @returns {{newSolicitations: number, newSolicitationsByDate: {}, totalSolicitations: number, updatedSolicitationsByDate: {}, updatedSolicitations: number}}
 */
function calcSolicitationsAddedOrUpdatedByDate(allSolicitations, stats = undefined) {
  try {
    if (!stats) {
      stats = {
        totalSolicitations: 0,
        newSolicitations: 0,
        updatedSolicitations: 0,
        newSolicitationsByDate: {},
        updatedSolicitationsByDate: {},
      }
    }
    for (let sol of allSolicitations) {

      // Find out the day this was posted or updates
      let day = formatDate(sol.date)

      stats.totalSolicitations++;

      // find out if any of the history.action items say something like "updated on sam"
      // sample: [{"date"....} , {"date": "03/16/2021", "user": "", "action": "Solicitation Updated on SAM","status": "" }, {"date" ... }]
      // let lastUpdate = sol.history.map(historyLine => (historyLine.action))
      //     .map(historyText => (historyText.match(/updated on sam/i)))
      //     .reduce((accumulator, nextval) => { return accumulator || nextval}, false )

      let updatedDateArray =
        sol.history.filter( historyLine => (historyLine.action.match(/updated on /i)))
          .map( historyLine => (historyLine.date) )

      stats.newSolicitations++
      stats.newSolicitationsByDate[day] = (!stats.newSolicitationsByDate[day]) ? 1 : stats.newSolicitationsByDate[day] + 1

      for (let d of updatedDateArray) {
        if (d.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
          // d is in the format mm/dd/yyyy, so reorganize it to be yyyymmdd
          day = d.substring(6,10) + d.substring(0,2) + d.substring(3,5)
        } else {
          // lets assume d is in the yyyy-mm-yy format, so reorganize it to be yyyymmdd
          day = d.substring(0,4) + d.substring(5,7) + d.substring(8,10)
        }
        stats.updatedSolicitations++
        stats.updatedSolicitationsByDate[day] = (!stats.updatedSolicitationsByDate[day]) ? 1 : stats.updatedSolicitationsByDate[day] + 1
      }

    }

    return stats
  } catch (e) {
    logger.log("error", "Error calculating stats", {tag: "calcSolicitations", error: e})
  }
}


/***
 *
 * params must include :
 *   from - Date object - default 1/1/2000
 *   to - Date object - default 2/2/2222
 *   agency - Use Government-wide to match everything - default to the user's agency
 *
 *
 * @param params
 * @param user
 * @returns {Promise<boolean|{solStats: {newSolicitations: number, newSolicitationsByDate: {}, totalSolicitations: number, updatedSolicitationsByDate: {}, updatedSolicitations: number}, TopAgenciesChart: {topAgencies: {}}, ComplianceRateChart: {determinedICT, compliance: number}, UndeterminedSolicitationChart: {latestNonMachineReadable: number, presolicitation: number, latestNoDocument: number, latestOtherUndetermined: number}, ConversionRateChart: {uncompliance: number, updatedCompliantICT: number}, TopSRTActionChart: {updatedNonCompliantICT: number, determinedICT, review: number, uncompliance: number, updatedCompliantICT: number, updatedICT, email: number}, ScannedSolicitationChart: {scannedData: {}}, PredictResultChart: {compliance: number, uncompliance: number}, MachineReadableChart: {machineUnreadable: number, machineReadable: number}}>}
 */
async function computeAnalytics (params, user) {
  try {
    // set some defaults
    let from =   ( params.from ) ? params.from : new Date(2000,1,1)
    let to = ( params.to ) ? params.to : new Date(2222,2,2)
    let agency = ( params.agency) ? params.agency : user.agency
    if (!params.rows) {
      params.rows = Number.MAX_SAFE_INTEGER
    }


    let result = await predictionRoutes.getPredictions(params, user);
    let predictions = result.predictions
    let data = {
      // Total number of ICT
      TotalICT: predictions.length,
      LatestICT: 0,
      // Number of ICT Presolicitation
      TotalPresolicitation: 0,
      LatestPresolicitation: 0,
      // Number of ICT Non Presolicitation
      TotalNonPresolicitation: 0,
      LatestNonPresolicitation: 0,
      // Number of 0 document solicitation
      TotalNoDocumentSolicitation: 0,
      LatestNoDocumentSolicitation: 0,
      // Number of 0 document solicitation Green
      TotalNoDocumentSolicitation_GREEN: 0,
      LatestNoDocumentSolicitation_GREEN: 0,
      // Number of 0 document solicitation Red
      TotalNoDocumentSolicitation_RED: 0,
      LatestNoDocumentSolicitation_RED: 0,
      // Number of other undetermined solicitation
      TotalOtherUndeterminedSolicitation: 0,
      LatestOtherUndeterminedSolicitation: 0,
      // Number of other undetermined solicitation Green
      TotalOtherUndeterminedSolicitation_GREEN: 0,
      LatestOtherUndeterminedSolicitation_GREEN: 0,
      // Number of other undetermined solicitation Red
      TotalOtherUndeterminedSolicitation_RED: 0,
      LatestOtherUndeterminedSolicitation_RED: 0,
      // Number of machine readable document
      TotalMachineReadableDocument: 0,
      LatestMachineReadableDocument: 0,
      // Number of machine unreadable document
      TotalMachineUnreadableDocument: 0,
      LatestMachineUnreadableDocument: 0,
      // Number of machine unreadable solicitation
      TotalMachineUnreadableSolicitation: 0,
      LatestMachineUnreadableSolicitation: 0,
      // Number of machine unreadable red solicitation
      TotalMachineUnreadableSolicitation_RED: 0,
      LatestMachineUnreadableSolicitation_RED: 0,
      // Number of machine unreadable green solicitation
      TotalMachineUnreadableSolicitation_GREEN: 0,
      LatestMachineUnreadableSolicitation_GREEN: 0,
      // Number of Undetermined Solicitation
      TotalUndeterminedSolicitation: 0,
      LatestUndeterminedSolicitation: 0,

      // Number of Compliance
      TotalComplianceSolicitation: 0,
      LatestComplianceSolicitation: 0,
      FilteredComplianceSolicitation: 0,
      // Number of Non Compliance
      TotalNonComplianceSolicitation: 0,
      LatestNonComplianceSolicitation: 0,
      FilteredNonComplianceSolicitation: 0,

      // Number of Not Applicable Solicitation
      TotalNotApplicableSolicitation: 0,
      LatestNotApplicableSolicitation: 0,
      FilteredNotApplicableSolicitation: 0,

      // Update
      LatestUpdateCompliance: 0,
      LatestUpdateNonCompliance: 0,
      LatestEmail: 0,
      LatestReview: 0,

      // Scanned Data
      ScannedSolicitation: {},

      // Top Agency
      topAgencies: {}

    }
    let map = {}
    let scannedToDate = new Date(new Date().getTime() - (1000 * 60 * 60 * 24))
    let scannedFromDate = new Date(new Date().getTime() - (1000 * 60 * 60 * 24 * 32))

    // Start for loop
    for (let i = 0; i < data.TotalICT; i++) {
      // if (predictions[i].solNum != undefined) {
      //     console.log(predictions[i].solNum);
      // }
      //
      //
      //

      let latest = new Date(predictions[i].date) > scannedFromDate && new Date(predictions[i].date) < scannedToDate

      if (latest) data.LatestICT++

      if (predictions[i].noticeType !== 'Presolicitation' && predictions[i].noticeType !== 'Special Notice') {
        if (latest) data.LatestNonPresolicitation++
        data.TotalNonPresolicitation++

        if (  predictions[i].parseStatus && predictions[i].parseStatus.length !== 0) {
          // Machine Readable Document
          for (let j = 0; j < predictions[i].parseStatus.length; j++) {
            if (latest) {
              if (predictions[i].parseStatus[j].status === 'successfully parsed') {
                data.LatestMachineReadableDocument++
              } else {
                data.LatestMachineUnreadableDocument++
              }
            }
            if (predictions[i].parseStatus[j].status === 'successfully parsed') {
              data.TotalMachineReadableDocument++
            } else {
              data.TotalMachineUnreadableDocument++
            }
          }

          for (let j = 0; j < predictions[i].parseStatus.length; j++) {
            // Non machine readable solicitations
            if (predictions[i].parseStatus[j].status === 'processing error') {
              if (predictions[i].predictions.value === 'red') {
                if (latest) {
                  data.LatestMachineUnreadableSolicitation_RED++
                }
                data.TotalMachineUnreadableSolicitation_RED++
              } else {
                if (latest) {
                  data.LatestMachineUnreadableSolicitation_GREEN++
                }
                data.TotalMachineUnreadableSolicitation_GREEN++
              }
              if (latest) {
                data.LatestMachineUnreadableSolicitation++
              }
              data.TotalMachineUnreadableSolicitation++
              break
            }
          }
        } else if (predictions[i].parseStatus.length === 0 && predictions[i].numDocs === 0) {
          if (predictions[i].predictions.value === 'red') {
            if (latest) {
              data.LatestNoDocumentSolicitation_RED++
            }
            data.TotalNoDocumentSolicitation_RED++
          } else {
            if (latest) {
              data.LatestNoDocumentSolicitation_GREEN++
            }
            data.TotalNoDocumentSolicitation_GREEN++
          }
          if (latest) {
            data.LatestNoDocumentSolicitation++
          }
          data.TotalNoDocumentSolicitation++
        } else {
          if (predictions[i].predictions.value === 'red') {
            if (latest) {
              data.LatestOtherUndeterminedSolicitation_RED++
            }
            data.TotalOtherUndeterminedSolicitation_RED++
          } else {
            if (latest) {
              data.LatestOtherUndeterminedSolicitation_GREEN++
            }
            data.TotalOtherUndeterminedSolicitation_GREEN++
          }
          if (latest) {
            data.LatestOtherUndeterminedSolicitation++
          }
          data.TotalOtherUndeterminedSolicitation++
        }

        if (!predictions[i].undetermined) {
          // prediction result chart
          if (latest) {
            if (predictions[i].predictions.value === 'green') {
              data.LatestComplianceSolicitation++
            } else if (predictions[i].predictions.value === 'grey') {
              data.LatestNotApplicableSolicitation++
            } else data.LatestNonComplianceSolicitation++
          }
          if (predictions[i].predictions.value === 'green') {
            data.TotalComplianceSolicitation++
          } else if (predictions[i].predictions.value === 'grey') {
            data.TotalNotApplicableSolicitation++
          } else data.TotalNonComplianceSolicitation++

          // scanned solicitation chart
          if (latest) {
            let day = ''
            if (typeof (predictions[i].date) === 'string') {
              // it is a string
              day = +(predictions[i].date.split('/')[0] + predictions[i].date.split('/')[1])
            } else {
              // it is a date object
              day = +((predictions[i].date.getMonth() + 1) + '' + predictions[i].date.getDate())
            }

            if (!data.ScannedSolicitation[day]) data.ScannedSolicitation[day] = 1
            else data.ScannedSolicitation[day] = data.ScannedSolicitation[day] + 1
          }
        } else {
          if (latest) {
            data.LatestUndeterminedSolicitation++
          }
          data.TotalUndeterminedSolicitation++
        }
        // Filter Section
        if (new Date(predictions[i].date) > from &&
          new Date(predictions[i].date) < to &&
          (agency === predictions[i].agency || agency === 'Government-wide')) {
          if (!predictions[i].undetermined) {
            if (predictions[i].predictions.value === 'green') {
              data.FilteredComplianceSolicitation++
            } else data.FilteredNonComplianceSolicitation++

            if (predictions[i].predictions.value === 'green' &&
              predictions[i].history.filter(function (e) {
                return e['action'].indexOf('Solicitation Updated on FBO.gov') > -1
              }).length > 0) {
              data.LatestUpdateCompliance++
            }

            if (predictions[i].predictions.value === 'red' &&
              predictions[i].history.filter(function (e) {
                return e['action'].indexOf('Solicitation Updated on FBO.gov') > -1
              }).length > 0) {
              data.LatestUpdateNonCompliance++
            }

            if (predictions[i].history.filter(function (e) {
              return e['action'].indexOf('sent email to POC') > -1
            }).length > 0) {
              data.LatestEmail++
            }

            if (predictions[i].history.filter(function (e) {
              return e['action'].indexOf('reviewed solicitation action requested summary') > -1
            }).length > 0) {
              data.LatestReview++
            }

            /******************************
             *   Top Agencies bar chart   *
             ******************************/
            // if filter is Government-wide, we don't need to worry about prediction date.
            if (agency === 'Government-wide') {
              // Top Agency section
              if (!map[predictions[i].agency]) {
                map[predictions[i].agency] = 1
                data.topAgencies[predictions[i].agency] = {}
                data.topAgencies[predictions[i].agency]['name'] = predictions[i].agency
                data.topAgencies[predictions[i].agency]['red'] = 0
                data.topAgencies[predictions[i].agency]['green'] = 0
                if (predictions[i].predictions.value === 'green') data.topAgencies[predictions[i].agency]['green']++
                else data.topAgencies[predictions[i].agency]['red']++
              } else {
                if (predictions[i].predictions.value === 'green') data.topAgencies[predictions[i].agency]['green']++
                else data.topAgencies[predictions[i].agency]['red']++
              }
            } else {
              if (predictions[i].agency === agency) {
                if (!data.topAgencies[agency]) data.topAgencies[agency] = [predictions[i]]
                else data.topAgencies[agency].push(predictions[i])
              }
            }
          }
        }
      } else {
        if (latest) data.LatestPresolicitation++
        data.TotalPresolicitation++
      }
    }


    let solStats = calcSolicitationsAddedOrUpdatedByDate(result.predictions);

    let analytics = {
      solStats: solStats,
      ScannedSolicitationChart:
        {
          scannedData: data.ScannedSolicitation
        },
      MachineReadableChart:
        {
          machineReadable: data.LatestMachineReadableDocument,
          machineUnreadable: data.LatestMachineUnreadableDocument
        },
      ComplianceRateChart:
        {
          compliance: data.FilteredComplianceSolicitation,
          determinedICT: data.FilteredComplianceSolicitation + data.FilteredNonComplianceSolicitation
        },
      ConversionRateChart:
        {
          updatedCompliantICT: data.LatestUpdateCompliance,
          uncompliance: data.FilteredNonComplianceSolicitation
        },
      TopSRTActionChart:
        {
          determinedICT: data.FilteredComplianceSolicitation + data.FilteredNonComplianceSolicitation,
          uncompliance: data.FilteredNonComplianceSolicitation,
          review: data.LatestReview,
          email: data.LatestEmail,
          updatedICT: data.LatestUpdateCompliance + data.LatestUpdateNonCompliance,
          updatedCompliantICT: data.LatestUpdateCompliance,
          updatedNonCompliantICT: data.LatestUpdateNonCompliance
        },
      TopAgenciesChart:
        {
          topAgencies: data.topAgencies
        },
      PredictResultChart:
        {
          compliance: data.LatestComplianceSolicitation,
          uncompliance: data.LatestNonComplianceSolicitation,
          notApplicable: data.LatestNotApplicableSolicitation
        },
      UndeterminedSolicitationChart:
        {
          presolicitation: data.LatestPresolicitation,
          latestOtherUndetermined: data.LatestOtherUndeterminedSolicitation,
          latestNonMachineReadable: data.LatestMachineUnreadableSolicitation_RED,
          latestNoDocument: data.LatestNoDocumentSolicitation
        }
    }

    return analytics
  } catch(e) {
    e //?
    e.stack //?
    logger.log('error', 'error in: analytics', { error:e, tag: 'analytics', trace: e.stack })
    return false;
  }



}
/**
 * Defines the functions used to process the various analytics related API routes.
 */
module.exports = {

  calcSolicitations: calcSolicitationsAddedOrUpdatedByDate,

  computeAnalytics: computeAnalytics,

  /**
     * <b> GET /api/analytics </b> <br><br>
     *
     * Calculates a number of statistics for the solicitations meeting the filter
     * criteria provided in req.body <br>
     *
     * Returns an Object of the form: <br>
     *     <pre>
     *     {
     *       "ScannedSolicitationChart" : {
     *           "scannedData": { bar chart data here },
     *           "MachineReadableChart" : {
     *               "machineReadable" : number ,
     *               "machineUnreadable" : number
     *               },
     *           "ComplianceRateChart" : {
     *               "compliance" : number,
     *               "determinedICT" : number
     *               },
     *           "ConversionRateChart" : {
     *               "updatedCompliantICT" : number,
     *               "uncompliance" : number
     *               },
     *           "TopSRTActionChart" : {
     *               "determinedICT" : number,
     *               "uncompliance" : number,
     *               "review" : number,
     *               "email" : number,
     *               "updatedICT" : number,
     *               "updatedCompliantICT" : number,
     *               "updatedNonCompliantICT" : 0
     *               },
     *            "TopAgenciesChart" : { "topAgencies" : { agency info }}},
     *            "PredictResultChart" : {
     *                "compliance" : number,
     *                "uncompliance":number
     *                },
     *           "UndeterminedSolicitationChart" : {
     *               "presolicitation" : number,
     *               "latestOtherUndetermined" : number,
     *               "latestNonMachineReadable" : number,
     *               "latestNoDocument" : number
     *               }
     *           }
     *     </pre>
     *
     * @param {Request} req
     * @param {Object} req.body
     * @param {string} req.body.category_list - If provided, should always be "Yes"
     * @param {string} req.body.agency - Name of agency or "Government-wide"
     * @param {string} req.body.fromPeriod - Start date for analysis
     * @param {string} req.body.toPeriod - End date for analysis
     * @param res
     * @return Promise
     */
  analytics: async (req, res) => {
    try {
      let params = {}

      let fromPeriod = req.body.fromPeriod || req.body.startDate
      let toPeriod = req.body.toPeriod || req.body.endDate
      let agency = req.body.agency
      let date = fromPeriod.split('/')
      let from = new Date(date[2], date[0] - 1, date[1])

      date = toPeriod.split('/')
      let to = new Date(date[2], date[0] - 1, date[1])

      params.agency = agency
      params.from = from
      params.to = to
      // params.agency = agency
      let user = authRoutes.userInfoFromReq(req)

      let analytics = await computeAnalytics(params, user)

      if (analytics !== false) {
        return res.status(200).send(analytics)
      } else {
        return res.status(500).send({})
      }
    } catch (e) {
      logger.log('error', 'error in: analytics', {error: e, tag: 'analytics'})
      return res.status(500).send({})
    }
  }

}
