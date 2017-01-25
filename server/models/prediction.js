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
    RED: Number,
    GREEN: Number
  },
  reviewRec: {
    type: String
  },
  date: {
    type: Date
  },
  isReadable: {
    type: String
  },
  eitLikelihood: {
    type: String
  },
  agency: {
    type: String,
    required: true
  },
  office: {
    type: String
  },
<<<<<<< HEAD
  eitLikelihood: {
    type: String
  },
=======
>>>>>>> a92c9fdd73963ce0ee852e83a6c4a1732d32f071
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
