/** @module UserRoutes */

const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')
// noinspection JSUnresolvedVariable
const User = require('../models').User
const logger = require('../config/winston')
const emailRoutes = require('./email.routes')
const path = require('path')
const env = process.env.NODE_ENV || 'development'
const config = require(path.join(__dirname, '/../config/config.json'))[env]

/**
 *
 * Helper function to save an updated user password
 *
 * @param {User} user Sequelize User record
 * @param {string} unencryptedPassword New password for the User
 * @return {Promise}
 */
/** @namespace user.password */
/** @namespace user.tempPassword */
/** @namespace user.save */
let performUpdatePassword = function (user, unencryptedPassword) {
  logger.log('info', 'Updating password for user ' + user.email, { tag: 'performUpdatePassword' })

  user.password = bcrypt.hashSync(unencryptedPassword, 10)
  user.tempPassword = ''
  return user.save()
    .catch(e => {
      logger.log('error', e, { tag: 'performUpdatePassword' })
      throw e
    })
}

module.exports = {

  /**
     * <b>POST /api/user/filter </b> <br><br>
     *
     * Sends an array of users records that match the supplied filter to the response.
     *
     * @param {Request} req  Request
     * @param {Request} req.body.isAccepted [optional] Return users having an isAccepted value matching this
     * @param {Request} req.body.isRejected [optional] Return users having an isRejected value matching this
     * @param {Response} res
     * @return {Promise}
     */
  filter: function (req, res) {
    let isAccepted = req.body.isAccepted
    let isRejected = req.body.isRejected
    let filter = {}

    if (isAccepted != null) {
      filter['isAccepted'] = isAccepted
    }
    if (isRejected != null) {
      filter['isRejected'] = isRejected
    }
    return User.findAll({ where: filter })
      .then(users => {
        res.status(200).send(users)
      })
      .catch(e => {
        logger.error(e)
        res.status(400).send(e)
      })
  },

  /**
     * <b>POST /api/user/updateUserInfo </b> <br>
     * <b>POST /api/user/update</b> <br><br>
     *
     * Updates a user record with the supplied values.<br>
     * There are no authorization checks - any authenticated user can update any record
     *
     * @param {Request} req Request
     * @param {Request} req.params
     * @param {Request} req.body.id User ID to update
     * @param {Request} req.body.isRejected [optional] Return users having an isRejected value matching this
     * @param {string} req.body.firstName [optional]
     * @param {string} req.body.lastName [optional]
     * @param {string} req.body.agency [optional]
     * @param {string} req.body.NewEmail [optional]
     * @param {string} req.body.password [optional]
     * @param {string} req.body.position [optional]
     * @param {string} req.body.isAccepted [optional]
     * @param {string} req.body.isRejected [optional]
     * @param {string} req.body.userRole [optional]
     * @param {string} req.body.rejectionNote [optional]
     * @param {string} req.body.creationDate [optional]
     * @param {string} req.body.tempPassword [optional]
     * @param {Response} res
     * @return {Promise}
     */
  update: function (req, res) {
    let id = (req.body.userId) ? req.body.userId
      : (req.body.id) ? req.body.id
        : (req.body.UserID) ? req.body.UserID : -1
    return User.findByPk(id).then((user) => {
      if (user == null) {
        logger.log('info', req.params, { tag: 'could not find user, userID ' + id })
        return res.status(404).send('Unable to find user ' + id)
      }
      Object.keys(req.body).forEach(k => {
        if (user.dataValues.hasOwnProperty(k)) {
          user[k] = req.body[k]
        }
      })
      // take care of odd legacy UI expectations
      if (req.body.NewEmail) {
        user.email = req.body.NewEmail
      }

      return user.save().then(() => {
        return res.status(200).send(user)
      })
    }).catch(e => {
      logger.log('error', e, { tag: 'user.routes.update', id: id })
      return res.status(500).send(e)
    })
  },

  /**
     * exported here for use in unit tests
     *
     */
  performUpdatePassword: performUpdatePassword,

  /**
     * <b>POST /api/user/updatePassword</b><br><br>
     *
     * Update a user's password. The user account is identified by decoding the JWT so this will
     * only ever change the current user's password.
     *
     * @param {string} req Request
     * @param {string} req.headers
     * @param {string} req.body.password New unencrypted password.
     * @param {string} req.body.oldpassword Unencrypted current password. Must match the db.
     * @param {Response} res
     * @return {Promise}
     */
  updatePassword: function (req, res) {
    let newPassword = req.body.password
    let oldPassword = req.body.oldpassword
    let token = req.headers['authorization'].split(' ')[1]
    // noinspection JSUnresolvedVariable
    let me = jwt.decode(token).user

    logger.log('info', 'Updating password for user ' + me.email, { tag: 'updatePassword' })

    return User.findByPk(me.id).then((user) => {
      if (oldPassword === user.tempPassword || bcrypt.compareSync(oldPassword, user.password)) {
        return performUpdatePassword(user, newPassword).then(() => {
          let message = {
            text: 'Your password for the Solicitation Review Tool has been changed. If you did not request a password change, please contact ' + config.emailFrom,
            from: config.emailFrom,
            to: user.email,
            cc: '',
            subject: 'Change password'
          }

          return emailRoutes.sendMessage(message)
            .then(() => {
              return res.status(200).send({ message: 'Password changed.' })
            })
            .catch((err) => {
              logger.log('error', err, { tag: 'updatePassword - error sending email' })
              logger.log('error', message, { tag: 'updatePassword - error sending email with this contents' })
              return res.status(500).send({ message: 'error updating password' })
            })
        })
      } else {
        logger.log('info', 'Failed attempt to change password by ' + me.email)
        return res.status(401).send({ message: 'current password is not correct!' })
      }
    }).catch(e => {
      logger.error(e)
      res.status(500).send({ message: 'Update failed - ' + e.stack })
    })
  },
  /**
     * <b>POST /api/user/getUserInfo</b><br><br>
     *
     * Finds the User record that matches the supplied ID and sends it to the response
     *
     * @param {Request} req
     * @param {string} req.body.id User ID
     * @param {Response} res
     * @return {Promise}
     */
  getUserInfo: function (req, res) {
    let id =
            (req.body.UserID) ? req.body.UserID
              : (req.body.UserId) ? req.body.UserId
                : (req.body.id) ? req.body.id : -1
    return User.findOne({ where: { id: id } })
      .then(user => {
        if (user) {
          user.password = '*'
          user.tempPassword = '*'
        } else {
          logger.log('info', req.body, { tag: 'getUserInfo no user found' })
        }
        return res.status(200).send(user)
      })
      .catch(e => {
        logger.log('info', e, { tag: 'getUserInfo no user found' })
        return res.status(400).send(e)
      })
  },

  /**
     * Legacy code - Get the create Date.   (this was the orig. comment. No idea what is going on here!)
     */
  getCurrentUser: function (req, res) {
    if (!req.headers['authorization']) {
      return res.status(404).send('No authorization token provided')
    }

    let token = req.headers['authorization'].split(' ')[1]
    // noinspection JSUnresolvedVariable
    let current = jwt.decode(token).user
    return User.findByPk(current.id)
      .then(user => {
        return res.status(200).send({ creationDate: user.creationDate })
      })
      .catch(e => {
        logger.error(e)
        return res.status(500).send(e)
      })
  }

}
