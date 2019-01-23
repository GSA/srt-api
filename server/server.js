require('./config/config');
const env = process.env.NODE_ENV || 'development';
const config = require('./config/config.json')[env];


const app = require('./app');

// var {Prediction} = require('./schemas/prediction');
// var {Agency} = require('./schemas/agency');
// var {Survey} = require('./schemas/survey');
// //Kailun's add history model
// var {PredictionHistory} = require('./models/predictionhistory.js');




var cors = require('cors');

var multer = require('multer');
var multerObj = multer({dest: './static/upload'})


const port = config.srt_server.port;



/* DATABASE */

// var mongoose = require('mongoose');
// mongoose.Promise = global.Promise;
// mongoose.connect(process.env.MONGODB_URI);


/* Kailun's add
 * For upload file system
 */


app.listen(port, () => {
    console.log(`Started up at port ${port}`);
});



module.exports = app;
