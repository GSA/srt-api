const _ = require('lodash');
const db = require('../models/index');
const logger = require('../config/winston');
const Notice = require('../models').notice;
const predictionRoute = require('../routes/prediction.routes');



module.exports = {

    // app.get('/solicitation/:id', (req, res) => {
//     Prediction.findById(req.params.id).then((solicitation) => {
//         res.send(solicitation);
//     }, (e) => {
//         res.status(400).send(e);
//     });
// });

        get: function (req, res) {
            return Notice.findById(req.params.id)
                .then((notice) => {
                    return res.status(200).send( predictionRoute.makeOnePrediction(notice) );
                })
                .catch( (e) => {
                    logger.log("error", e, {tag:"solicitation get"})
                    return res.status(400).send("Error finding solicitation");
                });
            },


        /**
         * Update a history list of selected solicitation
         */
        postSolicitation: function (req, res)  {

            var status = req.body.history.filter(function (e) {
                return e["status"] != '';
            })

            return Notice.findOne( {where : {notice_number : req.body.solNum.toString()}})
                .then((notice) => {
                    if (notice == null) {
                        logger.log ("error", req.body , {tag: "postSolicitation - solicitation not found"})
                        return res.status(404).send({msg: "solicitation not found"});
                    }


                    notice.history = req.body.history;
                    notice.feedback = req.body.feedback;
                    if (status.length > 1) {
                        notice.action = {
                            actionStatus: status[status.length - 1]["status"],
                            actionDate: status[status.length - 1]["date"]
                        };
                    }
                    return notice.save()
                        .then((doc) => {
                            //logger.log("error", predictionRoute.makeOnePrediction(doc) , {tag:"notice"})
                            return res.status(200).send( predictionRoute.makeOnePrediction(doc) );
                        })
                        .catch((e) => {
                            logger.log ("error", e, {tag: "postSolicitation - error on save"})
                            res.status(400).send({msg: "error updating solicitation"});
                        })

                })
                .catch((e) => {
                    logger.log ("error", e, {tag: "postSolicitation - error during find"})
                    res.status(400).send({msg: "error updating solicitation"});
                })
        }, // end postSolicitation

        /**
         * Get soliciation feedback
         */
        solicitationFeedback :  (req, res) => {

            // find
            let sql = "select * from notice where jsonb_array_length(feedback) > 0 ";
            db.sequelize.query(sql);

            return db.sequelize.query(sql, {type: db.sequelize.QueryTypes.SELECT})
                .then((notice) => {
                    res.status(200).send( notice.map(predictionRoute.makeOnePrediction) );
                })
                .catch(e => {
                    logger.log ("error", e, {tag: "solicitationFeedback"});
                    res.status(400).send(e);
                })
        }



}


/**
 * Get solicitation based on filter
 */
//
// router.post('/filter', function (req, res) {
//
//     var numData = 10;
//     var filterParams = {
//         "$and": [
//             { 'eitLikelihood.value': 'Yes' },
//             { 'noticeType': { '$ne': 'Presolicitation' } },
//             { 'noticeType': { '$ne': 'Special Notice' } },
//         ]
//     };
//     var agency = req.body.agency.split(' (')[0];
//     var office = req.body.office;
//     var contactInfo = req.body.contactInfo;
//     var solNum = req.body.solNum;
//     var reviewRec = req.body.reviewRec;
//     var eitLikelihood = req.body.eitLikelihood;
//     var reviewStatus = req.body.reviewStatus;
//     var numDocs = req.body.numDocs;
//     var parseStatus = req.body.parsing_report;
//
//     if (agency) {
//         _.merge(filterParams, {agency: agency});
//       }
//       if (contactInfo) {
//         _.merge(filterParams, {contactInfo: contactInfo});
//       }
//       if (office) {
//         _.merge(filterParams, {office: office});
//       }
//       if (solNum) {
//         _.merge(filterParams, {solNum: solNum});
//       }
//       if (reviewRec) {
//         _.merge(filterParams, {reviewRec: reviewRec});
//       }
//       if (eitLikelihood) {
//         _.merge(filterParams, {eitLikelihood: eitLikelihood});
//       }
//       if (reviewStatus) {
//         _.merge(filterParams, {reviewStatus: reviewStatus});
//       }
//       if (numDocs) {
//         _.merge(filterParams, {numDocs: numDocs});
//       }
//       if (parseStatus) {
//         _.merge(filterParams, {parseStatus: parseStatus});
//       }
//
//     // Kailun uses the mongoose to sort and limit the solicitations
//     // Prediction.find(filterParams).sort({'date': -1}).limit(numData).then((predictions) => {
//
//     Prediction.find(filterParams).then((predictions) => {
//       predictions = _.orderBy(predictions, ['date'],['desc'])
//       //var result
//       predictions = predictions.slice(0, numData);
//       res.send(predictions);
//
//     }, (e) => {
//         res.status(400).send(e);
//     })
//
//
// });
//

// /**
//  * route tp get the selected solicitation for detailed display
//  */
// app.get('/solicitation/:id', (req, res) => {
//     Prediction.findById(req.params.id).then((solicitation) => {
//         res.send(solicitation);
//     }, (e) => {
//         res.status(400).send(e);
//     });
// });
//
//
//
// /**
//  * Update a history list of selected solicitation
//  */
// app.post('/solicitation', (req, res) => {
//
//     var status =  req.body.history.filter(function(e){
//         return e["status"] != '';
//     })
//
//     Prediction.findById(req.body._id).then((solicitation) => {
//         solicitation.history = req.body.history;
//         solicitation.feedback = req.body.feedback;
//         if (status.length > 1)
//         {
//             solicitation.actionStatus = status[status.length-1]["status"];
//             solicitation.actionDate = status[status.length-1]["date"];
//         }
//         solicitation.save().then((doc) => {
//             res.send(doc);
//         }, (e) => {
//             res.status(400).send(e);
//         })
//     })
// });
//
// /**
//  * Get soliciation feedback
//  */
// app.post('/solicitation/feedback', (req, res) => {
//     Prediction.find(req.body).then((predictions) => {
//         res.send(predictions);
//     }, (e) => {
//         res.status(400).send(e);
//     });
// })
