const logger = require('../config/winston');
const db = require('../models/index');
var SqlString = require('sequelize/lib/sql-string')


require('../tests/test.lists');


// const randomWords = require('random-words');
//
// const mapping_documentation =
//
//     {
//         solNum: "N.notice_number",
//         title: "???",
//         url: "N.notice_data.url",
//         predictions: {
//             value: "attachment.prediction (1 is GREEN , 0 is RED)"
//         },
//         reviewRec: "??? should be enuumerated type with at least values of one of 'Compliant', 'Non-compliant (Action Required)', or 'Undetermined'",
//         date: "N.date",
//         numDocs: "count attachments where attachments.notice_id = N.id",
//         eitLikelihood: {
//             naics: "N.notice_data.naics",
//             value: "???? - expected one of 'Yes' or 'No'"
//         },
//         agency: "N.agency",
//         office: "N.notice_data.office",
//         contactInfo: {
//             contact: "N.notice_data.contact",
//             name: "N.notice_data.contact (not always well structured)",
//             position: "N.notice_data.contact (not always well structured)",
//             email: "N.notice_data.contact (not always well structured)"
//         },
//         position: "???",
//         reviewStatus: "??? enumerated type. One possible value is 'Incomplete'",
//         noticeType: "notice_type.notice_type - but probably needs to be mapped to UI expected values",
//         actionStatus: "N.action - parsing TBD",
//         actionDate: "N.action - parsing TBD",
//         parseStatus: [{
//             name: "attachment.name",
//             status: "??? enumeration - one of 'successfully parsed' or 'processing error'  " +
//                 "maybe derived from attachment.validation, but that col is NULL for " +
//                 "all test records."
//         }],
//         history: [{
//             date: "TBD - may be separate log table for user actions managed by web back end",
//             action: "TBD - may be separate log table for user actions managed by web back end",
//             user: "TBD - may be separate log table for user actions managed by web back end",
//             status: "TBD - may be separate log for user actions table managed by web back end"
//         }],
//         feedback: [{
//             questionID: "???",
//             question: "???",
//             answer: "???",
//         }],
//         undetermined: "??? UI expects 0 or 1"
//     };

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


