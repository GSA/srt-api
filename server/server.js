require('./config/config');

const _ = require('lodash');
const express = require('express');
const bodyParser = require('body-parser');
const {ObjectID} = require('mongodb');

var {mongoose} = require('./db/mongoose');
var {Prediction} = require('./models/prediction');

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

app.get('/predictions', (req, res) => {
  Prediction.find().then((preds) => {
    res.send(preds);
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
    reviewRec: true,
    date: Date.now(),
    isReadable: req.body.isReadable,
    eitLikelihood: req.body.eitLikelihood,
    agency: req.body.agency,
    office: req.body.office,
    contact: req.body.contact,
    position: req.body.position,
    reviewStatus: false
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
