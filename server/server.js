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

app.use(function (req, res, next) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With, content-type, Authorization, x-auth');
  res.setHeader('Access-Control-Expose-Headers', 'x-auth');
  next();
});

app.use('/user', userRoutes);

app.get('/predictions/:agency?/:contact?', (req, res) => {
  Prediction.find().then((preds) => {
    res.send(preds);
  }, (e) => {
    res.status(400).send(e);
  });
});

app.get('/solicitation/:id', (req, res) => {
  Prediction.findById(req.params.id).then((solicitation) => {
    res.send(solicitation);
  }, (e) => {
    res.status(400).send(e);
  });
});

app.post('/predictions/filter', (req, res) => {
  var filterParams = {};
    var agency = req.body.agency;
    var office = req.body.office;
    var contact = req.body.contact;
    var solNum = req.body.solNum;
    var reviewRec = req.body.reviewRec;
    var eitLikelihood = req.body.eitLikelihood;
    var reviewStatus = req.body.reviewStatus;
    var numDocs = req.body.numDocs;
    if (agency) {
      _.merge(filterParams, {agency: agency});
    }
    if (contact) {
      _.merge(filterParams, {contact: contact});
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

    Prediction.find(filterParams).then((predictions) => {
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
    contact: req.body.contact,
    position: req.body.position,
    reviewStatus: "Incomplete",
    noticeType: req.body.noticeType,
    actionStatus: req.body.actionStatus,
    //parsingReport: req.body.parsing_report
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
