var mongoose = require('mongoose');

var Agency = mongoose.model('Agency', {
  Agency: {
    type: String
  },
  Acronym: {
    type: String
  } 
});

module.exports = {Agency};
