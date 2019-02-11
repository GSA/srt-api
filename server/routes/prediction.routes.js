const logger = require('../config/winston');
const NodeCache = require( "node-cache" );
const myCache = new NodeCache();
const Notice = require('../models').notice;
const Attachment = require('../models').attachment;
const db = require('../models/index');
var SqlString = require('sequelize/lib/sql-string')


require('../tests/test.lists');


const randomWords = require('random-words');

const mapping_documentation =

    {
        solNum: "N.notice_number",
        title: "???",
        url: "N.notice_data.url",
        predictions: {
            value: "attachment.prediction (1 is GREEN , 0 is RED)"
        },
        reviewRec: "??? should be enuumerated type with at least values of one of 'Compliant', 'Non-compliant (Action Required)', or 'Undetermined'",
        date: "N.date",
        numDocs: "count attachments where attachments.notice_id = N.id",
        eitLikelihood: {
            naics: "N.notice_data.naics",
            value: "???? - expected one of 'Yes' or 'No'"
        },
        agency: "N.agency",
        office: "N.notice_data.office",
        contactInfo: {
            contact: "N.notice_data.contact",
            name: "N.notice_data.contact (not always well structured)",
            position: "N.notice_data.contact (not always well structured)",
            email: "N.notice_data.contact (not always well structured)"
        },
        position: "???",
        reviewStatus: "??? enumerated type. One possible value is 'Incomplete'",
        noticeType: "notice_type.notice_type - but probably needs to be mapped to UI expected values",
        actionStatus: "N.action - parsing TBD",
        actionDate: "N.action - parsing TBD",
        parseStatus: [{
            name: "attachment.name",
            status: "??? enumeration - one of 'successfully parsed' or 'processing error'  " +
                "maybe derived from attachment.validation, but that col is NULL for " +
                "all test records."
        }],
        history: [{
            date: "TBD - may be separate log table for user actions managed by web back end",
            action: "TBD - may be separate log table for user actions managed by web back end",
            user: "TBD - may be separate log table for user actions managed by web back end",
            status: "TBD - may be separate log for user actions table managed by web back end"
        }],
        feedback: [{
            questionID: "???",
            question: "???",
            answer: "???",
        }],
        undetermined: "??? UI expects 0 or 1"
    };

        let reviewRecArray = ["Compliant", "Non-compliant (Action Required)", "Undetermined"];
        let noticeTypeArray = ["Presolicitation", "Combined Synopsis/Solicitation", "Sources Sought", "Special Notice", "Other"];
        let actionStatusArray = ["Email Sent to POC", "reviewed solicitation action requested summary", "provided feedback on the solicitation prediction result"];


// TODO: Remove this fake random implementation before going to production
Math.seed = 52;

function getRandomInt(min, max) {
    max = (max === undefined) ? 1 : max;
    min = (min === undefined) ? 1 : min;

    Math.seed = (Math.seed * 9301 + 49297) % 233280;
    var rnd = Math.seed / 233280;

    return Math.floor(min + rnd * (max - min));
}
function pickOne(a) {
    return a[getRandomInt(0, a.length)]
}

let template =

    {
        solNum: "1234",
        title: "sample title",
        url: "http://www.tcg.com/",
        predictions: {
            value: "GREEN"
        },
        reviewRec: "Compliant", // one of "Compliant", "Non-compliant (Action Required)", or "Undetermined"
        date: "01/01/2019",
        numDocs: 3,
        eitLikelihood: {
            naics: "naics here",  // initial version uses NAICS code to determine
            value: "45"
        },
        agency: "National Institutes of Health",
        office: "Office of the Director",

        contactInfo: {
            contact: "contact str",
            name: "Joe Smith",
            position: "Manager",
            email: "joe@example.com"
        },
        position: "pos string",
        reviewStatus: "on time",
        noticeType: "N type",
        actionStatus: "ready",
        actionDate: "02/02/2019",
        parseStatus: [{
            name: "attachment name",
            status: "??? enumeration, one of 'successfully parsed', 'processing error'  maybe derived f"
        }],
        history: [{
            date: "03/03/2018",
            action: "sending",
            user: "crowley",
            status: "submitted"
        }],
        feedback: [{
            questionID: "1",
            question: "Is this a good solicitation?",
            answer: "Yes",
        }],
        undetermined: true

    };


