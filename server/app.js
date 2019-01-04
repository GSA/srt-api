require('./config/config.js');
var winston = require('winston')
var expressWinston = require('express-winston');
const express = require('express');
const bodyParser = require('body-parser');
var cors = require('cors');
var token = require('./security/token');





//Kailun's add authroutes
//Kailun's add solicitation routes
//var fileRoutes = require('./routes/file.routes');
var authRoutes = require('./routes/auth.routes');
var userRoutes = require('./routes/user.routes');
var emailRoutes = require('./routes/email.routes');
//var solicitationRoutes = require('./routes/solicitation.routes');



//
// Setup ORM
//
var app = express();

app.use(bodyParser.json());
app.use(cors());

app.use(expressWinston.logger({
    transports: [ new winston.transports.File({filename: "winston.log", level: "info"})],
    // format: winston.format.combine(winston.format.colorize(), winston.format.json()),
    format: winston.format.prettyPrint(),
    meta: true,
    // msg: "HTTP {{req.method}} {{req.url}} ",
    msg : function(req, res) {
        var jwt = require('jsonwebtoken');

        var token = null;
        var user = {id: null, position: null, userRole: null, email: null};
        if (req.headers['authorization'] && req.headers['authorization'].length > 0 ) {
            token = req.headers['authorization'].split(' ')[1];
            var decoded = jwt.verify(token, 'innovation');
            user = decoded.user;
        }
        return `${req.method} ${req.url} ${res.statusCode} ${res.responseTime}ms ${user.id} ${user.email} ${user.position} ${user.userRole}`;},
    expressFormat: false,
    colorize: false,
    ignoreRoute: function(req, res) { return false;}
}));

app.post('/api/auth', authRoutes.create);
app.post('/api/auth/login', authRoutes.login);
app.get('/api/user/filter', token(), userRoutes.filter);
app.get('/api/user/filtertest',  userRoutes.filter);
app.get('/api/user/getUserInfo', token(), userRoutes.getUserInfo);
// app.get('/api/user/:userId', token(), userRoutes.getUserInfo);
app.post('/api/user/updateUserInfo', token(), userRoutes.update);
app.post('/api/user/update', token(), userRoutes.update);
// app.post('/api/user/:userId', token(), userRoutes.update);
app.post('/api/user/updatePassword', token(), userRoutes.updatePassword);
app.post('/api/user/getCurrentUser', token(), userRoutes.getCurrentUser);

app.post('/api/auth/login', authRoutes.login);




