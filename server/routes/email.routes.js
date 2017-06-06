var express = require('express');
var router = express.Router();
const email = require('emailjs');

var emailServer = email.server.connect({
  user: 'solicitationreview@gmail.com',
  password: 'thisisadummy',
  host: 'smtp.gmail.com',
  ssl: true
});

// This is the route to email the SRT Detailed Results.

router.post('/', (req, res, next) => {

    var header = {
        text: req.body.text,
        from: "Solicitation Review Tool <solicitationreview@gmail.com>",
        to: req.body.emailTo,//req.body.email,
        cc: req.body.emailCC,
        subject: req.body.subject
    };

    var message = email.message.create(header);

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
          message: 'Email sent'
        });
    });

    // emailServer.send({
    //   text: req.body.text,
    //   from: "Solicitation Review Tool <solicitationreview@gmail.com>",
    //   to: req.body.emailTo,//req.body.email,
    //   cc: req.body.emailCC,
    //   subject: req.body.subject,  
    //   attachment: 
    //   [
    //     {data:"<html>i <i>hope</i> this works!</html>", alternative:true}
    //   ]
    // }, function (err, message) {
      
    //   if (err) {        
    //     return res.status(500).json({
    //       title: 'An error occurred',
    //       error: err
    //     });
    //   }
    //   res.status(200).json({
    //     message: 'Email sent'
    //   });
      
    // });
  });

  module.exports = router;