// function mockData() {
//     if (myCache.get("sample_data") != undefined) {
//         return myCache.get("sample_data");
//     }
//
//         let reviewRecArray = ["Compliant", "Non-compliant (Action Required)", "Undetermined"];
//         let noticeTypeArray = ["Presolicitation", "Combined Synopsis/Solicitation", "Sources Sought", "Special Notice", "Other"];
//         let actionStatusArray = ["Email Sent to POC", "reviewed solicitation action requested summary", "provided feedback on the solicitation prediction result"];
//         let template =
//
//             {
//                 solNum: "1234",
//                 title: "sample title",
//                 url: "http://www.tcg.com/",
//                 predictions: {
//                     value: "GREEN"
//                 },
//                 reviewRec: "Compliant", // one of "Compliant", "Non-compliant (Action Required)", or "Undetermined"
//                 date: "01/01/2019",
//                 numDocs: 3,
//                 eitLikelihood: {
//                     naics: "naics here",  // initial version uses NAICS code to determine
//                     value: "45"
//                 },
//                 agency: "National Institutes of Health",
//                 office: "Office of the Director",
//
//                 contactInfo: {
//                     contact: "contact str",
//                     name: "Joe Smith",
//                     position: "Manager",
//                     email: "joe@example.com"
//                 },
//                 position: "pos string",
//                 reviewStatus: "on time",
//                 noticeType: "N type",
//                 actionStatus: "ready",
//                 actionDate: "02/02/2019",
//                 parseStatus: [{
//                     name: "doc 1",
//                     status: "parsed"
//                 }],
//                 history: [{
//                     date: "03/03/2018",
//                     action: "sending",
//                     user: "crowley",
//                     status: "submitted"
//                 }],
//                 feedback: [{
//                     questionID: "1",
//                     question: "Is this a good solicitation?",
//                     answer: "Yes",
//                 }],
//                 undetermined: true
//
//             };
//
//         let sample_data = new Array();
//
//         for (let i = 0; i < 6000; i++) {
//             let o = Object.assign({}, template);
//
//             o.title = randomWords({exactly: 1, wordsPerString: getRandomInt(2, 7)})[0];
//             o.reviewRec = pickOne(reviewRecArray);
//             o.agency = pickOne(all_fed_agencies_array);
//             o.numDocs = getRandomInt(0,3);
//             o.solNum = getRandomInt(999, 99999999);
//             o.noticeType = pickOne(noticeTypeArray);
//             o.actionStatus = pickOne(actionStatusArray);
//             o.actionDate = new Date( getRandomInt(2018, 2020),  getRandomInt(0, 12),getRandomInt(1,27));;;
//             o.date = new Date( getRandomInt(2018, 2020),  getRandomInt(0, 12),getRandomInt(1,27));;
//             o.office = randomWords({exactly: 1, wordsPerString: getRandomInt(2, 4)})[0];
//             o.predictions = Object.assign({}, template.predictions);
//             o.predictions.value = pickOne(["RED", "GREEN"]);
//             o.eitLikelihood = Object.assign({}, template.eitLikelihood);
//             o.eitLikelihood.naics = getRandomInt(10, 99999);
//             o.eitLikelihood.value = pickOne(['Yes', 'No']);
//             o.undetermined = (getRandomInt(0,2) == 0);
//
//             o.parseStatus = [];
//             let count = getRandomInt(0,3);
//             for (let x=0; x < count; x++) {
//                 let stat = {};
//                 stat.name = "doc 1";
//                 stat.status = pickOne( ["successfully parsed", "processing error"] )
//                 o.parseStatus.push ( stat )
//             }
//
//             sample_data.push(o);
//         }
//
//         myCache.set("sample_data", sample_data);
//         return sample_data;
// }

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
    o.title = (notice.notice_data  !== undefined) ? notice.notice_data.subject : "";
    o.reviewRec = pickOne(reviewRecArray);
    o.agency = notice.agency;
    o.numDocs = (notice.attachment_json) ? notice.attachment_json.length : 0;
    o.solNum = notice.notice_number;
    o.noticeType = notice.notice_type; //TODO: need to map these to values expected by the UI
    o.date = notice.date;
    o.office = (notice.notice_data !== undefined) ? notice.notice_data.office : "";
    // TODO: There should be a reason this is plural and an object and not a string but I can't see why yet.
    o.predictions = {
        value: (notice.compliant === 1) ? "GREEN" : "RED",
    };
    o.eitLikelihood = {
        naics: notice.naics,
        value: 'Yes'
    }
    o.undetermined = 0; //(getRandomInt(0, 2) == 0);
    o.action = notice.action;
    o.actionStatus = (o.action != null) ? o.action.actionStatus : "";
    o.actionDate = (o.action != null) ? o.action.actionDate : "";
    o.feedback = notice.feedback ? notice.feedback : [];
    o.history = notice.history ? notice.history : [];

    o.contactInfo = {
        contact: "Contact",
        name: "Contact Name",
        position: "Position",
        email: "crowley+contact@tcg.com"

    }

    o.parseStatus = (notice.attachment_json !== undefined) ? notice.attachment_json : [];

    return o;
}

function deepConcat (a, b) {
    let res = [];
    if (a !== undefined && a.length > 0) {
        for (let e of a) {
            res.push(Object.assign({},e));
        }
    }
    if (b !== undefined && b.length > 0) {
        for (let e of b) {
            res.push(Object.assign({},e));
        }
    }
    return res;
}

