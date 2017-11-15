var express = require('express');
var router = express.Router();
const Emailjs = require('emailjs');
var token = require('../security/token');
var jwt = require('jsonwebtoken');

var UserSchemas = require('../schemas/user.js');





var emailServer = Emailjs.server.connect({
  user: 'solicitationreview@gmail.com',
  password: 'thisisadummy',
  host: 'smtp.gmail.com',
  ssl: true
});





/**
 * email to 
 */
router.post('/', (req, res, next) => {

    var header = {
        text: req.body.text,
        from: "Solicitation Review Tool <solicitationreview@gmail.com>",
        to: req.body.emailTo,//req.body.email,
        cc: req.body.emailCC,
        subject: req.body.subject
    };

    var message = Emailjs.message.create(header);

    message.attach_alternative(req.body.text);

    emailServer.send(
      message, 
      function (err, message) {      
        if (err) {        
          return res.status(500).json({
            title: 'An error occurred',
            error: err
          });
        }
        res.status(200).json({
          message: 'Email has sent'
        });
    });
  });




/**
 * Reset password.
 */
router.post('/resetPassword', (req, res) => {
  var email = req.body.email;

  console.log(email)
  UserSchemas.findOne({ email: email }, function (err, user) {
    if (err) {
     res.send(err);
    }
    console.log(user)
    if (user) {
      var header = {
        text: "",
        from: "Solicitation Review Tool <solicitationreview@gmail.com>",
        to: req.body.email,//req.body.email,
        cc: '',
        subject: "Change password"
      };
      console.log(header)

      var message = Emailjs.message.create(header);
      var bodytext = "Your temp password is   " + user.tempPassword + "   ,please copy and login to change your password!"
      message.attach_alternative(bodytext);
      emailServer.send(
        message,
        function (err) {
          if (err) {        
            res.send(err);
          }
          res.json({message: ' Reset password request has been sent, please check on your email!'})

        });
    }
  })
});

/**
* Check token, if token is not pass, system will stop here.
*/
router.use(token());



/**
 * Update password.
 */
router.post('/updatePassword', (req, res) => {
  var token = req.headers['authorization'].split(' ')[1];
  if (token != 'null') {
    
    var user = jwt.decode(token).user;
    console.log(user)
  
    var header = {
      text: "",
      from: "Solicitation Review Tool <solicitationreview@gmail.com>",
      to: user.email,//req.body.email,
      cc: '',
      subject: "Change password"
    };
    
    var message = Emailjs.message.create(header);
    var bodytext = "you request to change your password! if not your operation, Please let us know!"
    message.attach_alternative(bodytext);
    emailServer.send(
      message,
      function (err) {
        if (err) {        
          res.send(err);
        }
        res.json({message: 'email sented!'})
        
      });
  }
});




  module.exports = router;