function mockData() {
    if (myCache.get("sample_data") != undefined) {
        return myCache.get("sample_data");
    }

        let reviewRecArray = ["Compliant", "Non-compliant (Action Required)", "Undetermined"];
        let noticeTypeArray = ["Presolicitation", "Combined Synopsis/Solicitation", "Sources Sought", "Special Notice", "Other"];
        let actionStatusArray = ["Email Sent to POC", "reviewed solicitation action requested summary", "provided feedback on the solicitation prediction result"];
        let template =

            {
                solNum: "1234",
                title: "sample title",
                url: "http://www.tcg.com/",
                predictions: {
                    value: "GREEN"
                },
                reviewRec: "Compliant", // one of "Compliant", "Non-compliant (Action Required)", or "Undetermined"
                date: "01/01/2019",
                numDocs: 3,
                eitLikelihood: {
                    naics: "naics here",  // initial version uses NAICS code to determine
                    value: "45"
                },
                agency: "National Institutes of Health",
                office: "Office of the Director",

                contactInfo: {
                    contact: "contact str",
                    name: "Joe Smith",
                    position: "Manager",
                    email: "joe@example.com"
                },
                position: "pos string",
                reviewStatus: "on time",
                noticeType: "N type",
                actionStatus: "ready",
                actionDate: "02/02/2019",
                parseStatus: [{
                    name: "doc 1",
                    status: "parsed"
                }],
                history: [{
                    date: "03/03/2018",
                    action: "sending",
                    user: "crowley",
                    status: "submitted"
                }],
                feedback: [{
                    questionID: "1",
                    question: "Is this a good solicitation?",
                    answer: "Yes",
                }],
                undetermined: true

            };

        let sample_data = new Array();

        for (let i = 0; i < 6000; i++) {
            let o = Object.assign({}, template);

            o.title = randomWords({exactly: 1, wordsPerString: getRandomInt(2, 7)})[0];
            o.reviewRec = pickOne(reviewRecArray);
            o.agency = pickOne(all_fed_agencies_array);
            o.numDocs = getRandomInt(0,3);
            o.solNum = getRandomInt(999, 99999999);
            o.noticeType = pickOne(noticeTypeArray);
            o.actionStatus = pickOne(actionStatusArray);
            o.actionDate = new Date( getRandomInt(2018, 2020),  getRandomInt(0, 12),getRandomInt(1,27));;;
            o.date = new Date( getRandomInt(2018, 2020),  getRandomInt(0, 12),getRandomInt(1,27));;
            o.office = randomWords({exactly: 1, wordsPerString: getRandomInt(2, 4)})[0];
            o.predictions = Object.assign({}, template.predictions);
            o.predictions.value = pickOne(["RED", "GREEN"]);
            o.eitLikelihood = Object.assign({}, template.eitLikelihood);
            o.eitLikelihood.naics = getRandomInt(10, 99999);
            o.eitLikelihood.value = pickOne(['Yes', 'No']);
            o.undetermined = (getRandomInt(0,2) == 0);

            o.parseStatus = [];
            let count = getRandomInt(0,3);
            for (let x=0; x < count; x++) {
                let stat = {};
                stat.name = "doc 1";
                stat.status = pickOne( ["successfully parsed", "processing error"] )
                o.parseStatus.push ( stat )
            }

            sample_data.push(o);
        }

        myCache.set("sample_data", sample_data);
        return sample_data;
}

function parseAction(action_string) {
    return [
        {
            actionStatus: pickOne(actionStatusArray),
            actionDate: new Date( getRandomInt(2018, 2020),  getRandomInt(0, 12),getRandomInt(1,27))
        }
        ];

}

