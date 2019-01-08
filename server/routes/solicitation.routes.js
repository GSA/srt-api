const _ = require('lodash');
var express = require('express');
var router = express.Router();
var bcrypt = require('bcryptjs');
var jwt = require('jsonwebtoken');
var token = require('../security/token');



var {Prediction} = require('../schemas/prediction');




/**
 * Get solicitation based on filter
 */
router.post('/filter', function (req, res) {
    
    var numData = 10;
    var filterParams = {
        "$and": [
            { 'eitLikelihood.value': 'Yes' },
            { 'noticeType': { '$ne': 'Presolicitation' } },
            { 'noticeType': { '$ne': 'Special Notice' } },
        ]
    };
    var agency = req.body.agency.split(' (')[0];
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

    // Kailun uses the mongoose to sort and limit the solicitations
    // Prediction.find(filterParams).sort({'date': -1}).limit(numData).then((predictions) => {
      
    Prediction.find(filterParams).then((predictions) => {
      predictions = _.orderBy(predictions, ['date'],['desc'])
      //var result   
      predictions = predictions.slice(0, numData);
      res.send(predictions);

    }, (e) => {
        res.status(400).send(e);
    })


});

module.exports = router;