function mergeOnePrediction(older, newer) {
    let merge = Object.assign ({}, older, newer);

    // history and feedbck should be merged oldest to newest
    merge.history = deepConcat(older.history, newer.history);
    merge.feedback = deepConcat(older.feedback, newer.feedback);
    merge.parseStatus = deepConcat(older.parseStatus, newer.parseStatus);

    merge.predictions = Object.assign({}, newer.predictions);
    merge.contactInfo = Object.assign({}, newer.contactInfo);

    merge.numDocs = older.numDocs + newer.numDocs;

    if ((newer.actionDate == undefined) || (older.actionDate == undefined)) {
        merge.actionDate = older.actionDate || newer.actionDate;
    } else {
        merge.actionDate = (older.actionDate > newer.actionDate) ? older.actionDate : newer.actionDate;
    }

    return merge;
}

function mergePredictions (predictionList) {
    let merged = {};


    for (let p of predictionList) {
        if ( merged[p.solNum] ) {
            let newer = ( merged[p.solNum].date > p.date ) ? merged[p.solNum] : p;
            let older = ( merged[p.solNum].date > p.date ) ? p : merged[p.solNum];
            merged[p.solNum] = mergeOnePrediction(older, newer)
        } else {
            merged[p.solNum] = Object.assign({}, p);
        }
    }

    return (Object.keys(merged)).map ( key => merged[key] );
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
    let eitLikelihood = filter.eitLikelihood;

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
    if (eitLikelihood && eitLikelihood != "") {
        // this is a no-op for now since all records added to the database should have eitLikelihood true
    }
    if (startDate && startDate != "") {
        where_array.push( "date > " + SqlString.escape(makePostgresDate(startDate), null, "postgres"))
        where_array.push( "date is not null")
    }
    if (endDate && endDate != "") {
        where_array.push( "date < " + SqlString.escape(makePostgresDate(endDate), null, "postgres"))
        where_array.push( "date is not null")
    }


    let where = where_array.join(" AND ");
    let sql = `
            select n.*, notice_type 
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
            left join notice_type t on n.notice_type_id = t.id
            WHERE ${where} 
            order by id desc`;

    return db.sequelize.query(sql, {type: db.sequelize.QueryTypes.SELECT})
        .then(notices => {
            let data = [];
            for (let i = 0; i < notices.length; i++) {
                data.push(makeOnePrediction(notices[i]));
            }
            return mergePredictions(data);
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
    mergePredictions : mergePredictions,

    makeOnePrediction: makeOnePrediction,

    predictionFilter:  function (req, res) {
        let data = [];

        // currently unsupported filters
        var parseStatus = req.body.parsing_report;
        var contactInfo = req.body.contactInfo;
        var reviewRec = req.body.reviewRec;
        var reviewStatus = req.body.reviewStatus;

        let keys = Object.keys(req.body);

        // verify that only supported filter params are used
        let valid_keys = ["agency", "office", "numDocs", "solNum", "eitLikelihood", "startDate", "fromPeriod", "endDate", "toPeriod"];
        for (let i=0; i< keys.length; i++) {
            if ( req.body[keys[i]] != "" && ! valid_keys.includes (keys[i]) ) {
                logger.log("error", req.body, {tag: "predictionFilter - " + "Received unsupported filter parameter " + keys[i]});
                return res.status(500).send({message: "Received unsupported filter parameter " + keys[i]});
            }
        }

        // We should support these keys, but currently don't due to the issue with duplicate notice_numbers
        let unsupported_keys = ['numDocs'];
        if ( keys
              .map( k => unsupported_keys.includes(k) && ( req.body[k] != "") )
              .reduce( ((accum, current) => accum || current) , false) ) {
            return res.status(501).send("The server does not yet support filter by " + JSON.stringify(unsupported_keys))
        }

        return getPredictions(req.body)
            .then( (predictions) => {
                if (predictions == null) {
                    return res.status(500).send({});
                }

                return res.status(200).send(predictions);
            })
            .catch(e => {
                logger.log("error", e, {tag: "predictionFilter", sql: sql});
                return res.status(500).send(data);
            });

        }
