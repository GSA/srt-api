/** @module AuthRoutes */

const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const logger = require('../config/winston')
// noinspection JSUnresolvedVariable
const User = require('../models').User

const env = process.env.NODE_ENV || 'development'
const config = require('../config/config.js')[env]

const roles = [
  { name: "Administrator", casGroup:"AGY-GSA-SRT-ADMINISTRATORS.ROLEMANAGEMENT", priority: 10},
  { name: "SRT Program Manager", casGroup: "AGY-GSA-SRT-PROGRAM-MANAGERS.ROLEMANAGEMENT", priority: 20},
  { name: "Section 508 Coordinator", casGroup: "AGY-GSA-SRT-508-COORDINATOR", priority: 30},
  { name: "CO / COR", casGroup: "AGY-GSA-SRT-CONTRACTINGOFFICERS", priority: 40},
  { name: "Executive User", casGroup: "AGY-GSA-SRT-USERS", priority: 50}
 ]
const roleKeys = {
  "ADMIN_ROLE" : 0,
  "PROGRAM_MANAGER_ROLE" : 1,
  "508_COORDINATOR_ROLE" : 2,
  "CO_ROLE" : 3,
  "EXEC_ROLE" : 4
}

const ADMIN_ROLE = 0
const PROGRAM_MANAGER_ROLE = 1
const FIVE08_COORDINATOR_ROLE = 2
const CO_ROLE = 3
const EXEC_ROLE = 4


/**
 * Update a user record in the database to reflect updated info from MAX CAS
 *
 * @param cas_data
 * @param {User} user
 * @param {function} user.save
 * @return {*|PromiseLike<T | never>|Promise<T | never>}
 */
function updateMAXUser(cas_data, user) {
  //update existing
  try {
    user['firstName'] = cas_data['first-name']
    user['lastName'] = cas_data['last-name']
    user['email'] = cas_data['email-address']
    user['password'] = null
    user['agency'] = cas_data['agency-name']
    user['position'] = ''
    user['userRole'] = 'Administrator'
    user['isRejected'] = false
    user['isAccepted'] = true
    user['tempPassword'] = null
    user['creationDate'] = Date.now()
    return user.save()
      .then(() => {
        return user['id']
      })
      .catch(e => {
        logger.log("error", e, { tag: "updateMAXUser" })
      })
  } catch (e) {
    logger.log ("error", e)
  }
}

/**
 * Create a new record in the User table based on the supplied MAX CAS data
 *
 * @param cas_data
 * @return {*|PromiseLike<T | never>|Promise<T | never>}
 */
function createMAXUser(cas_data) {
  let now = new Date()
  let date = (now.getMonth() + 1) + "-" + now.getDate() + "-" + now.getFullYear()
  let user_data = {
    'firstName': cas_data['first-name'],
    'lastName': cas_data['last-name'],
    'email': cas_data['email-address'],
    'password': null,
    'agency': cas_data['agency-name'],
    'position': '',
    'userRole': 'Administrator',
    'isRejected': false,
    'isAccepted': true,
    'tempPassword': null,
    'creationDate': date,
    'maxId': cas_data['maxId']
  }
  return User.create(user_data)
    .then( u => {
      return u.id
    })
    .catch ( e => {
      logger.log("error", e, {tag:"createMAXUser"})
    })

}

/**
 * Create or update a User table record from the supplied MAX CAS data
 *
 * @param cas_data
 * @return {Promise} Promise
 */
function createOrUpdateMAXUser (cas_data) {

  cas_data.maxId = cas_data['max-id'] || cas_data.maxId

  if (!cas_data.maxId) {
    logger.log('error', "Trying to make a token without a MAX ID")
    logger.log('error', cas_data, { tag: 'createOrUpdateMAXUser' })
    return false
  }

  return User.findOne({ where: { 'maxId': cas_data["maxId"] } })
    .then(async u => {
      if (u) {
        return updateMAXUser(cas_data, u)
      } else {
        return createMAXUser(cas_data)

      }
    })
    .catch( e => {
      logger.log("error", e, {tag: "create/update MAX User"})
    })
}

