require('./config/config');

const _ = require('lodash');
const express = require('express');
const bodyParser = require('body-parser');
const {ObjectID} = require('mongodb');

var {mongoose} = require('./db/mongoose');
var {Prediction} = require('./models/prediction');

var userRoutes = require('./routes/user.routes');

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

app.get('/predictions/:agency?', (req, res) => {
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
  }, (e) => {
    res.status(400).send(e);
  });
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

    Prediction.find(filterParams).then((predictions) => {
      res.send(predictions);
    }, (e) => {
      res.status(400).send(e);
    });

});

// Get all solicitaitons.  This is not currently being used.  Use filter instead.
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
    parseStatus: req.body.parsing_report
  });

  pred.save().then((doc) => {
    res.send(doc);
  }, (e) => {
    res.status(400).send(e);
  });
});

app.listen(port, () => {
  console.log(`Started up at port ${port}`);
});

module.exports = {app};
