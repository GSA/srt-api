require('./config/config');
const env = process.env.NODE_ENV || 'development';
const config = require('./config/config.json')[env];


const app = require('./app')();



var cors = require('cors');

var multer = require('multer');
var multerObj = multer({dest: './static/upload'})


const port = config.srt_server.port;





app.listen(port, () => {
    console.log(`Started up at port ${port}`);
});



module.exports = app;