/***
 * Takes the group list from a CAS login and parses it to find the
 * proper role for the user.
 *
 * @param {string} roleList Comma separated string of CAS roles
 * @return {string} user role string as used by the UI
 */
function mapCASRoleToUserRole (roleList) {
  let mostPrivilegedRole = ""
  let priority = 99999;
  roleList = roleList || "";
  for (let casGroup of roleList.split(',')) {
    let match = roles.filter( (role) => role.casGroup === casGroup ) //?
    if (match.length > 0 && match[0].priority < priority) {
      mostPrivilegedRole = match[0].name
      priority = match[0].priority
    }
  }
  return mostPrivilegedRole
}

/***
 * This function does some translation between the cas naming
 * conventions and the JavaScript/SRT naming conventions for user info.
 *
 * @param {Object} cas_userinfo cas user information
 * @return {Object} user info reformatted into the expected JavaScript conventions
 */
function convertCASNamesToSRT (cas_userinfo) {
  let srt_userinfo = Object.assign({}, cas_userinfo)

  delete srt_userinfo['max-id']

  srt_userinfo['email'] = srt_userinfo['email-address']
  delete srt_userinfo['email-address']

  srt_userinfo['firstName'] = srt_userinfo['first-name']
  delete srt_userinfo['first-name']

  srt_userinfo['lastName'] = srt_userinfo['last-name']
  delete srt_userinfo['last-name']

  srt_userinfo['agency'] = srt_userinfo['org-agency-name']
  delete srt_userinfo['org-agency-name']

  return srt_userinfo;
}

/***
 * Builds a JWT out of the info in the cas_userinfo object.
 *
 * @param {Object} cas_userinfo
 * @param {string} secret
 * @return {Promise<string>}
 */
async function tokenJsonFromCasInfo (cas_userinfo, secret) {
  cas_userinfo.userRole = mapCASRoleToUserRole(cas_userinfo.grouplist)
  cas_userinfo['maxId'] = (cas_userinfo['max-id']) ? cas_userinfo['max-id'] : cas_userinfo.maxId

  if ( ! cas_userinfo['maxId']) {
    // no MAX ID, return an empty token
    return "{}";
  }

  cas_userinfo['id'] = await createOrUpdateMAXUser(cas_userinfo)

  let srt_userinfo = convertCASNamesToSRT(cas_userinfo)

  let token = jwt.sign({user: srt_userinfo}, secret, { expiresIn: '2h' }) // token is good for 2 hours
  return JSON.stringify({
    token: token,
    firstName: srt_userinfo['firstName'],
    lastName: srt_userinfo['lastName'],
    agency: srt_userinfo['agency'],
    email:  srt_userinfo['email'],
    position: '',
    maxId: srt_userinfo['maxId'],
    id: srt_userinfo['id'],
    userRole: srt_userinfo.userRole
  })
}

/**
 * Function to test if a user is a GSA Admin
 *
 * @param {String} agency
 * @param {String} role
 * @return {boolean}
 */
