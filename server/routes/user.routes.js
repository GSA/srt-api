const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models').User;
const logger = require('../config/winston');
const emailRoutes = require('./email.routes');

const env = process.env.NODE_ENV || 'development';
const config = require(__dirname + '/../config/config.json')[env];


let performUpdatePassword = function (user, unencrypted_password) {
    logger.log ("info", "Updating password for user " + user.email, {tag : "performUpdatePassword"});

    user.password = bcrypt.hashSync(unencrypted_password, 10);
    user.tempPassword = "";
    return user.save()
        .catch(e => {
            logger.log("error", e, {tag: "performUpdatePassword"});
            throw e;
        })
}


module.exports = {
    filter: function(req, res) {
        var filterParams = {};
        var isAccepted = req.body.isAccepted;
        var isRejected = req.body.isRejected;
        var filter = {};

        if (isAccepted != null) {
            filter['isAccepted'] = isAccepted;
        }
        if (isRejected != null) {
            filter['isRejected'] = isRejected;
        }
        return User.findAll({where: filter})
            .then( users => {
                res.status(200).send(users);
            })
            .catch( e => {
                logger.error(e);
                res.status(400).send(e);
            })
    },

    update: function(req,res) {
        let id = (req.body.userId) ? req.body.userId :
                    (req.body.id) ? req.body.id :
                        (req.body.UserID) ? req.body.UserID : -1 ;
        return User.findByPk(id).then( (user) => {
            if (user == null) {
                logger.log("info", req.params, {tag: "could not find user, userID " + id});
                return res.status(404).send("Unable to find user " + id);
            }
            Object.keys(req.body).forEach( k => {
                if (user.dataValues.hasOwnProperty(k)) {
                    user[k] = req.body[k];
                }
            })
            // take care of odd legacy UI expectations
            if (req.body.NewEmail) {
                user.email = req.body.NewEmail;
            }

            return user.save().then( () => {
                return res.status(200).send(user);
            })
        }).catch ( e => {
            logger.log("error", e, {tag: "user.routes.update", id: id});
            return res.status(500).send(e);
        })
    },

    performUpdatePassword: performUpdatePassword,

    updatePassword: function (req, res) {
        var newPassword = req.body.password;
        var oldPassword = req.body.oldpassword;
        var token = req.headers['authorization'].split(' ')[1];
        var me = jwt.decode(token).user;

        logger.log ("info", "Updating password for user " + me.email, {tag : "updatePassword"});

        return User.findByPk(me.id).then((user) => {
            if (oldPassword == user.tempPassword || bcrypt.compareSync(oldPassword, user.password)) {

                return performUpdatePassword(user, newPassword).then(() => {
                    let message = {
                        text: "Your password for the Solicitation Review Tool has been changed. If you did not request a password change, please contact " + config.emailFrom,
                        from: config.emailFrom,
                        to: user.email,
                        cc: '',
                        subject: "Change password"
                      };

                    return emailRoutes.sendMessage(message)
                        .then( () => {
                            return res.status(200).send({message: "Password changed."})
                        })
                        .catch( (err) => {
                            logger.log ("error", err, {tag: "updatePassword - error sending email"});
                            logger.log ("error", message, {tag: "updatePassword - error sending email with this contents"});
                            return res.status(500).send({message: "error updating password"})
                        })
                })
            } else {

                logger.log("info", "Failed attempt to change password by " + me.email);
                return res.status(401).send({message: 'current password is not correct!'});
            }
        }).catch(e => {
            logger.error(e);
            res.status(500).send({message: 'Update failed - ' + e.stack});
        })

    },

    getUserInfo: function(req, res) {
        let id =
            (req.body.UserID) ? req.body.UserID :
                (req.body.UserId) ? req.body.UserId :
                    (req.body.id) ? req.body.id : -1;
        return User.findOne({where : {id: id}})
            .then( user => {
                if (user) {
                    user.password = "*";
                    user.tempPassword = "*";
                } else {
                    logger.log ("info", req.body, {tag: "getUserInfo no user found"});
                }
                return res.status(200).send(user);
            })
            .catch ( e => {
                logger.log ("info", e, {tag: "getUserInfo no user found"});
                return res.status(400).send(e);
            })
    },


     /**
     * Get the create Date.   (this was the orig. comment. No idea what is going on here!)
     */
     getCurrentUser: function (req, res) {
         if ( ! req.headers['authorization']) {
             return res.status(404).send("No authorization token provided");
         }

         var token = req.headers['authorization'].split(' ')[1];
         var current = jwt.decode(token).user;
         return User.findByPk(current.id)
             .then(user => {
                 return res.status(200).send({ creationDate : user.creationDate});
             })
             .catch(e => {
                 logger.error(e);
                 return res.status(500).send(e);
             });
     }






};
