var mongoose = require('mongoose');

var Prediction = mongoose.model('Prediction', {
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
  agency: {
    type: String,
    required: true
  },
  date: {
    type: Date
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
  isReadable: {
    type: Boolean
  }

});

module.exports = {Prediction};
