require('./config/config');

const _ = require('lodash');

const bodyParser = require('body-parser');
const {ObjectID} = require('mongodb');
const date = require('date-and-time');

const app = require('./app');

var path = require('path');

var {Prediction} = require('./schemas/prediction');
var {Agency} = require('./schemas/agency');
var {Survey} = require('./schemas/survey');
//Kailun's add history model
var {PredictionHistory} = require('./models/predictionhistory');




var cors = require('cors');

var multer = require('multer');
var multerObj = multer({dest: './static/upload'})

var cors = require('cors');

var multer = require('multer');
var multerObj = multer({dest: './static/upload'})

const port = process.env.PORT;



/* DATABASE */

// var mongoose = require('mongoose');
// mongoose.Promise = global.Promise;
// mongoose.connect(process.env.MONGODB_URI);


/* Kailun's add
 * For upload file system
 */

throw new Error ("don't run server during unit tests");



module.exports = app;