function isGSAAdmin(agency, role) {
  return  agency === 'General Services Administration' &&
    (role === roles[ADMIN_ROLE].name || role === roles[PROGRAM_MANAGER_ROLE].name)
}

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
  create: function create (req, res) {
    let obj = {};
    ['firstName', 'lastName', 'email', 'agency', 'password', 'position', 'isAccepted', 'isRejected', 'userRole', 'rejectionNote', 'creationDate', 'tempPassword', 'createdAt', 'updatedAt']
      .forEach((element) => {
        obj[element] = req.body[element]
      })
    obj.tempPassword = req.body['password']
    obj.creationDate = new Date().toLocaleString()
    obj.isAccepted = false
    obj.isRejected = false

    return User.create(obj)
      .then(user => {
        return res.status(201).send(user)
      })
      .catch(error => {
        res.status(401).send(error)
      }
      )
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
    User.findOne({ where: { email: req.body.email } })
      .then(async user => {
        let temp = req.body.password === user.tempPassword
        // noinspection JSUnresolvedFunction
        if (!(bcrypt.compareSync(req.body.password, user.password) || temp || bcrypt.compareSync(req.body.password, user.tempPassword))) {
          // nothing matches
          return res.status(401).send({
            title: 'Login failed',
            error: { message: 'Invalid user Email Address or Password.' }
          })
        }

        if (!user.isAccepted) {
          logger.info('User ' + user.email + ' is not marked as accepted.')
          return res.status(401).send({
            title: 'Login failed',
            error: { message: 'Your account has not been approved, please wait for Administrator Approval.' }
          })
        }

        // if user doesn't use temp password login, we need to clear temp password for the user.
        // This means user still remember her/his password
        if (!temp && user.tempPassword !== '') {
          user.tempPassword = ''
          await user.save()
        }

        if (temp) {
          logger.info(user.email + ' authenticated with temporary password.')
        }

        let token = jwt.sign({ user: user }, 'innovation', { expiresIn: '2h' }) // token is good for 2 hours

        let retObj = {
          message: 'Successfully logged in',
          token: token,
          firstName: user.firstName, // save name and agency to local browser storage
          lastName: user.lastName,
          email: user.email,
          agency: user.agency,
          position: user.position,
          userRole: user.userRole,
          id: user.id
          //    tempPassword: user.tempPassword
        }

        res.status(200).send(retObj)
      })
      .catch(err => {
        logger.log('info', err, { tag: 'auth.routes login' })
        return res.status(401).send({
          title: 'Unauthorized'
        })
      })
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
      tempPassword: '',
      message: 'First step password reset complete.'
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
    let email = req.body.email
    logger.log("warn", "Call to deprecated auth.routes.resetPassword by " + email, {tag: 'resetPassword'})
    res.status(200).send({})
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
  tokenCheck: function (req, res) {
    let token = req.body.token
    try {
      if ( token && jwt.verify(token, 'innovation')) {
        let tokenInfo = jwt.decode(token)
        /** @namespace tokenInfo.user */

        if (tokenInfo['user'] && tokenInfo['user']['maxId']) {
          return res.status(200).send(
            {
              isLogin: true,
              isGSAAdmin: isGSAAdmin(tokenInfo.user.agency, tokenInfo.user.userRole)
            })
        }
      }
    } catch (e) {
      logger.log('error', 'caught error in JWT verification, failing safe and returning that the token is not valid')
      logger.log('error', e)
    }
    return res.status(200).send({ isLogin: false, isGSAAdmin: false })
  },

  /**
   * Function called to create a JWT based on CAS info stored in the session
   * by the cas-authentication module bounce()
   *
   * On success the user is redirected to the auth page of the SRT app
   *
   * @param req
   * @param res
   */
  casStage2 : async function (req, res) {
    /** @namespace req.session.cas_userinfo */

    if ( ! ( req.session && req.session['cas_userinfo'] && (req.session.cas_userinfo['max-id'] || req.session.cas_userinfo['maxId']  ))) {
      // didn't get CAS session info
      return res.status(302)
        .set('Location', config['srtClientUrl'] + 'auth') // send them back with no token
        .send(`<html lang="en"><body>Login Failed</body></html>`)
    }
    logger.log('info', req.session.cas_userinfo['email-address'] + ' authenticated with MAX CAS ID ' + req.session.cas_userinfo['max-id'])

    let responseJson = await tokenJsonFromCasInfo(req.session.cas_userinfo, 'innovation')
    let location = `${config['srtClientUrl']}/auth?token=${responseJson}`

    return res.status(302)
      .set('Location', location)
      .send(`<html lang="en"><body>Preparing login</body></html>`)
  },

  /**
   * Take a pile of info from the CAS response and turn it into a token in our format
   *
   * @param cas_userinfo
   * @return {string} JSON string
   */
  tokenJsonFromCasInfo : tokenJsonFromCasInfo,

  mapCASRoleToUserRole : mapCASRoleToUserRole,
  createOrUpdateMAXUser: createOrUpdateMAXUser,

  roles : roles,
  roleKeys : roleKeys,

  ADMIN_ROLE : ADMIN_ROLE,
  PROGRAM_MANAGER_ROLE : PROGRAM_MANAGER_ROLE,
  FIVE08_COORDINATOR_ROLE : FIVE08_COORDINATOR_ROLE,
  CO_ROLE : CO_ROLE,
  EXEC_ROLE : EXEC_ROLE


}
