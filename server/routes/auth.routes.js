/** @module Auth */

var express = require('express');
var bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const logger = require('../config/winston');
const emailRoutes = require ('./email.routes');

const User = require('../models').User;

const env = process.env.NODE_ENV || 'development';
const config = require(__dirname + '/../config/config.json')[env];



/**
 * Defines the functions used to process the various authorization and authentication related API routes.
 */
module.exports = {
    /**
     * <b> POST /api/auth </b> <br><br>
     *
     * Creates a new (un-approved) user account. This is a public route
     *
     * @param {Request} req
     * @param {Object} req.body
     * @param {string} req.body.firstName - Registered user's first name
     * @param {string} req.body.lastName - Registered user's last name
     * @param {string} req.body.email - Registered user's email. Must be unique in the system
     * @param {string} req.body.agency - Registered user's agency name. This is the full name, not ID or acronym.
     * @param {string} req.body.password - Registered user's temporary password
     * @param {string} req.body.position - Registered user's role
     * @param {string} req.body.isAccepted - Ignored - all user registrations will start as isAccepted false
     * @param {string} req.body.isRejected - Ignored - all user registrations will start as isRejected false
     * @param res
     * @return {Promise}
     */
    create: function create(req, res) {

        var obj = {};
        ['firstName', 'lastName', 'email', 'agency', 'password', 'position', 'isAccepted', 'isRejected', 'userRole', 'rejectionNote', 'creationDate', 'tempPassword', 'createdAt', 'updatedAt']
            .forEach((element) => {
                obj[element] = req.body[element];
            });
        obj.tempPassword = req.body['password'];
        obj.creationDate = new Date().toLocaleString();
        obj.isAccepted = false;
        obj.isRejected = false;

        return User.create(obj)
            .then(user => {
                return res.status(201).send(user);
            })
            .catch(error => {
                    res.status(401).send(error);
                }
            );
    },

    /**
     * <b> POST /api/auth/login </b> <br><br>
     *
     * Attempts to log in a user with the given credentials. <br>
     * On success, will send the Response an object with the following structure <br>
     *     <pre>
          {
              message: 'Successfully logged in',
              token: JWT Token,
              firstName: user.firstName,
              lastName: user.lastName,
              email: user.email,
              agency: user.agency,
              position: user.position,
              userRole: user.userRole,
              id: user.id
          };

          </pre>
     *
     * @param {Request} req
     * @param {Object} req.body
     * @param {string} req.body.email - User's email
     * @param {string} req.body.password - User's unencrypted password or temporary password
     * @param res
     * @return {Promise}
     */
    login: async function (req, res) {

        User.find({where: {email: req.body.email}})
            .then(async user => {
                var temp = req.body.password == user.tempPassword
                if (!(bcrypt.compareSync(req.body.password, user.password) || temp || bcrypt.compareSync(req.body.password, user.tempPassword))) {
                    // nothing matches
                    return res.status(401).send({
                        title: 'Login failed',
                        error: {message: 'Invalid user Email Address or Password.'}
                    });
                }

                if (!user.isAccepted) {
                    logger.info("User " + user.email + " is not marked as accepted.");
                    return res.status(401).send({
                        title: 'Login failed',
                        error: {message: 'Your account has not been approved, please wait for Administrator Approval.'}
                    });
                }

                // if user doesn't use temp password login, we need to clear temp password for the user.
                // This means user still remember her/his password
                if (!temp && user.tempPassword != "") {
                    user.tempPassword = "";
                    await user.save();
                }

                if (temp) {
                    logger.info(user.email + " authenticated with temporary password.");
                }

                var token = jwt.sign({user: user}, 'innovation', {expiresIn: '2h'}); // token is good for 2 hours

                let ret_obj = {
                    message: 'Successfully logged in',
                    token: token,
                    firstName: user.firstName, // save name and agency to local browser storage
                    lastName: user.lastName,
                    email: user.email,
                    agency: user.agency,
                    position: user.position,
                    userRole: user.userRole,
                    id: user.id,
                //    tempPassword: user.tempPassword
                };

                res.status(200).send(ret_obj);

            })
            .catch(err => {
                return res.status(401).send({
                    title: 'Unauthorized'
                });
            });
    },

    // TODO: The proper fix is to rework the client, but that is outside scope for now.
    /**
     * <b> POST /api/auth/resetPassword </b> <br><br>
     *
     * This fake reset is used to handle a duplicate call the client
     * makes when resetting passwords.  <br>
     * On success, will send the Response a string "First step password reset complete.

     * @param req
     * @param res
     * @return Promise
     */
    resetPasswordFake: function (req, res) {
        return res.status(200).send({
            tempPassword: "",
            message: "First step password reset complete."
        })
    },


    /**
     * <b> POST /api/email/resetPassword </b> <br><br>
     *
     * Performs a password reset on the supplied user email. If the reset is successful
     * an email will be sent to the supplied address with instructions on how to
     * proceed with the reset. This is a public call.<br>
     * On success, will send the Response an object with the following structure <br>
     *     <pre>
           {
               tempPassword: string,
               message: 'If this account was found in our system, an email
                         with password reset instructions was sent to ' + req.body.email
           }
     </pre>
     *
     * @param {Request} req
     * @param {Object} req.body
     * @param {string} req.body.email - User's email
     * @param {Response} res
     * @return {Promise}
     */
    resetPassword: function (req, res) {
        let email = req.body.email;
        let message = 'If this account was found in our system, an email with password reset instructions was sent to ' + req.body.email;
        let temp = new Date().toLocaleDateString() + new Date().toLocaleTimeString() + 'SRTAI';
        return User.findOne({where: {email: email}})
            .then(async user => {
                let encryptedTemp = bcrypt.hashSync(temp, 10);
                if (user != null) {
                    // encrypt temp.
                    user.tempPassword = encryptedTemp;
                    return user.save()
                        .then( (user) => {
                            var mailOptions = {
                                text: "A password reset " +
                                    "for the account associated with " + user.email + " " +
                                    "in the Soliciation Review Tool was requested. " +
                                    "The new password is " + temp,
                                from: config.emailFrom,
                                to: email,
                                cc: "",
                                subject: "Solicitation Review Tool Password Reset"
                            };

                            return emailRoutes.sendMessage(mailOptions)
                                .then( status => {
                                    logger.log("info", "Password reset for user " + email , {tag:"resetPassword"})
                                    return res.status(200).send({
                                        tempPassword: temp,
                                        message: message
                                    })
                                })
                                .catch (status => {
                                    logger.log("error", status, {tag:"resetPassword - error sending email for resetPassword"})
                                    logger.log ("error", mailOptions, {tag:"resetPassword - mail options"})
                                    return res.status(500).send({
                                        tempPassword: temp,
                                        message: "There was an error resetting this password."
                                    })
                                })
                        })
                        .catch( err => {
                            logger.log ("error", err, {tag: "resetPassword - catch save"});
                        })

                }
                logger.log("info", "Password reset attempt for unknown user " + email , {tag:"resetPassword"})
                return res.status(200).send({
                    tempPassword: temp,
                    message: message
                })

            })
            .catch((err) => {
                logger.log("error", err, {tag:"resetPassword catch"});
                return res.status(500).send(err);
            });
    },

    /**
     * <b> POST /api/auth/tokenCheck</b> <br><br>
     *
     * Examines the supplied JWT token to verify it was properly signed and is valid.
     * For valid tokens the user's role information will be returned:
     * <pre>
          {
              isLogin: true/false,
              isGSAAdmin: true/false
          }
       </pre>
     *
     * @param {Request} req
     * @param {Object} req.body
     * @param {string} req.body.token - JWT Token to test
     * @param {Response} res
     * @return {Promise}
     */
    tokenCheck: function (req, res, next) {
        var token = req.body.token;
        var isLogin = false;
        var isGSAAdmin = false;

        try {

            if (token == undefined ||
                (!jwt.verify(token, 'innovation'))) {
                // client expects a response here even though the request was malformed
                return res.status(200).send({isLogin: false, isGSAAdmin: false});
                //return res.send(400);

            }

            var tokenInfo = jwt.decode(token);
            isLogin = true;

            if (tokenInfo.user) {
                return User.findOne({where: {email: tokenInfo.user.email}})
                    .then((u) => {

                        if (u == null) {
                            return res.status(200).send({isLogin: false, isGSAAdmin: false});
                        }
                        isGSAAdmin = (tokenInfo.user.userRole == "Administrator" || tokenInfo.user.userRole == "SRT Program Manager ")
                            && tokenInfo.user != null
                            && tokenInfo.user.agency != null
                            &&
                            (tokenInfo.user.agency == "General Services Administration"
                                ||
                                typeof (tokenInfo.user.agency) == "object" && tokenInfo.user.agency.indexOf("General Services Administration") > -1
                            );
                        return res.status(200).send({isLogin: isLogin, isGSAAdmin: isGSAAdmin});
                    })
                    .catch((e) => {
                        return res.status(200).send({isLogin: false, isGSAAdmin: false});
                    });
            }
        } catch (e) {
            logger.log ("error", "caught error in JWT verification, failing safe and returning that the token is not valid")
            logger.log ("error", e);
        }
        return res.status(200).send({isLogin: false, isGSAAdmin: false});


    },

}
