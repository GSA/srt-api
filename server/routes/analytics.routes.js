/** @module AnalyticsRoutes */

const logger = require('../config/winston')
const predictionRoutes = require('./prediction.routes')
const authRoutes = require('./auth.routes')

/**
 * Defines the functions used to process the various analytics related API routes.
 */
module.exports = {

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
     * @param {string} req.body.eitLikelihood - If provided, should always be "Yes"
     * @param {string} req.body.agency - Name of agency or "Government-wide"
     * @param {string} req.body.fromPeriod - Start date for analysis
     * @param {string} req.body.toPeriod - End date for analysis
     * @param res
     * @return Promise
     */
  analytics: (req, res) => {
    try {
      let params = {}

      let fromPeriod = req.body.fromPeriod
      let toPeriod = req.body.toPeriod
      let agency = req.body.agency
      let date = fromPeriod.split('/')
      let from = new Date(date[2], date[0] - 1, date[1])

      date = toPeriod.split('/')
      let to = new Date(date[2], date[0] - 1, date[1])

      let scannedToDate = new Date(new Date().getTime() - (1000 * 60 * 60 * 24))
      let scannedFromDate = new Date(new Date().getTime() - (1000 * 60 * 60 * 24 * 32))

      // this code fails for me.... merge doesn't seem to be a function in underscore.js
      // not sure what's going on here since params is always an empty array at this point
      // in the legacy code I have from
      // _.merge(params, {"eitLikelihood.value": "Yes"});
      params.eitLikelihood = 'Yes'
      params.fromPeriod = fromPeriod
      params.toPeriod = toPeriod
      params.agency = agency
      params.first = 0
      params.rows = Number.MAX_SAFE_INTEGER
      params.sortField = 'unsorted' // set to unsorted so we get all results at once.
      let user = authRoutes.userInfoFromReq(req)

      return predictionRoutes.getPredictions(params, user)
        .then((result) => {
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

              if (predictions[i].parseStatus.length !== 0) {
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
              } else if (predictions[i].parseStatus.length === 0 && predictions[i].numDocs === '0') {
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
                  } else data.LatestNonComplianceSolicitation++
                }
                if (predictions[i].predictions.value === 'green') {
                  data.TotalComplianceSolicitation++
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
                                        }).length > 0) { data.LatestUpdateCompliance++ }

                  if (predictions[i].predictions.value === 'red' &&
                                        predictions[i].history.filter(function (e) {
                                          return e['action'].indexOf('Solicitation Updated on FBO.gov') > -1
                                        }).length > 0) { data.LatestUpdateNonCompliance++ }

                  if (predictions[i].history.filter(function (e) {
                    return e['action'].indexOf('sent email to POC') > -1
                  }).length > 0) { data.LatestEmail++ }

                  if (predictions[i].history.filter(function (e) {
                    return e['action'].indexOf('reviewed solicitation action requested summary') > -1
                  }).length > 0) { data.LatestReview++ }

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

          let analytics = {
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
                              uncompliance: data.LatestNonComplianceSolicitation
                            },
            UndeterminedSolicitationChart:
                            {
                              presolicitation: data.LatestPresolicitation,
                              latestOtherUndetermined: data.LatestOtherUndeterminedSolicitation,
                              latestNonMachineReadable: data.LatestMachineUnreadableSolicitation_RED,
                              latestNoDocument: data.LatestNoDocumentSolicitation
                            }
          }

          return res.status(200).send(analytics)
        })
        .catch((e) => {
          logger.log('error', 'error in: analytics', { error:e, tag: 'analytics' })
          return res.status(500).send({})
        })
    } catch (e) {
      logger.log('error', 'error in: analytics', { error:e, tag: 'analytics' })
      return res.status(500).send({})
    }
  }

}
