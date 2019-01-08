const express = require('express');
const router = express.Router();

const nodemailer = require((process.env.MAIL_ENGINE) ? process.env.MAIL_ENGINE : 'nodemailer');
const token = require('../security/token');
const jwt = require('jsonwebtoken');
const UserSchemas = require('../schemas/user.js');
const logger = require('../config/winston');

const env = process.env.NODE_ENV || 'development';
const config = require(__dirname + '/../config/config.json')[env];




module.exports = {
    email : async function (req, res, next) {
        var mailOptions = {
            text: req.body.text,
            from: config.emailFrom,
            to: req.body.emailTo,//req.body.email,
            cc: req.body.emailCC,
            subject: req.body.subject
        };

        if (mailOptions.text == undefined ||
            mailOptions.to == undefined ||
            mailOptions.subject == undefined ) {
            return res.status(400).send({message: "E-mail text, to, and subject are all required."})
        }


        let transporter = nodemailer.createTransport(config.emailServer);
        logger.info("Sending email");

        try {
            let info = await transporter.sendMail(mailOptions);
                return res.status(200).send({
                    message: 'Email has sent'
                });
        } catch (err) {
            return res.status(400).send({
                message: err
            });

        }

    }

}

//
//
//
// /**
//  * email to
//  */
// router.post('/', (req, res, next) => {
//
//     var header = {
//         text: req.body.text,
//         from: "Solicitation Review Tool <solicitationreview@gmail.com>",
//         to: req.body.emailTo,//req.body.email,
//         cc: req.body.emailCC,
//         subject: req.body.subject
//     };
//
//     var message = Emailjs.message.create(header);
//
//     message.attach_alternative(req.body.text);
//
//     emailServer.send(
//       message,
//       function (err, message) {
//         if (err) {
//           return res.status(500).json({
//             title: 'An error occurred',
//             error: err
//           });
//         }
//         res.status(200).json({
//           message: 'Email has sent'
//         });
//     });
//   });
//
//
//
//
// /**
//  * Reset password.
//  */
// router.post('/resetPassword', (req, res) => {
//   var email = req.body.email;
//
//   UserSchemas.findOne({ email: email }, function (err, user) {
//     if (err) {
//      res.send(err);
//     }
//     if (user) {
//       var header = {
//         text: "",
//         from: "Solicitation Review Tool <solicitationreview@gmail.com>",
//         to: req.body.email,//req.body.email,
//         cc: '',
//         subject: "Change password"
//       };
//
//       var message = Emailjs.message.create(header);
//       var bodytext = "Your temp password is   " + user.tempPassword + "   ,please copy and login to change your password!"
//       message.attach_alternative(bodytext);
//       emailServer.send(
//         message,
//         function (err) {
//           if (err) {
//             res.send(err);
//           }
//           res.json({message: ' Reset password request has been sent, please check on your email!'})
//
//         });
//     }
//   })
// });
//
// /**
// * Check token, if token is not pass, system will stop here.
// */
// router.use(token());
//
//
//
// /**
//  * Update password.
//  */
// router.post('/updatePassword', (req, res) => {
//   var token = req.headers['authorization'].split(' ')[1];
//   if (token != 'null') {
//
//     var user = jwt.decode(token).user;
//
//     var header = {
//       text: "",
//       from: "Solicitation Review Tool <solicitationreview@gmail.com>",
//       to: user.email,//req.body.email,
//       cc: '',
//       subject: "Change password"
//     };
//
//     var message = Emailjs.message.create(header);
//     var bodytext = "you request to change your password! if not your operation, Please let us know!"
//     message.attach_alternative(bodytext);
//     emailServer.send(
//       message,
//       function (err) {
//         if (err) {
//           res.send(err);
//         }
//         res.json({message: 'email sented!'})
//
//       });
//   }
// });
//
//
//
//
//   module.exports = router;
