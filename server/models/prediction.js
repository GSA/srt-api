var mongoose = require('mongoose');

var Prediction = mongoose.model('Prediction', {
  solNum: {
    type: Number
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
    RED: Number,
    GREEN: Number
  },
  reviewRec: {
    type: Boolean
  },
  date: {
    type: Date
  },
  isReadable: {
    type: Boolean
  },
  eitLikelihood: {
    type: Boolean
  },
  agency: {
    type: String,
    required: true
  },
  office: {
    type: String
  },
  eitLikelihood: {
    type: Boolean
  },
  contact: {
    type: String
  },
  position: {
    type: String
  },
  reviewStatus: {
    type: Boolean
  }

});

module.exports = {Prediction};
