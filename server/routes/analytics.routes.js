const logger = require('../config/winston');
const predictionRoutes = require('./prediction.routes');

function predictionFind(params) {
    return predictionRoutes.getPredictions(params)
        .then ( (allPredictions) => {

            let filteredPredictions = [];
            for (let i =0; i < allPredictions.length; i++) {
                for (let prop in params) {
                    if (allPredictions[i][prop] == params[prop] ||
                        (allPredictions[i][prop] &&
                            allPredictions[i][prop].value &&
                            allPredictions[i][prop].value == params[prop] )
                    ) {
                        filteredPredictions.push( allPredictions[i] );
                    }
                }
            }
            return filteredPredictions;
        })

        .catch (e => {
            logger.log("error", e, {tag: "predictionFind"});
            return [];
        })

}


module.exports = {

    analytics : (req, res) => {
        try {
            var params = {};

            var fromPeriod = req.body.fromPeriod;
            var toPeriod = req.body.toPeriod;
            var agency = req.body.agency;
            var date = fromPeriod.split('/');
            var from = new Date(date[2], date[0] - 1, date[1]);

            date = toPeriod.split('/');
            var to = new Date(date[2], date[0] - 1, date[1]);

            var scannedToDate = new Date(new Date().getTime() - (1000 * 60 * 60 * 24));
            var scannedFromDate = new Date(new Date().getTime() - (1000 * 60 * 60 * 24 * 32));


            // this code failes for me.... merge doesn't seem to be a function in underscore.js
            // not sure what's going on here since params is always an empty array at this point
            // in the legacy code I have from
            //_.merge(params, {"eitLikelihood.value": "Yes"});
            params.eitLikelihood = "Yes"
            params.fromPeriod = fromPeriod;
            params.toPeriod = toPeriod;
            params.agency = agency;


            return predictionFind(params)
                .then( (predictions) => {
                    var timer1 = new Date().getMilliseconds();

                    var data = {
                        // Total number of ICT
                        TotalICT: predictions.length,
                        LatestICT: 0,
                        // Number of ICT Presolicitation
                        TotalPresolicitation: 0,
                        LatestPresolicitation: 0,
                        // Number of ICT Non Presolicitation
                        TotalNonPresolicitation: 0,
                        LatestNonPresolicitation: 0,
                        // Nmber of 0 document solicitation
                        TotalNoDocumentSolicitation: 0,
                        LatestNoDocumentSolicitation: 0,
                        // Nmber of 0 document solicitation Green
                        TotalNoDocumentSolicitation_GREEN: 0,
                        LatestNoDocumentSolicitation_GREEN: 0,
                        // Nmber of 0 document solicitation Red
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
                        topAgencies: {},

                    }
                    var map = {};

                    // Start for loop
                    for (var i = 0; i < data.TotalICT; i++) {

                        // if (predictions[i].solNum != undefined) {
                        //     console.log(predictions[i].solNum);
                        // }
                        //
                        //
                        //

                        var latest = new Date(predictions[i].date) > scannedFromDate && new Date(predictions[i].date) < scannedToDate;

                        if (latest) data.LatestICT++;

                        if (predictions[i].noticeType != 'Presolicitation' && predictions[i].noticeType != 'Special Notice') {
                            if (latest) data.LatestNonPresolicitation++;
                            data.TotalNonPresolicitation++;


                            if (predictions[i].parseStatus.length != 0) {


                                // Machine Readable Document
                                for (var j = 0; j < predictions[i].parseStatus.length; j++) {
                                    if (latest) {
                                        if (predictions[i].parseStatus[j].status == "successfully parsed") {
                                            data.LatestMachineReadableDocument++;
                                        } else {
                                            data.LatestMachineUnreadableDocument++;
                                        }
                                    }
                                    if (predictions[i].parseStatus[j].status == "successfully parsed") {
                                        data.TotalMachineReadableDocument++;
                                    } else {
                                        data.TotalMachineUnreadableDocument++;
                                    }

                                }

                                for (var j = 0; j < predictions[i].parseStatus.length; j++) {
                                    // Non machine readable solictations
                                    if (predictions[i].parseStatus[j].status == "processing error") {

                                        if (predictions[i].predictions.value == 'RED') {
                                            if (latest) {
                                                data.LatestMachineUnreadableSolicitation_RED++;
                                            }
                                            data.TotalMachineUnreadableSolicitation_RED++;
                                        } else {
                                            if (latest) {
                                                data.LatestMachineUnreadableSolicitation_GREEN++;
                                            }
                                            data.TotalMachineUnreadableSolicitation_GREEN++;
                                        }
                                        if (latest) {
                                            data.LatestMachineUnreadableSolicitation++;
                                        }
                                        data.TotalMachineUnreadableSolicitation++;
                                        break
                                    }

                                }

                            } else if (predictions[i].parseStatus.length == 0 && predictions[i].numDocs == '0') {
                                if (predictions[i].predictions.value == 'RED') {
                                    if (latest) {
                                        data.LatestNoDocumentSolicitation_RED++;
                                    }
                                    data.TotalNoDocumentSolicitation_RED++;
                                } else {
                                    if (latest) {
                                        data.LatestNoDocumentSolicitation_GREEN++;
                                    }
                                    data.TotalNoDocumentSolicitation_GREEN++;
                                }
                                if (latest) {
                                    data.LatestNoDocumentSolicitation++;
                                }
                                data.TotalNoDocumentSolicitation++;
                            } else {

                                if (predictions[i].predictions.value == 'RED') {
                                    if (latest) {
                                        data.LatestOtherUndeterminedSolicitation_RED++;
                                    }
                                    data.TotalOtherUndeterminedSolicitation_RED++;
                                } else {
                                    if (latest) {
                                        data.LatestOtherUndeterminedSolicitation_GREEN++;
                                    }
                                    data.TotalOtherUndeterminedSolicitation_GREEN++;
                                }
                                if (latest) {
                                    data.LatestOtherUndeterminedSolicitation++;
                                }
                                data.TotalOtherUndeterminedSolicitation++;
                            }


                            if (!predictions[i].undetermined) {

                                // precition result chart
                                if (latest) {
                                    if (predictions[i].predictions.value == "GREEN") {
                                        data.LatestComplianceSolicitation++
                                    }
                                    else data.LatestNonComplianceSolicitation++
                                }
                                if (predictions[i].predictions.value == "GREEN") {
                                    data.TotalComplianceSolicitation++
                                }
                                else data.TotalNonComplianceSolicitation++

                                // scanned solicitation chart
                                if (latest) {
                                    var day = "";
                                    if (typeof(predictions[i].date) == "string"){
                                        // it is a string
                                        day = +(predictions[i].date.split('/')[0] + predictions[i].date.split('/')[1]);
                                    } else {
                                        //it is a date object
                                        day = +((predictions[i].date.getMonth()+1) +"" +  predictions[i].date.getDate());
                                    }

                                    if (data.ScannedSolicitation[day] == null) data.ScannedSolicitation[day] = 1;
                                    else data.ScannedSolicitation[day] = data.ScannedSolicitation[day] + 1;
                                }

                            } else {
                                if (latest) {
                                    data.LatestUndeterminedSolicitation++;
                                }
                                data.TotalUndeterminedSolicitation++;
                            }
                            // Filter Section
                            if (new Date(predictions[i].date) > from &&
                                new Date(predictions[i].date) < to &&
                                (agency == predictions[i].agency || agency == "Government-wide")) {
                                if (!predictions[i].undetermined) {

                                    if (predictions[i].predictions.value == "GREEN") {
                                        data.FilteredComplianceSolicitation++
                                    }
                                    else data.FilteredNonComplianceSolicitation++


                                    if (predictions[i].predictions.value == "GREEN" &&
                                        predictions[i].history.filter(function (e) {
                                            return e["action"].indexOf('Solicitation Updated on FBO.gov') > -1
                                        }).length > 0)
                                        data.LatestUpdateCompliance++

                                    if (predictions[i].predictions.value == "RED" &&
                                        predictions[i].history.filter(function (e) {
                                            return e["action"].indexOf('Solicitation Updated on FBO.gov') > -1
                                        }).length > 0)
                                        data.LatestUpdateNonCompliance++

                                    if (predictions[i].history.filter(function (e) {
                                        return e["action"].indexOf('sent email to POC') > -1
                                    }).length > 0)
                                        data.LatestEmail++;

                                    if (predictions[i].history.filter(function (e) {
                                        return e["action"].indexOf('reviewed solicitation action requested summary') > -1
                                    }).length > 0)
                                        data.LatestReview++;


                                    /******************************
                                     *   Top Agencies bar chart   *
                                     ******************************/
                                    // if filter is Government-wide, we don't need to worry about prediction date.
                                    if (agency == "Government-wide") {
                                        // Top Agency section
                                        if (map[predictions[i].agency] == null) {
                                            map[predictions[i].agency] = 1;
                                            data.topAgencies[predictions[i].agency] = {};
                                            data.topAgencies[predictions[i].agency]["name"] = predictions[i].agency;
                                            data.topAgencies[predictions[i].agency]["red"] = 0;
                                            data.topAgencies[predictions[i].agency]["green"] = 0;
                                            if (predictions[i].predictions.value == "GREEN") data.topAgencies[predictions[i].agency]["green"]++;
                                            else data.topAgencies[predictions[i].agency]["red"]++;

                                        } else {
                                            if (predictions[i].predictions.value == "GREEN") data.topAgencies[predictions[i].agency]["green"]++;
                                            else data.topAgencies[predictions[i].agency]["red"]++;
                                        }
                                    } else {

                                        if (predictions[i].agency == agency) {
                                            if (data.topAgencies[agency] == null) data.topAgencies[agency] = [predictions[i]];
                                            else data.topAgencies[agency].push(predictions[i]);
                                        }
                                    }
                                }
                            }

                        } else {
                            if (latest) data.LatestPresolicitation++;
                            data.TotalPresolicitation++;
                        }


                    }

                    var analytics = {
                        ScannedSolicitationChart:
                            {
                                scannedData: data.ScannedSolicitation,
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
                                uncompliance: data.FilteredNonComplianceSolicitation,
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
                .catch( (e) => {
                    logger.log("error", e, {tag: "analytics"});
                    return res.status(500).send({});
                })

        } catch (e) {
            logger.log("error", e, {tag: "analytics"});
            return res.status(500).send({});
        }
    }

};


// app.post('/Analytics', (req, res) => {
//     var params = {};
//
//     var fromPeriod = req.body.fromPeriod;
//     var toPeriod = req.body.toPeriod;
//     var agency = req.body.agency;
//     var date = fromPeriod.split('/');
//     var from = new Date(date[2], date[0] - 1, date[1]);
//
//     date = toPeriod.split('/');
//     var to = new Date(date[2], date[0] - 1, date[1]);
//
//     var scannedToDate = new Date(new Date().getTime() - (1000 * 60 * 60 * 24 ));
//     var scannedFromDate = new Date(new Date().getTime() - (1000 * 60 * 60 * 24 * 32 ));
//
//     _.merge(params, {"eitLikelihood.value":"Yes"});
//
//     Prediction.find(params).then((predictions) => {
//         var timer1 = new Date().getMilliseconds();
//
//         var data = {
//             // Total number of ICT
//             TotalICT: predictions.length,
//             LatestICT: 0,
//             // Number of ICT Presolicitation
//             TotalPresolicitation: 0,
//             LatestPresolicitation: 0,
//             // Number of ICT Non Presolicitation
//             TotalNonPresolicitation: 0,
//             LatestNonPresolicitation: 0,
//             // Nmber of 0 document solicitation
//             TotalNoDocumentSolicitation: 0,
//             LatestNoDocumentSolicitation: 0,
//             // Nmber of 0 document solicitation Green
//             TotalNoDocumentSolicitation_GREEN: 0,
//             LatestNoDocumentSolicitation_GREEN: 0,
//             // Nmber of 0 document solicitation Red
//             TotalNoDocumentSolicitation_RED: 0,
//             LatestNoDocumentSolicitation_RED: 0,
//             // Number of other undetermined solicitation
//             TotalOtherUndeterminedSolicitation: 0,
//             LatestOtherUndeterminedSolicitation: 0,
//             // Number of other undetermined solicitation Green
//             TotalOtherUndeterminedSolicitation_GREEN: 0,
//             LatestOtherUndeterminedSolicitation_GREEN: 0,
//             // Number of other undetermined solicitation Red
//             TotalOtherUndeterminedSolicitation_RED: 0,
//             LatestOtherUndeterminedSolicitation_RED: 0,
//             // Number of machine readable document
//             TotalMachineReadableDocument: 0,
//             LatestMachineReadableDocument: 0,
//             // Number of machine unreadable document
//             TotalMachineUnreadableDocument: 0,
//             LatestMachineUnreadableDocument: 0,
//             // Number of machine unreadable solicitation
//             TotalMachineUnreadableSolicitation: 0,
//             LatestMachineUnreadableSolicitation: 0,
//             // Number of machine unreadable red solicitation
//             TotalMachineUnreadableSolicitation_RED: 0,
//             LatestMachineUnreadableSolicitation_RED: 0,
//             // Number of machine unreadable green solicitation
//             TotalMachineUnreadableSolicitation_GREEN: 0,
//             LatestMachineUnreadableSolicitation_GREEN : 0,
//             // Number of Undetermined Solicitation
//             TotalUndeterminedSolicitation: 0,
//             LatestUndeterminedSolicitation: 0,
//
//             // Number of Compliance
//             TotalComplianceSolicitation: 0,
//             LatestComplianceSolicitation: 0,
//             FilteredComplianceSolicitation: 0,
//             // Number of Non Compliance
//             TotalNonComplianceSolicitation: 0,
//             LatestNonComplianceSolicitation: 0,
//             FilteredNonComplianceSolicitation: 0,
//
//             // Update
//             LatestUpdateCompliance: 0,
//             LatestUpdateNonCompliance: 0,
//             LatestEmail: 0,
//             LatestReview: 0,
//
//             // Scanned Data
//             ScannedSolicitation: {},
//
//             // Top Agency
//             topAgencies : {},
//
//         }
//         var map = {};
//
//         // Start for loop
//         for (var i = 0; i < data.TotalICT; i++) {
//
//             var latest = new Date(predictions[i].date) > scannedFromDate && new Date(predictions[i].date) < scannedToDate;
//
//             if (latest) data.LatestICT++;
//
//             if (predictions[i].noticeType != 'Presolicitation' && predictions[i].noticeType != 'Special Notice')
//             {
//                 if (latest) data.LatestNonPresolicitation++;
//                 data.TotalNonPresolicitation++;
//
//
//                 if (predictions[i].parseStatus.length != 0)
//                 {
//
//
//                     // Machine Readable Document
//                     for (var j = 0; j < predictions[i].parseStatus.length; j ++)
//                     {
//                         if (latest)
//                         {
//                             if (predictions[i].parseStatus[j].status == "successfully parsed") data.LatestMachineReadableDocument++;
//                             else data.LatestMachineUnreadableDocument++;
//                         }
//                         if (predictions[i].parseStatus[j].status == "successfully parsed") data.TotalMachineReadableDocument++;
//                         else data.TotalMachineUnreadableDocument++;
//
//                     }
//
//                     for (var j = 0; j < predictions[i].parseStatus.length; j ++)
//                     {
//                         // Non machine readable solictations
//                         if (predictions[i].parseStatus[j].status == "processing error")
//                         {
//
//                             if (predictions[i].predictions.value=='RED')
//                             {
//                                 if (latest) data.LatestMachineUnreadableSolicitation_RED++;
//                                 data.TotalMachineUnreadableSolicitation_RED++;
//                             }
//                             else
//                             {
//                                 if (latest) data.LatestMachineUnreadableSolicitation_GREEN++;
//                                 data.TotalMachineUnreadableSolicitation_GREEN++;
//                             }
//                             if (latest) data.LatestMachineUnreadableSolicitation++;
//                             data.TotalMachineUnreadableSolicitation++;
//                             break
//                         }
//
//                     }
//
//                 }
//                 else if (predictions[i].parseStatus.length == 0 && predictions[i].numDocs == '0')
//                 {
//                     if (predictions[i].predictions.value=='RED')
//                     {
//                         if (latest) data.LatestNoDocumentSolicitation_RED++;
//                         data.TotalNoDocumentSolicitation_RED++;
//                     }
//                     else
//                     {
//                         if (latest) data.LatestNoDocumentSolicitation_GREEN++;
//                         data.TotalNoDocumentSolicitation_GREEN++;
//                     }
//                     if (latest) data.LatestNoDocumentSolicitation++;
//                     data.TotalNoDocumentSolicitation++;
//                 }
//                 else
//                 {
//
//                     if (predictions[i].predictions.value=='RED')
//                     {
//                         if (latest) data.LatestOtherUndeterminedSolicitation_RED++;
//                         data.TotalOtherUndeterminedSolicitation_RED++;
//                     }
//                     else
//                     {
//                         if (latest) data.LatestOtherUndeterminedSolicitation_GREEN++;
//                         data.TotalOtherUndeterminedSolicitation_GREEN++;
//                     }
//                     if (latest) data.LatestOtherUndeterminedSolicitation++;
//                     data.TotalOtherUndeterminedSolicitation++;
//                 }
//
//
//                 if (!predictions[i].undetermined)
//                 {
//
//                     // precition result chart
//                     if (latest)
//                     {
//                         if (predictions[i].predictions.value == "GREEN")  data.LatestComplianceSolicitation++
//                         else data.LatestNonComplianceSolicitation++
//                     }
//                     if (predictions[i].predictions.value == "GREEN")  data.TotalComplianceSolicitation++
//                     else data.TotalNonComplianceSolicitation++
//
//                     // scanned solicitation chart
//                     if (latest)
//                     {
//                         var day = +(predictions[i].date.split('/')[0] + predictions[i].date.split('/')[1]);
//                         if (data.ScannedSolicitation[day] == null) data.ScannedSolicitation[day] = 1;
//                         else data.ScannedSolicitation[day] = data.ScannedSolicitation[day] + 1;
//                     }
//
//                 }
//                 else
//                 {
//                     if (latest) data.LatestUndeterminedSolicitation++;
//                     data.TotalUndeterminedSolicitation++;
//                 }
//                 // Filter Section
//                 if (new Date(predictions[i].date) > from &&
//                     new Date(predictions[i].date) < to &&
//                     (agency == predictions[i].agency || agency == "Government-wide"))
//                 {
//                     if (!predictions[i].undetermined)
//                     {
//
//                         if (predictions[i].predictions.value == "GREEN")  data.FilteredComplianceSolicitation++
//                         else data.FilteredNonComplianceSolicitation++
//
//                         if (predictions[i].predictions.value == "GREEN" &&
//                             predictions[i].history.filter(function(e){return e["action"].indexOf('Solicitation Updated on FBO.gov') > -1 }).length > 0)
//                             data.LatestUpdateCompliance++
//
//                         if (predictions[i].predictions.value == "RED" &&
//                             predictions[i].history.filter(function(e){return e["action"].indexOf('Solicitation Updated on FBO.gov') > -1 }).length > 0)
//                             data.LatestUpdateNonCompliance++
//
//                         if (predictions[i].history.filter(function(e){return e["action"].indexOf('sent email to POC') > -1}).length > 0)
//                             data.LatestEmail++;
//
//                         if (predictions[i].history.filter(function(e){return e["action"].indexOf('reviewed solicitation action requested summary') > -1}).length > 0)
//                             data.LatestReview++;
//
//
//                         /******************************
//                          *   Top Agencies bar chart   *
//                          ******************************/
//                         // if filter is Government-wide, we don't need to worry about prediction date.
//                         if (agency == "Government-wide")
//                         {
//                             // Top Agency section
//                             if (map[predictions[i].agency] == null)
//                             {
//                                 map[predictions[i].agency] = 1;
//                                 data.topAgencies[predictions[i].agency] = {};
//                                 data.topAgencies[predictions[i].agency]["name"] = predictions[i].agency;
//                                 data.topAgencies[predictions[i].agency]["red"] = 0;
//                                 data.topAgencies[predictions[i].agency]["green"] = 0;
//                                 if (predictions[i].predictions.value == "GREEN") data.topAgencies[predictions[i].agency]["green"]++;
//                                 else data.topAgencies[predictions[i].agency]["red"]++ ;
//
//                             }
//                             else {
//                                 if (predictions[i].predictions.value == "GREEN") data.topAgencies[predictions[i].agency]["green"]++;
//                                 else data.topAgencies[predictions[i].agency]["red"]++ ;
//                             }
//                         }
//                         else
//                         {
//
//                             if (predictions[i].agency == agency)
//                             {
//                                 if (data.topAgencies[agency] == null) data.topAgencies[agency] = [predictions[i]];
//                                 else data.topAgencies[agency].push(predictions[i]);
//                             }
//                         }
//                     }
//                 }
//
//             }
//             else
//             {
//                 if (latest) data.LatestPresolicitation++;
//                 data.TotalPresolicitation++;
//             }
//
//
//         }
//
//         var analytics = {
//             ScannedSolicitationChart:
//                 {
//                     scannedData: data.ScannedSolicitation,
//                 },
//             MachineReadableChart:
//                 {
//                     machineReadable: data.LatestMachineReadableDocument,
//                     machineUnreadable: data.LatestMachineUnreadableDocument
//                 },
//             ComplianceRateChart:
//                 {
//                     compliance: data.FilteredComplianceSolicitation,
//                     determinedICT: data.FilteredComplianceSolicitation + data.FilteredNonComplianceSolicitation
//                 },
//             ConversionRateChart:
//                 {
//                     updatedCompliantICT: data.LatestUpdateCompliance,
//                     uncompliance: data.FilteredNonComplianceSolicitation,
//                 },
//             TopSRTActionChart:
//                 {
//                     determinedICT: data.FilteredComplianceSolicitation + data.FilteredNonComplianceSolicitation,
//                     uncompliance: data.FilteredNonComplianceSolicitation,
//                     review: data.LatestReview,
//                     email: data.LatestEmail,
//                     updatedICT: data.LatestUpdateCompliance + data.LatestUpdateNonCompliance,
//                     updatedCompliantICT: data.LatestUpdateCompliance,
//                     updatedNonCompliantICT: data.LatestUpdateNonCompliance
//                 },
//             TopAgenciesChart:
//                 {
//                     topAgencies: data.topAgencies
//                 },
//             PredictResultChart:
//                 {
//                     compliance: data.LatestComplianceSolicitation,
//                     uncompliance: data.LatestNonComplianceSolicitation
//                 },
//             UndeterminedSolicitationChart:
//                 {
//                     presolicitation: data.LatestPresolicitation,
//                     latestOtherUndetermined: data.LatestOtherUndeterminedSolicitation,
//                     latestNonMachineReadable: data.LatestMachineUnreadableSolicitation_RED,
//                     latestNoDocument: data.LatestNoDocumentSolicitation
//                 },
//             // test:
//             // {
//             //     TotalICT: predictions.length,
//
//             //     latestCompliance: latestCompliance,
//             //     latestUncompliance: latestUncompliance,
//             //     latestPresolicitation: latestPresolicitation,
//             //     latestUndetermined: latestUndetermined,
//             //     latestNonMachineReadable: latestNonMachineReadable,
//             //     latestNoDocument: latestNoDocument,
//             //     latestOtherUndetermined: latestOtherUndetermined
//             // }
//         }
//         res.send(analytics);
//     }, (e) => {
//         res.status(400).send(e);
//     });
//
// });
