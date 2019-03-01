const _ = require('lodash');
// const db = require('../models/index');
const logger = require('../config/winston');
const Notice = require('../models').notice;
const predictionRoute = require('../routes/prediction.routes');



module.exports = function (db) {

    return {

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
                    return res.status(200).send(predictionRoute.makeOnePrediction(notice));
                })
                .catch((e) => {
                    logger.log("error", e, {tag: "solicitation get"})
                    return res.status(400).send("Error finding solicitation");
                });
        },


        /**
         * Update a history list of selected solicitation
         */
        postSolicitation: function (req, res) {

            var status = req.body.history.filter(function (e) {
                return e["status"] != '';
            })

                    return Notice.findAll({
                        where: {notice_number: req.body.solNum.toString()},
                        order : [ ['date', "desc"] ]
                    })
                        .then((notices) => {
                            // we are only going to work with the first entry - which is the newest row having the given notice_number
                            let notice = (notices.length > 0) ? notices[0] : null;
                            if (notice == null) {
                                logger.log("error", req.body, {tag: "postSolicitation - solicitation not found"})
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
                                    return res.status(200).send(predictionRoute.makeOnePrediction(doc));
                                })
                                .catch((e) => {
                                    logger.log("error", e, {tag: "postSolicitation - error on save"})
                                    res.status(400).send({msg: "error updating solicitation"});
                                })

                        })
                .catch((e) => {
                    logger.log("error", e, {tag: "postSolicitation - error during find"})
                    res.status(400).send({msg: "error updating solicitation"});
                })

        }, // end postSolicitation

        /**
         * Get soliciation feedback
         */
        solicitationFeedback: (req, res) => {

            // translate mongo formatted parameters to postgres
            let where = [" 1 = 1 "]
            let limit = "";
            let order = "";
            if (req.body.solNum) {
                where.push (` notice_number = '${req.body.solNum}' `);
                limit = " limit 1 "; // notice number should be unique, but isn't in the test data. Yikes!
                order = " order by date desc "; // take the one with the most recent date
            }
            if (req.body["$where"] && req.body["$where"].match(/this.feedback.length.?>.?0/i)) {
                where.push (` jsonb_array_length(feedback) > 0 `);
            }

            let sql = "select * from notice where " + where.join(" AND ") + order + limit;

            return db.sequelize.query(sql, {type: db.sequelize.QueryTypes.SELECT})
                .then((notice) => {
                    res.status(200).send(notice.map(predictionRoute.makeOnePrediction));
                })
                .catch(e => {
                    logger.log("error", e, {tag: "solicitationFeedback"});
                    res.status(400).send(e);
                })
        }


    }
}
