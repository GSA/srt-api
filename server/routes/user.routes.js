/** @module MasqueradeRoutes */
const authRoutes = require('../routes/auth.routes')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')
// noinspection JSUnresolvedVariable
const User = require('../models').User
const logger = require('../config/winston')
const {common} = require('../config/config.js')
const {getConfig} = require('../config/configuration')



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
      logger.log('error', 'error in: performUpdatePassword', { error:e, tag: 'performUpdatePassword' })
      throw e
    })
}

/**
 * Returns the email associated with the current request, or anonymous if user not logged in
 *
 * @param req
 * @return {string|*} email
 */
function whoAmI (req) {
  try {
    if (req.session && req.session.email) {
      return req.session.email
    }
    if (req.headers && req.headers['authorization']) {
      let token = req.headers['authorization'].split(' ')[1]
      // noinspection JSUnresolvedVariable
      let userInfo = jwt.decode(token).user
      return userInfo.email
    }
  } catch (e) {
    logger.log('error', 'error in: e', {error: e, tag: 'whoAmI'})
  }
  return 'anonymous'

}

/**
 * Verify that the given request is coming from a user authorized to masquerade as another user type.
 *
 * @param req
 * @return {{message: string, status: number}}
 */
function masqueradeAuthCheck(req) {
  if (!req.headers['authorization']) {
    return {status: 401, message: 'No authorization token provided'}
  }

  let token = req.headers['authorization'].split(' ')[1]
  // noinspection JSUnresolvedVariable
  let currentUser = jwt.decode(token).user
  if (currentUser.userRole !== "Administrator") {
    return {status: 401, message: 'Not authorized'}
  }

  if (authRoutes.roleNameToCASGroup(req.query.role) === null) {
    logger.log("error", "Masquerade attempted to switch role to " + req.query.role, {tag: 'masquerade'})
    return {status: 400, message: 'Role not found'}
  }

  return {status: 200, message: 'OK'}
}

module.exports = {

  whoAmI : whoAmI,

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
        logger.log('error', 'error in filter', {error:e, tag:'filter'})
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
    logger.log ('warn', 'user update attempted', {tag:'update', request_body: req.body})
    return res.status(200).send({})
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
    let email = whoAmI(req)
    logger.log('info', 'Updating password call for user ' + email , { tag: 'updatePassword' })
    logger.log('info', 'Deprecated call user.routes.updatePassword ' , { tag: 'CAS-dep' })
    return res.status(200).send({ message: 'Password changed.' })
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
        let date = user.creationDate
        if ( date.match(/^[0-9]+$/)) { // if it's a numeric timestamp
          let d = new Date(parseInt(date))
          date = (d.getMonth()+1) + "-" + d.getDate() + "-" + d.getFullYear()
        }
        return res.status(200).send({ creationDate: date })
      })
      .catch(e => {
        logger.log('error', 'error in: getCurrentUser', {error: e, tag: 'getCurrentUser'})
        return res.status(500).send(e)
      })
  },


  /**
   * Send back a new token for a different user type and agency
   *
   * @param req
   * @param res
   * @return {Promise<*>}
   */
  masquerade: async function (req, res) {

    let check = masqueradeAuthCheck(req)
    if (check.status !== 200) {
      return res.status(check.status).send(check.message)
    }

    // @ts-ignore
    let decoded = jwt.decode(req.headers['authorization'].split(' ')[1])
    decoded.user.agency = req.query.agency
    decoded.user.userRole = req.query.role
    decoded.user.grouplist = authRoutes.roleNameToCASGroup(req.query.role)
    decoded.user.firstName = "Masquerade"
    decoded.user.lastName = req.query.role

    let newToken = jwt.sign({user: decoded.user}, common.jwtSecret, { expiresIn: getConfig('tokenLife') })

    return res.status(200).send({token: newToken, agency: req.query.agency, role: req.query.role})



  }

}
