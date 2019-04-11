// var express = require('express');
// var router = express.Router();
// var jwt = require('jsonwebtoken');
// var token = require('../security/token');
//
// var multer = require('multer');
// var multerObj = multer({dest: './static/upload'})
//
//
// var fs = require('fs');
//
//
// //  we cannot check token for ng2-file-upload http request
// /**
//  * Check token, if token is not pass, system will stop here.
//  */
//
//
// /* FILES */
//
// // var storage = multer.diskStorage({
// //   destination: function(req, file, callback) {
// //     var folder = DIR + '/' + req.headers['authorization'].split(' ')[0];
// //     if(fs.existsSync(folder)) {
// //       callback(null, folder);
// //     }
// //     else {
// //       fs.mkdirSync(folder);
// //       callback(null, folder);
// //     }
// //   },
// //   filename: function(req, file, callback) {
// //     callback(null, file.originalname);
// //   }
// // })
//
// // var upload = multer({storage: storage}).array('file', 10);
//
// // /**
// //  * upload files
// //  */
// // router.post('/upload', function (req, res) {
// //   upload(req, res, function (err) {
// //     if (err) {
// //       return res.send(err.toString());
// //     }
// //     res.send('File is uploaded');
// //   });
// // });
//
// router.post('/upload', (req, res) => {
//     router.use(multerObj.any());
// });
//
//
// module.exports = router;
