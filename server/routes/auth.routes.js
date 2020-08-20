/** @module AuthRoutes */

const jwt = require('jsonwebtoken')
const logger = require('../config/winston')
// noinspection JSUnresolvedVariable
const User = require('../models').User
const ms = require('ms')

const env = process.env.NODE_ENV || 'development'
const config = require('../config/config.js')[env]
const {common} = require('../config/config.js')
const {getConfig} = require('../config/configuration')

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
        logger.log('error', 'error in: updateMAXUser', { error:e, tag: 'updateMAXUser' })
      })
  } catch (e) {
    logger.log ("error", "caught error in auth.routes.js", {error:e, tag: 'updateMAXUser'})
  }
}


/**
 * @typedef {Object} express-session
 * @property {function}  destroy
 * @property {function}  get
 */

/**
 * Verifies that a login used a PIV/CAC card.
 * If one was not used, log that and wipe the session so the
 * cas-authentication module won't auto-login the user
 *
 * @param  {express-session} session
 * @return {boolean}
 */
function verifyPIVUsed(session) {
  // verify that we got a PIV login
  let authMethod = session['cas_userinfo']['authenticationmethod'] || session['cas_userinfo']['samlauthenticationstatementauthmethod']
  let pivRegex = new RegExp(getConfig('PIVLoginCheckRegex'))
  if( ! authMethod.match(pivRegex)) {
    let userEmail = session['cas_userinfo']['email-address']
    logger.log('info', `User ${userEmail} was rejected due to login type ${authMethod}`, {tag: 'casStage2', 'cas_userinfo': session['cas_userinfo']})
    return false
  }
  return true
}

/**
 * Look at the email address in the MAX CAS session login and
 * return true if that address is an exact match for
 * something in ['cas_userinfo']['email-address']
 * or false otherwise.
 *
 * @param session
 * @returns {boolean}
 */
function userOnPasswordOnlyWhitelist(session){
  let userEmail = session && session['cas_userinfo'] && session['cas_userinfo']['email-address'];
  let whitelist = getConfig("maxCas:password-whitelist")

  if (! (userEmail && whitelist) ) {
    return false;
  }

  // normalize input so it can be an array or a string
  if (typeof(whitelist) == 'string') {
    whitelist = [ whitelist]
  }

  let match = false;
  whitelist.forEach( e => {
    if (userEmail === e ) {
      logger.log("warn", `A user was allowed to access SRT with a password-only login`, {tag: 'Auth', whitelist: whitelist, email: userEmail })
      match = true;
    }
  })

  return match;
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
      logger.log("error", 'error in: createMAXUser', {error: e, tag:"createMAXUser"})
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
    logger.log('error', "Trying to make a token without a MAX ID", { cas_data: cas_data, tag: 'createOrUpdateMAXUser' })
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
      logger.log("error", "Error caught in create/update MAX User", {error: e, tag: "create/update MAX User"})
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
    let match = roles.filter( (role) => role.casGroup === casGroup )
    if (match.length > 0 && match[0].priority < priority) {
      mostPrivilegedRole = match[0].name
      priority = match[0].priority
    }
  }
  return mostPrivilegedRole
}

/**
 * Takes in a role name, such as "Section 508 Coordinator" and returns the associated CAS group
 * @param roleName
 * @return {string|null}
 */
function roleNameToCASGroup (roleName) {
  for (let r of roles) {
    if (r.name === roleName) {
      return r.casGroup
    }
  }
  return null
}

/**
 * Takes an agency name as presented by MAX CAS and converts it to
 * an SRT agency name. The mapping may be described in a JSON formatted string
 * saved in the AGENCY_LOOKUP env variable. (Or it can just be in the regular config)
 *
 * @param {String} cas_agency
 * @return {String}
 */
function translateCASAgencyName(cas_agency) {
  let agencyLookupDictionary = getConfig("AGENCY_LOOKUP", {})

  // special case for config lookups - if we got this from the environment it's going to be a string
  if (typeof(agencyLookupDictionary) === 'string') {
    try {
      agencyLookupDictionary = JSON.parse(agencyLookupDictionary)
    } catch(e) {
      logger.log("error", "Error parsing AGENCY_LOOKUP. Should be JSON", {tag: "traslate CAS", AGENCY_LOOKUP: agencyLookupDictionary})
    }
  }

  return getConfig(cas_agency && cas_agency.toLowerCase(), cas_agency, agencyLookupDictionary)
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

  srt_userinfo['agency'] = translateCASAgencyName(srt_userinfo['org-agency-name'])
  delete srt_userinfo['org-agency-name']

  return srt_userinfo;
}

/***
 * Builds a JWT out of the info in the cas_userinfo object.
 *
 * @param {Object} cas_userinfo
 * @param {string} secret
 * @param expireTime
 * @param sessionStart
 * @param sessionEnd
 * @return {Promise<string>}
 */