app.use(expressWinston.errorLogger({
    transports: [ new winston.transports.File({filename: "winston.log", level: "info"})],
    // format: winston.format.combine(winston.format.colorize(), winston.format.json()),
    format: winston.format.prettyPrint(),
    meta: true,
    // msg: "HTTP {{req.method}} {{req.url}} ",
    msg : function(req, res) {
        var jwt = require('jsonwebtoken');

        var token = null;
        var user = {id: null, position: null, userRole: null, email: null};
        if (req.headers['authorization'] && req.headers['authorization'].length > 0 ) {
            token = req.headers['authorization'].split(' ')[1];
            var decoded = jwt.verify(token, 'innovation');
            user = decoded.user;
        }
        return `ERROR - ${req.method} ${req.url} ${res.statusCode} ${res.responseTime}ms ${user.id} ${user.email} ${user.position} ${user.userRole}`;},
    expressFormat: false,
    colorize: false,
    ignoreRoute: function(req, res) { return false;}
}));

    // //app.use('/file', fileRoutes);
    // app.use('/auth', authRoutes);
    // app.use('/user', userRoutes);
    // app.use('/email', emailRoutes);
    // //app.use('/operation', solicitationRoutes);
    //
    //
    //
    // /**
    //  * Get total predictions
    //  */
    // app.get('/predictions', (req, res) => {
    //     Prediction.find().then((preds) => {
    //         res.send(preds);
    //     }, (e) => {
    //         res.status(400).send(e);
    //     });
    // });
    //
    // /**
    //  * Get total ICT solicitation
    //  */
    // app.get('/ICT', (req, res) => {
    //     Prediction.find({'eitLikelihood.value': 'Yes'}).then((preds) => {
    //         res.send(preds);
    //     }, (e) => {
    //         res.status(400).send(e);
    //     });
    // });
    //
    // /**
    //  * Get analytic result
    //  */
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
    //                     // if (predictions[i].parseStatus.length != Number(predictions[i].numDocs)) console.log(predictions[i].solNum);
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
    //
    // /**
    //  * Get Filtered prediction data
    //  */
    // app.post('/predictions/filter', (req, res) => {
    //
    //     console.log(req.body);
    //     var filterParams = {
    //         "$and": [
    //             {'eitLikelihood.value': 'Yes'},
    //             {'noticeType': {'$ne': 'Presolicitation'}},
    //             {'noticeType': {'$ne': 'Special Notice'}},
    //         ]};
    //
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
    //     }
    //     if (contactInfo) {
    //         _.merge(filterParams, {contactInfo: contactInfo});
    //     }
    //     if (office) {
    //         _.merge(filterParams, {office: office});
    //     }
    //     if (solNum) {
    //         _.merge(filterParams, {solNum: solNum});
    //     }
    //     if (reviewRec) {
    //         _.merge(filterParams, {reviewRec: reviewRec});
    //     }
    //     if (eitLikelihood) {
    //         _.merge(filterParams, {eitLikelihood: eitLikelihood});
    //     }
    //     if (reviewStatus) {
    //         _.merge(filterParams, {reviewStatus: reviewStatus});
    //     }
    //     if (numDocs) {
    //         _.merge(filterParams, {numDocs: numDocs});
    //     }
    //     if (parseStatus) {
    //         _.merge(filterParams, {parseStatus: parseStatus});
    //     }
    //
    //     Prediction.find(filterParams).then((predictions) => {
    //         res.send(predictions);
    //     }, (e) => {
    //         res.status(400).send(e);
    //     });
    //
    // });
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
    //             console.log("fail to put prediction history");
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
    //     console.log(req.body.solicitationID)
    //     Prediction.findOne({_id : req.body.solicitationID}).then((result) => {
    //         if(result){
    //             console.log(result.solNum);
    //             PredictionHistory.findOne({solNum : result.solNum}).then((history) => {
    //                 console.log(history);
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
    //             console.log("error on put prediction");
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
    //
    // /**
    //  * Insert agency lsit to database
    //  */
    // app.put('/agencies', (req, res) => {
    //     var agency = new Agency ({
    //         Agency: req.body.Agency,
    //         AgencyId: req.body.AgencyId
    //     })
    //
    //     agency.save().then((doc) => {
    //         res.send(doc);
    //     }, (e) => {
    //         res.status(400).send(e);
    //     });
    // })
    //
    // /**
    //  * Get entire agency records
    //  */
    // app.get('/agencies', (req, res) => {
    //     Agency.find().then((age) => {
    //         res.send(age);
    //     }, (e) => {
    //         res.status(400).send(e);
    //     });
    // });
    //
    // /**
    //  * Get entire agnecy list for analytic
    //  */
    // app.get('/AgencyList', (req, res) => {
    //     Prediction.find({'eitLikelihood.value': 'Yes'}).then((preds) => {
    //         var agencyList = [];
    //         var map = new Object();
    //         for (let item of preds)
    //         {
    //             if (!map.hasOwnProperty(item.agency))
    //             {
    //                 map[item.agency] = item.agency;
    //                 agencyList.push(item.agency)
    //             }
    //         }
    //         agencyList.sort();
    //         res.send(agencyList);
    //     }, (e) => {
    //         res.status(400).send(e);
    //     });
    // });
    //
    // /**
    //  * Insert survey json to database
    //  */
    // app.put('/surveys', (req, res) => {
    //
    //     Survey.findOne({ID: req.body.ID}, function (err, survey) {
    //
    //         if (err)
    //             res.send(err)
    //
    //         if (survey)
    //         {
    //             survey.update({ID: req.body.ID}, req.body).then((doc) => {
    //                 res.send(doc);
    //             }, (e) => {
    //                 res.status(400).send(e);
    //             })
    //         }
    //         else
    //         {
    //             var survey = new Survey ({
    //                 ID: req.body.ID,
    //                 Question: req.body.Question,
    //                 Choices: req.body.Choices,
    //                 Section: req.body.Section,
    //                 Type: req.body.Type,
    //                 Answer: req.body.Answer,
    //                 Note: req.body.Note,
    //                 ChoicesNote: req.body.ChoicesNote,
    //             })
    //
    //             survey.save().then((doc) => {
    //                 res.send(doc);
    //             }, (e) => {
    //                 res.status(400).send(e);
    //             });
    //         }
    //
    //     });
    // })
    //
    //
    // /**
    //  * Get surveys
    //  */
    // app.get('/surveys', (req, res) => {
    //     Survey.find().then((survey) => {
    //         res.send(survey);
    //     }, (e) => {
    //         res.status(400).send(e);
    //     });
    // });


module.exports = app;