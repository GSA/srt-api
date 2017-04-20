var mongoose = require('mongoose');

var Prediction = mongoose.model('Prediction', {
  solNum: {
    type: String
  },
  title: {
    type: String
  },
  url: {
    type: String,
    required: true,
    minlength: 1,
    trim: true
  },
  predictions: {
    RED: String,
    GREEN: String,
    value: String
  },
  reviewRec: {
    type: String
  },
  date: {
    type: String
  },
  numDocs: {
    type: String
  },
  eitLikelihood: {
    naics: String,
    value: String
  },
  agency: {
    type: String,
    required: true
  },
  office: {
    type: String
  },
  contact: {
    type: String
  },
  position: {
    type: String
  },
  reviewStatus: {
    type: String
  },
  noticeType: {
    type: String
  },
  actionStatus: {
    type: String
  },
  parseStatus: [{
    name: String,
    status: String
  }]

});

module.exports = {Prediction};
