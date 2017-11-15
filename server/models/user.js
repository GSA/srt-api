var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var schema = new Schema({
  firstName: {
    type: String,
    required: true
  },
  lastName: {
    type: String,
    required: true
  },
  agency: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true
  },
  password: {
    type: String,
    required: true
  },
  position: {
    type: String,
    required: true,
  },
  isAccepted: {
    type: Boolean
  },
  isRejected: {
    type: Boolean
  },
  userRole: {
    type: String
  },
  rejectionNote: {
    type: String
  },
  creationDate: {
    type: String
  },
  id: {
    type: String
  },
  
  tempPassword: {
    type:String
  }
});

module.exports = mongoose.model('User', schema);