function makeOnePrediction(notice) {
    let o = {}; //Object.assign({}, template);

    // let act = parseAction(notice.action);

    o.id = notice.id;
    o.title = (notice.notice_data  != undefined) ? notice.notice_data.subject : "";
    o.reviewRec = pickOne(reviewRecArray);
    o.agency = notice.agency;
    o.numDocs = (notice.attachment_json) ? notice.attachment_json.length : 0;
    o.solNum = notice.notice_number;
    o.noticeType = notice.notice_type; //TODO: need to map these to values expected by the UI
    o.actionStatus = ""//(act.length > 0) ? act[0].actionStatus : "";
    o.actionDate = ""//(act.length > 0) ? act[0].actionDate : "";
    o.date = notice.date;
    o.office = (notice.notice_data != undefined) ? notice.notice_data.office : "";
    o.predictions = {
        value: (notice.compliant == 1) ? "GREEN" : "RED",
    };
    o.eitLikelihood = {
        naics: notice.naics,
        value: 'Yes'
    }
    o.undetermined = 0; //(getRandomInt(0, 2) == 0);
    o.action = notice.action;
    o.feedback = notice.feedback ? notice.feedback : [];
    o.history = notice.history ? notice.history : [];

    o.contactInfo = {
        contact: "Contact",
        name: "Contact Name",
        position: "Position",
        email: "crowley+contact@tcg.com"

    }

    o.parseStatus = (notice.attachment_json != undefined) ? notice.attachment_json : [];

    return o;

}

function  makePostgresDate (origDate) {
    let split = origDate.split("/");
    if (split.length < 3) {
        split = origDate.split("-");
    }
    if (split.length < 3) { return ""; }
    if (split[0] > 1900) {
        // looks like it may have already been in year-month-day format
        return origDate;
    }
    return split[2] + "-" + split[0] + "-" + split[1];

}
function getPredictions(filter) {
    let agency = (filter.agency) ? filter.agency.split(' (')[0] : undefined;
    let office = filter.office;
    let numDocs = filter.numDocs;
    let solNum = filter.solNum;
    let startDate = (filter.startDate) ? filter.startDate : filter.fromPeriod;
    let endDate = (filter.endDate) ? filter.endDate : filter.toPeriod;;

    let where_array = [ "1 = 1"];
    if (office && office != "") {
        where_array.push( "notice_data->>'office' = " + SqlString.escape(office, null, 'postgres'));
    }
    if (agency && agency != "" && agency != "Government-wide") {
        where_array.push( "agency = " + SqlString.escape(agency, null, "postgres"))
    }
    if (numDocs && numDocs != "") {
        where_array.push( "attachment_count = " + SqlString.escape(numDocs, null, "postgres"))
    }
    if (solNum && solNum != "") {
        where_array.push( "notice_number = " + SqlString.escape(solNum, null, "postgres"))
    }
    if (startDate && startDate != "") {
        where_array.push( "date > " + SqlString.escape(makePostgresDate(startDate), null, "postgres"))
    }
    if (endDate && endDate != "") {
        where_array.push( "date < " + SqlString.escape(makePostgresDate(endDate), null, "postgres"))
    }


    let where = where_array.join(" AND ");
    let sql = `
            select * 
            from notice n 
            left join ( 
                  select notice_id, json_agg(src) as attachment_json, count(*) as attachment_count
                  from notice 
                  left join ( 
                    select id as name, case validation when 1 then 'successfully parsed' else 'unsuccessfuly parsed' end as status, notice_id 
                    from attachment
                    ) src on notice.id = src.notice_id             
                  group by  notice_id
                  ) a on a.notice_id = n.id
            WHERE ${where} 
            order by id desc
            limit 400000 `;

    console.time("sql")
    return db.sequelize.query(sql, {type: db.sequelize.QueryTypes.SELECT})
        .then(notices => {
            console.timeEnd("sql")
            let data = [];
            console.time("marshal")
            for (let i = 0; i < notices.length; i++) {
                data.push(makeOnePrediction(notices[i]));
            }
    console.timeEnd("marshal")
            return data;
        })
        .catch(e => {
            logger.log("error", e, {tag: "getPredictions", sql: sql});
            return null;
        });

}

/**
 * prediction routes
 */