async function tokenJsonFromCasInfo (cas_userinfo, secret, expireTime, sessionStart, sessionEnd) {
  cas_userinfo.userRole = mapCASRoleToUserRole(cas_userinfo.grouplist)
  cas_userinfo['maxId'] = (cas_userinfo['max-id']) ? cas_userinfo['max-id'] : cas_userinfo.maxId

  if ( ! cas_userinfo['maxId']) {
    // no MAX ID, return an empty token
    return "{}";
  }

  cas_userinfo['id'] = await createOrUpdateMAXUser(cas_userinfo)

  let srt_userinfo = convertCASNamesToSRT(cas_userinfo)
  srt_userinfo.sessionStart = sessionStart || Math.floor (new Date().getTime() / 1000)
  srt_userinfo.sessionEnd = sessionEnd || Math.floor ((new Date().getTime() + ms(getConfig('sessionLength')) )/ 1000)

  let token = jwt.sign({user: srt_userinfo}, secret, { expiresIn: expireTime || getConfig('tokenLife') })
  logger.log("debug", "creating a token valid for " + getConfig('tokenLife') )
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
  return  agency && agency.toLowerCase() === 'general services administration' &&
    (role === roles[ADMIN_ROLE].name || role === roles[PROGRAM_MANAGER_ROLE].name)
}

function userInfoFromReq(req) {
  try {
    let token = req.headers['authorization'].split(' ')[1]
    // noinspection JSUnresolvedVariable
    return (jwt.decode(token)).user
  } catch (error) {
    logger.log("info", `error decoding token`, {tag: 'userInfoFromReq', error: error})
  }
  return null;
}

/**
 * Defines the functions used to process the various authorization and authentication related API routes.
 */
module.exports = {


  renewToken: function (req, res) {

    let oldToken = req.headers['authorization'].split(' ')[1]
    // noinspection JSUnresolvedVariable
    let user = (jwt.decode(oldToken)).user

    // verify that the original login wasn't more than [sessionLength] ago
    let cutOff = user.sessionStart + (ms(getConfig('sessionLength')) /1000)
    if (cutOff < Math.floor(Date.now() / 1000)) {
      return res.status(401).send({msg: 'token expired'})
    }

    user.renewTime = Math.round (new Date().getTime() / 1000)
    let newToken = jwt.sign({user: user}, common.jwtSecret, { expiresIn: getConfig('renewTokenLife') })
    logger.log("debug", "creating a renewal token valid for " + getConfig('renewTokenLife') )


    return res.status(200).send({token: newToken, token_life_in_seconds: ms(getConfig('renewTokenLife'))/1000 })
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
      if ( token && jwt.verify(token, common.jwtSecret)) {
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
      logger.log('error', 'caught error in JWT verification, failing safe and returning that the token is not valid', {error:e, tag:'tokenCheck'})
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
        .set('Location', config['srtClientUrl'] + '/auth') // send them back with no token
        .send(`<html lang="en"><body>Login Failed</body></html>`)
    }

    if( ! ( verifyPIVUsed(req.session) ||  userOnPasswordOnlyWhitelist(req.session) ) ) {
      req.session.destroy();
      return res.status(302)
        .set('Location', encodeURI(config['srtClientUrl'] + '/auth?error=<p>PIV or CAC login required.<br> Log out of MAX and return here, then log in using a PIV or CAC.</p>')) // send them back with no token
        .send(`<html lang="en"><body>Login Failed</body></html>`)
    }

    logger.log('info', req.session.cas_userinfo['email-address'] + ' authenticated with MAX CAS ID ' + req.session.cas_userinfo['max-id'], {cas_userinfo: req.session.cas_userinfo, tag: 'casStage2'})

    let responseJson = await tokenJsonFromCasInfo(req.session.cas_userinfo, common.jwtSecret)
    let location = `${config['srtClientUrl']}/auth?token=${responseJson}`

    let rollList = roles.map( (x) => x.name) //?
    let decoded_user_role = JSON.parse(responseJson).userRole
    if ( ! rollList.includes(decoded_user_role)) {
      logger.log('info', req.session.cas_userinfo['email-address'] + ' does not have a SRT role. Rejecting', {responseJson: responseJson, tag: 'casStage2'})
      req.session.destroy();
      return res.status(302)
        .set('Location', encodeURI(config['srtClientUrl'] + '/auth' + '?error=Your MAX account is not associated with an SRT role. Please contact srt@gsa.gov for more information.')) // send them back with no token
        .send(`<html lang="en"><body>Login Failed</body></html>`)
    }

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
  roleNameToCASGroup   : roleNameToCASGroup,
  createOrUpdateMAXUser: createOrUpdateMAXUser,
  userInfoFromReq      : userInfoFromReq,
  isGSAAdmin           : isGSAAdmin,
  passwordOnlyWhitelist: userOnPasswordOnlyWhitelist,
  translateCASAgencyName: translateCASAgencyName,

  roles : roles,
  roleKeys : roleKeys,

  ADMIN_ROLE : ADMIN_ROLE,
  PROGRAM_MANAGER_ROLE : PROGRAM_MANAGER_ROLE,
  FIVE08_COORDINATOR_ROLE : FIVE08_COORDINATOR_ROLE,
  CO_ROLE : CO_ROLE,
  EXEC_ROLE : EXEC_ROLE


}
