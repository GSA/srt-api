// var mongoose = require('mongoose');
//
// var Prediction = mongoose.model('Prediction', {
//   solNum: {
//     type: String
//   },
//   title: {
//     type: String
//   },
//   url: {
//     type: String,
//     required: true,
//     minlength: 1,
//     trim: true
//   },
//   predictions: {
//     RED: String,
//     GREEN: String,
//     value: String
//   },
//   reviewRec: {
//     type: String
//   },
//   date: {
//     type: String
//   },
//   numDocs: {
//     type: String
//   },
//   eitLikelihood: { // is the solicitation ICT?  is 508 required?
//     naics: String,  // initial version uses NAICS code to determine
//     value: String
//   },
//   agency: {
//     type: String,
//     required: true
//   },
//   office: {
//     type: String
//   },
//   contactInfo: {  // contact information associated with the soliciation
//     contact: String,
//     name: String,
//     position: String,
//     email: String
//   },
//   position: {
//     type: String
//   },
//   reviewStatus: {
//     type: String
//   },
//   noticeType: {
//     type: String
//   },
//   actionStatus: {  // internal field to track 508 workflow
//     type: String
//   },
//   actionDate: {
//     type: String
//   },
//   parseStatus: [{ // array of documents found for solicitation and whether they are able to be parsed.
//     name: String,
//     status: String
//   }],
//   history: [{
//     date: String,
//     action: String,
//     user: String,
//     status: String
//   }],
//   feedback: [{
//     questionID: String,
//     question: String,
//     answer: String,
//   }],
//   undetermined: {
//     type: Boolean
//   }
//
// });
//
// module.exports = {Prediction};