module.exports = {

    getPredictions: getPredictions,

    makeOnePrediction: makeOnePrediction,

    predictionFilter:  function (req, res) {
        let data = [];

        // currently unsupported filters
        var parseStatus = req.body.parsing_report;
        var contactInfo = req.body.contactInfo;
        var reviewRec = req.body.reviewRec;
        var reviewStatus = req.body.reviewStatus;

        // verify that only supported filter params are used
        let keys = Object.keys(req.body);
        for (let i=0; i< keys.length; i++) {
            if ( req.body[keys[i]] != "" && ! ["agency", "office", "numDocs", "solNum", "eitLikelihood", "startDate", "fromPeriod", "endDate", "toPeriod"].includes (keys[i]) ) {
                logger.log("error", req.body, {tag: "predictionFilter - " + "Received unsupported filter parameter " + keys[i]});
                return res.status(500).send({message: "Received unsupported filter parameter " + keys[i]});
            }
        }

        return getPredictions(req.body)
            .then( (predictions) => {
                if (predictions == null) {
                    return res.status(500).send({});
                }
                console.time("test")
                console.timeEnd("test")

                return res.status(200).send(predictions);
            })
            .catch(e => {
                logger.log("error", e, {tag: "predictionFilter", sql: sql});
                return res.status(500).send(data);
            });

        }

    // var filterParams = {
    //     "$and": [
    //         {'eitLikelihood.value': 'Yes'},
    //         {'noticeType': {'$ne': 'Presolicitation'}},
    //         {'noticeType': {'$ne': 'Special Notice'}},
    //     ]
    // };
    //
    // var agency = req.body.agency.split(' (')[0];
    // var office = req.body.office;
    // var contactInfo = req.body.contactInfo;
    // var solNum = req.body.solNum;
    // var reviewRec = req.body.reviewRec;
    // var eitLikelihood = req.body.eitLikelihood;
    // var reviewStatus = req.body.reviewStatus;
    // var numDocs = req.body.numDocs;
    // var parseStatus = req.body.parsing_report;
    //
    // if (agency) {
    //     _.merge(filterParams, {agency: agency});
    // }
    // if (contactInfo) {
    //     _.merge(filterParams, {contactInfo: contactInfo});
    // }
    // if (office) {
    //     _.merge(filterParams, {office: office});
    // }
    // if (solNum) {
    //     _.merge(filterParams, {solNum: solNum});
    // }
    // if (reviewRec) {
    //     _.merge(filterParams, {reviewRec: reviewRec});
    // }
    // if (eitLikelihood) {
    //     _.merge(filterParams, {eitLikelihood: eitLikelihood});
    // }
    // if (reviewStatus) {
    //     _.merge(filterParams, {reviewStatus: reviewStatus});
    // }
    // if (numDocs) {
    //     _.merge(filterParams, {numDocs: numDocs});
    // }
    // if (parseStatus) {
    //     _.merge(filterParams, {parseStatus: parseStatus});
    // }
    //
    // Prediction.find(filterParams).then((predictions) => {
    //     res.send(predictions);
    // }, (e) => {
    //     res.status(400).send(e);
    // });
}

