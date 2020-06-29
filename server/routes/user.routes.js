/** @module MasqueradeRoutes */
const authRoutes = require('../routes/auth.routes')
const jwt = require('jsonwebtoken')
// noinspection JSUnresolvedVariable
const User = require('../models').User
const logger = require('../config/winston')
const {common} = require('../config/config.js')
const {getConfig} = require('../config/configuration')



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
 * @return {boolean}
 */
function roleExists(req) {
  if (authRoutes.roleNameToCASGroup(req.query.role) === null) {
    logger.log("error", "Masquerade attempted to switch role to " + req.query.role, {tag: 'masquerade'})
    return false
  }
  return true
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
   * Send back a new token for a different user type and agency
   *
   * @param req
   * @param res
   * @return {Promise<*>}
   */
  masquerade: async function (req, res) {

    if ( ! roleExists(req)) {
      return res.status(400).send({message: 'Role not found'})
    }

    let decoded = jwt.decode(req.headers['authorization'].split(' ')[1])      /** @namespace decoded.user*/
    decoded.user.agency = authRoutes.translateCASAgencyName(req.query.agency)
    decoded.user.userRole = req.query.role
    decoded.user.grouplist = authRoutes.roleNameToCASGroup(req.query.role)
    decoded.user.firstName = decoded.user.firstName + ' M'
    decoded.user.lastName = req.query.role
    decoded.user.email = decoded.user.email + '.masq'

    let newToken = jwt.sign({user: decoded.user}, common.jwtSecret, { expiresIn: getConfig('tokenLife') })

    return res.status(200).send({token: newToken, agency: decoded.user.agency, role: decoded.user.userRole})



  }

}
