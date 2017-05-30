require('./config/config');

const _ = require('lodash');
const express = require('express');
const bodyParser = require('body-parser');
const {ObjectID} = require('mongodb');
const date = require('date-and-time');

var {mongoose} = require('./db/mongoose');
var {Prediction} = require('./models/prediction');

var userRoutes = require('./routes/user.routes');
var emailRoutes = require('./routes/email.routes');

var app = express();
const port = process.env.PORT;

app.use(bodyParser.json());

// The headers must be sent to allow Cross Origin Resource Sharing
// Requests to connect will be denied without this
app.use(function (req, res, next) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With, content-type, Authorization, x-auth');
  res.setHeader('Access-Control-Expose-Headers', 'x-auth');
  next();
});

app.use('/user', userRoutes);
app.use('/email', emailRoutes);

app.get('/predictions', (req, res) => {
  Prediction.find().then((preds) => {
    res.send(preds);
  }, (e) => {
    res.status(400).send(e);
  });
});

// Route to get the selected solicitation for detailed display
app.get('/solicitation/:id', (req, res) => {
  Prediction.findById(req.params.id).then((solicitation) => {
    res.send(solicitation);
  //  console.log(solicitation);
  }, (e) => {
    res.status(400).send(e);
  });
});

// Route to update the history when email is sent to PoC
app.post('/solicitation', (req, res) => {

  var length = req.body.history.length;

  Prediction.findById(req.body._id).then((solicitation) => {
    // update history 
    solicitation.history = req.body.history;
    solicitation.actionStatus = req.body.history[length-1]["action"];
    solicitation.actionDate = req.body.history[length-1]["date"];
    solicitation.save().then((doc) => {
      res.send(doc);
    }, (e) => {
      res.status(400).send(e);
    })
  })
});

// This post is used to get the data from Mongo
// Filter is used to ensure a user is only able to see their agency data
app.post('/predictions/filter', (req, res) => {
  var filterParams = {};
    var agency = req.body.agency;
    var office = req.body.office;
    var contactInfo = req.body.contactInfo;
    var solNum = req.body.solNum;
    var reviewRec = req.body.reviewRec;
    var eitLikelihood = req.body.eitLikelihood;
    var reviewStatus = req.body.reviewStatus;
    var numDocs = req.body.numDocs;
    var parseStatus = req.body.parsing_report;
    if (agency) {
      _.merge(filterParams, {agency: agency});
    }
    if (contactInfo) {
      _.merge(filterParams, {contactInfo: contactInfo});
    }
    if (office) {
      _.merge(filterParams, {office: office});
    }
    if (solNum) {
      _.merge(filterParams, {solNum: solNum});
    }
    if (reviewRec) {
      _.merge(filterParams, {reviewRec: reviewRec});
    }
    if (eitLikelihood) {
      _.merge(filterParams, {eitLikelihood: eitLikelihood});
    }
    if (reviewStatus) {
      _.merge(filterParams, {reviewStatus: reviewStatus});
    }
    if (numDocs) {
      _.merge(filterParams, {numDocs: numDocs});
    }
    if (parseStatus) {
      _.merge(filterParams, {parseStatus: parseStatus});
    }


    Prediction.find({'eitLikelihood.value': 'Yes'}).then((predictions) => {
      res.send(predictions);
    }, (e) => {
      res.status(400).send(e);
    });

});

app.post('/predictions', (req, res) => {
  var pred = new Prediction({
    solNum: req.body.solNum,
    title: req.body.title,
    url: req.body.url,
    predictions: req.body.predictions,
    reviewRec: req.body.reviewRec,
    date: req.body.datePosted,
    numDocs: req.body.numDocs,
    eitLikelihood: req.body.eitLikelihood,
    agency: req.body.agency,
    office: req.body.office,
    contactInfo: req.body.contactInfo,
    position: req.body.position,
    reviewStatus: "Incomplete",
    noticeType: req.body.noticeType,
    actionStatus: req.body.actionStatus,
    parseStatus: req.body.parsing_report,
    history: req.body.history
  });

  pred.save().then((doc) => {
    res.send(doc);
  }, (e) => {
    res.status(400).send(e);
  });
});

app.put('/predictions', (req, res) => {

  //var now = date.format(new Date(), 'YYYY/MM/DD').toString();
  var now = new Date().toLocaleDateString();

  //console.log("body: ", req.body);
  Prediction.findOne({solNum: req.body.solNum}, function (err, solicitation) {
    if (err)
      res.send(err);
    if (solicitation) {
    // Update the solicitation fields with new FBO data
    var history= req.body.history;
    var r = history.push({'date': now, 'action': 'Solicitation Updated on FBO'});
    req.body.history = history;
    req.body.actionStatus = 'Solicitation Updated on FBO';
    // console.log("updated sol from fbo: ", solicitation);
    Prediction.update({solNum: req.body.solNum}, req.body).then((doc) => {
      res.send(doc);
    }, (e) => {
      res.status(400).send(e);
    })
  } else {
    var history= [];
    var r = history.push({'date': now, 'action': 'Pending 508 Coordinator Review.'});

    var pred = new Prediction({
    solNum: req.body.solNum,
    title: req.body.title,
    url: req.body.url,
    predictions: req.body.predictions,
    reviewRec: req.body.reviewRec,
    date: req.body.datePosted,
    numDocs: req.body.numDocs,
    eitLikelihood: req.body.eitLikelihood,
    agency: req.body.agency,
    office: req.body.office,
    contactInfo: req.body.contactInfo,
    position: req.body.position,
    reviewStatus: "Incomplete",
    noticeType: req.body.noticeType,
    actionStatus: req.body.actionStatus,
    parseStatus: req.body.parsing_report,
    history: history
  });

  pred.save().then((doc) => {
    res.send(doc);
  }, (e) => {
    res.status(400).send(e);
  });
}})});

app.listen(port, () => {
  console.log(`Started up at port ${port}`);
});

module.exports = {app};