//
// /**
//  *
//  */
// app.post('/predictions', (req, res) => {
//     var pred = new Prediction({
//         solNum: req.body.solNum,
//         title: req.body.title,
//         url: req.body.url,
//         predictions: req.body.predictions,
//         reviewRec: req.body.reviewRec,
//         date: req.body.date,
//         numDocs: req.body.numDocs,
//         eitLikelihood: req.body.eitLikelihood,
//         agency: req.body.agency,
//         office: req.body.office,
//         contactInfo: req.body.contactInfo,
//         position: req.body.position,
//         reviewStatus: "Incomplete",
//         noticeType: req.body.noticeType,
//         actionStatus: req.body.actionStatus,
//         parseStatus: req.body.parsing_report,
//         history: req.body.history,
//         feedback: req.body.feedback,
//         undetermined: req.body.undetermined
//     });
//
//     pred.save().then((doc) => {
//         res.send(doc);
//     }, (e) => {
//         res.status(400).send(e);
//     });
// });
//
// /**
//  * Insert history predictions to database
//  */
// app.put('/predictionshistory', (req, res) => {
//     PredictionHistory.findOne({solNum:req.body.solnum}, function(err, solicitation){
//         if(err){
//             res.send(err);
//         }
//         if(solicitation) {
//
//             PredictionHistory.findOne({solNum: req.body.solnum}, function(err, result) {
//                 if(err){
//                     res.send(err)
//                 }
//                 result.predictionHistory = req.body.predhistory
//                 result.save(function(err){
//                     if(err)
//                         res.send(err);
//
//                     res.json({message: 'history updated!'})
//                 })
//             })
//
//         }
//         else{
//
//             var predhistory = new PredictionHistory({
//                 solNum: req.body.solnum,
//                 title: req.body.title,
//                 noticeType: req.body.noticeType,
//                 predictionHistory:req.body.predhistory,
//                 eitLikelihood: req.body.eitLikelihood
//             });
//             predhistory.save().then((doc) => {
//                 res.send(doc);
//             }, (e) => {
//                 res.status(400).send(e);
//             });
//
//         }
//     })
// })
//
//
//
// /**
//  * Get the certain prediction history and feedback
//  */
// app.post('/predictionshistory', (req, res) => {
//     Prediction.findOne({_id : req.body.solicitationID}).then((result) => {
//         if(result){
//             PredictionHistory.findOne({solNum : result.solNum}).then((history) => {
//                 if(history != null){
//                     res.send(history);
//                 }else {
//                     res.json({message: "no result"})
//                 }
//
//             }, (e) => {
//                 res.status(400).send(e);
//             });
//         }
//     })
//
//
// });
//
//
// /**
//  * Get the feed prediction history and feedback
//  */
// app.post('/predictionfeedback', (req, res) => {
//     Prediction.findOne({_id : req.body.solicitationID}).then((result) => {
//             if(result){
//                 if(result.feedback.length != 0) {
//                     res.json({hasFeedback : true, solicitationNum: result.solNum});
//                 }
//                 else{
//                     res.json({message: "no feedback"})
//                 }
//             }else{
//                 res.json({message: "no solicitation in database"})
//             }
//
//         }, (e) => {
//             res.status(400).send(e);
//         }
//     )
// });
//
//
// /**
//  * Insert new predictions to database
//  */
// app.put('/predictions', (req, res) => {
//
//     var now = new Date().toLocaleDateString();
//
//     Prediction.findOne({solNum:req.body.solNum}, function (err, solicitation) {
//
//         if (err)
//         {
//             res.send(err);
//         }
//
//
//         if (solicitation)
//         {
//             // Update the solicitation fields with new FBO data
//             var r = solicitation.history.push({'date': req.body.date, 'action': 'Solicitation Updated on FBO.gov', 'user': '', 'status' : 'Solicitation Updated on FBO.gov'});
//             req.body.history = solicitation.history;
//             req.body.actionStatus = 'Solicitation Updated on FBO.gov';
//             req.body.actionDate = req.body.date
//             Prediction.update({solNum: req.body.solNum}, req.body).then((doc) => {
//                 res.send(doc);
//             }, (e) => {
//                 res.status(400).send(e);
//             })
//         }
//         else
//         {
//
//             var history= [];
//             var r = history.push({'date': req.body.date, 'action': 'Pending Section 508 Coordinator review', 'user': '', 'status' : 'Pending Section 508 Coordinator Review'});
//
//             var history= [];
//             var r = history.push({'date': req.body.date, 'action': 'Pending Section 508 Coordinator review', 'user': '', 'status' : 'Pending Section 508 Coordinator Review'});
//
//             var pred = new Prediction({
//                 solNum: req.body.solNum,
//                 title: req.body.title,
//                 url: req.body.url,
//                 predictions: req.body.predictions,
//                 reviewRec: req.body.reviewRec,
//                 date: req.body.date,
//                 numDocs: req.body.numDocs,
//                 eitLikelihood: req.body.eitLikelihood,
//                 agency: req.body.agency,
//                 office: req.body.office,
//                 contactInfo: req.body.contactInfo,
//                 position: req.body.position,
//                 reviewStatus: "Incomplete",
//                 noticeType: req.body.noticeType,
//                 actionStatus: req.body.actionStatus,
//                 parseStatus: req.body.parseStatus,
//                 history: history,
//                 feedback: req.body.feedback,
//                 undetermined: req.body.undetermined
//             });
//             pred.save().then((doc) => {
//                 res.send(doc);
//             }, (e) => {
//                 res.status(400).send(e);
//             });
//         }
//     })
// });


