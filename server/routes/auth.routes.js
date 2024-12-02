/** @module AuthRoutes */

const jwt = require('jsonwebtoken')
const fs = require('fs');
const path = require("path");
//const util = require('node:util'); 
const {jsonToURI} = require('../utilities.js');

const { Op } = require('sequelize');
const logger = require('../config/winston')
// noinspection JSUnresolvedVariable
const User = require('../models').User
const ms = require('ms')
const fetch = require('node-fetch');
const env = process.env.NODE_ENV || 'development'
const config = require('../config/config.js')[env]
const {common} = require('../config/config.js')
const {getConfig} = require('../config/configuration')
const jwtSecret = common.jwtSecret || undefined


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

const topLevelAgencyMap = {
  'Department of Defense': ['Department of the Army', 'Department of the Navy', 'Department of the Air Force', 'Space Force', 'Defense Logistics Agency'],
  'Department of Health and Human Services': ['National Institutes of Health', 'Food and Drug Administration', 'Indian Health Service', 'Centers for Medicare & Medicaid Services'],
  'Department of Homeland Security': ['Federal Emergency Management Agency', 'U.S. Citizenship and Immigration Services', 'U.S. Secret Service'],
  'Department of Commerce': ['National Oceanic and Atmospheric Administration', 'National Telecommunications and Information Administration'],
  'Department of the Interior': ['National Park Service', 'Fish and Wildlife Service', 'Bureau of Ocean Energy Management'],
  'Department of the Treasury': ['Internal Revenue Service', 'U.S. Mint']
};

// Load your RSA private key
let privateKey;
try {
  privateKey = fs.readFileSync(path.resolve(__dirname, '../certs/private.pem'), 'utf8');
} catch (err) {
  privateKey = process.env.LOGIN_PRIVATE_KEY;
}
console.log("Private Key Loaded:", !!privateKey);  // Will print 'true' if key is loaded
//const publicKey = fs.readFileSync(path.resolve(__dirname,'../certs/public.crt'), 'utf8');
/**
 * Update a user record in the database to reflect updated info from MAX CAS
 *
 * @param cas_data
 * @param {User} user
 * @param {function} user.save
 * @return {*|PromiseLike<T | never>|Promise<T | never>}
 */
function updateMAXUser(cas_data, user) {
  try {
    logger.log('info', 'Updating MAX user', { 
      email: cas_data['email-address'],
      tag: 'updateMAXUser'
    })

    user['firstName'] = cas_data['first-name']
    user['lastName'] = cas_data['last-name']
    user['email'] = cas_data['email-address']
    user['password'] = null
    user['agency'] = cas_data['agency-name']
    user['position'] = ''
    user['userRole'] = cas_data['userRole']
    user['isRejected'] = false
    user['isAccepted'] = true
    user['tempPassword'] = null
    user['creationDate'] = date
    return user.save()
      .then(() => {
        return user['id']
      })
      .catch(e => {
        logger.log('error', 'error in: updateMAXUser', { error:e, tag: 'updateMAXUser' })
      })
  } catch (e) {
    logger.log("error", "caught error in auth.routes.js", {error:e, tag: 'updateMAXUser'})
  }
}

function updateUser(login_gov_data, user) {
  try {
    logger.log('info', 'Updating Login.gov user', {
      email: login_gov_data.email,
      tag: 'updateUser'
    })

    if (login_gov_data.given_name !== undefined) user['firstName'] = login_gov_data['given_name']
    if (login_gov_data.family_name !== undefined) user['lastName'] = login_gov_data['family_name']
    user['maxId'] = user.maxId || login_gov_data.sub
    
    return user.save()
      .then(() => {
        return user
      })
      .catch(e => {
        logger.log('error', 'error in: updateUser', { error:e, tag: 'updateUser' })
      })
  } catch (e) {
    logger.log("error", "caught error in auth.routes.js", {error:e, tag: 'updateUser'})
  }
}


function capitalize(s)
{
    return s[0].toUpperCase() + s.slice(1);
}

function getGovernmentEmail(emails) {
  return emails.find(email => email.endsWith('.gov') || email.endsWith('.mil')) || null;
}

function createUser(loginGovUser) {
  logger.log('info', 'Creating new Login.gov user', {
    email: loginGovUser.email,
    tag: 'createUser'
  })

  let now = new Date();
  let date = (now.getMonth() + 1) + "-" + now.getDate() + "-" + now.getFullYear();
  const user_email = gov_email || loginGovUser.email
  let user_data = {
    'firstName': loginGovUser.given_name || null,
    'lastName': loginGovUser.family_name || null,
    'email': user_email,
    'password': null,
    'agency': grabAgencyFromEmail(user_email),
    'position': '',
    'userRole': 'Executive User',
    'isRejected': false,
    'isAccepted': true,
    'tempPassword': null,
    'creationDate': date,
    'maxId': loginGovUser.sub
  };

  return User.create(user_data)
    .then((u) => {
      return u;
    })
    .catch((e) => {
      logger.log("error", 'Error in: createUser', {error: e, tag: "createUser"});
    });
}


const agencyNameVariations = {
  'Department of Defense': {
    'Department of the Army': ['DEPT OF THE ARMY', 'DEPARTMENT OF THE ARMY', 'US ARMY', 'ARMY'],
    'Department of the Navy': ['DEPT OF THE NAVY', 'DEPARTMENT OF THE NAVY', 'US NAVY', 'NAVY'],
    'Department of the Air Force': ['DEPT OF THE AIR FORCE', 'DEPARTMENT OF THE AIR FORCE', 'US AIR FORCE', 'AIR FORCE'],
    'Space Force': ['US SPACE FORCE', 'USSF', 'DEPARTMENT OF THE SPACE FORCE'],
    'Defense Logistics Agency': ['DLA', 'DEFENSE LOGISTICS AGENCY']
  },
  'Department of Health and Human Services': {
    'National Institutes of Health': ['NIH', 'NATIONAL INSTITUTES OF HEALTH'],
    'Food and Drug Administration': ['FDA', 'FOOD AND DRUG ADMINISTRATION'],
    'Indian Health Service': ['IHS', 'INDIAN HEALTH SERVICE'],
    'Centers for Medicare & Medicaid Services': ['CMS', 'CENTER FOR MEDICARE AND MEDICAID SERVICES']
  },
  'Department of Homeland Security': {
    'Federal Emergency Management Agency': ['FEMA'],
    'U.S. Citizenship and Immigration Services': ['USCIS'],
    'U.S. Secret Service': ['USSS', 'SECRET SERVICE']
  },
  'Department of Commerce': {
    'National Oceanic and Atmospheric Administration': ['NOAA'],
    'National Telecommunications and Information Administration': ['NTIA']
  },
  'Department of the Interior': {
    'National Park Service': ['NPS'],
    'Fish and Wildlife Service': ['FWS', 'FISH AND WILDLIFE'],
    'Bureau of Ocean Energy Management': ['BOEM']
  },
  'Department of the Treasury': {
    'Internal Revenue Service': ['IRS'],
    'U.S. Mint': ['MINT', 'US MINT']
  }
};


function getOfficeFromEmail(email) {
  
  if (!email) {
    return null;
  }

  const emailLower = email.toLowerCase();
  // DOD Mappings
  if (emailLower.includes('army.mil')) return 'DEPT OF THE ARMY';
  if (emailLower.includes('navy.mil') || emailLower.includes('us.navy.mil')) return 'DEPT OF THE NAVY';
  if (emailLower.includes('af.mil') || emailLower.includes('us.af.mil')) return 'DEPT OF THE AIR FORCE';
  if (emailLower.includes('spaceforce.mil')) return 'Space Force';
  if (emailLower.includes('dla.mil')) return 'DEFENSE LOGISTICS AGENCY';
 
  // HHS Mappings
  if (emailLower.includes('nih.gov')) return 'NATIONAL INSTITUTES OF HEALTH';
  if (emailLower.includes('fda.hhs.gov')) return 'FOOD AND DRUG ADMINISTRATION';
  if (emailLower.includes('ihs.gov')) return 'INDIAN HEALTH SERVICE';
  if (emailLower.includes('cms.hhs.gov')) return 'CENTERS FOR MEDICARE AND MEDICAID SERVICES';
 
  // DHS Mappings
  if (emailLower.includes('fema.dhs.gov')) return 'FEDERAL EMERGENCY MANAGEMENT AGENCY';
  if (emailLower.includes('uscis.dhs.gov')) return 'US CITIZENSHIP AND IMMIGRATION SERVICES';
  if (emailLower.includes('usss.dhs.gov')) return 'US SECRET SERVICE';
 
  // Commerce Mappings
  if (emailLower.includes('noaa.gov')) return 'NATIONAL OCEANIC AND ATMOSPHERIC ADMINISTRATION';
  if (emailLower.includes('ntia')) return 'NATIONAL TELECOMMUNICATIONS AND INFORMATION ADMINISTRATION';
 
  // Interior Mappings
  if (emailLower.includes('nps.gov')) return 'NATIONAL PARK SERVICE';
  if (emailLower.includes('fws.gov')) return 'US FISH AND WILDLIFE SERVICE';
  if (emailLower.includes('boem.gov')) return 'BUREAU OF OCEAN ENERGY MANAGEMENT';
 
  // Treasury Mappings
  if (emailLower.includes('irs.gov')) return 'INTERNAL REVENUE SERVICE';
  if (emailLower.includes('usmint.treas.gov')) return 'US MINT';


  return null;
 }


function getParentAgencyFromOffice(office) {
  return Object.keys(topLevelAgencyMap).find(agency => 
    topLevelAgencyMap[agency].includes(office)
  ) || null;
}

function grabAgencyFromEmail(email) {
  let agency_abbreviance = email.split('@')[1].split('.')[0]

  var agencyName = translateCASAgencyName(agency_abbreviance)

  if (!agencyName) {
    logger.log("error", 'Agency name not found, update with User Admin Site', {tag:"grabAgencyFromEmail"})
    agencyName = "No Agency Found"; // replace with your default value
  }
  
  return agencyName;
}

/**
 * @typedef {Object} cookie-session
 * @property {function}  destroy
 * @property {function}  get
 */

/**
 * Verifies that a login used a PIV/CAC card.
 * If one was not used, log that and wipe the session so the
 * cas-authentication module won't auto-login the user
 *
 * @param  {cookie-session} session
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

  logger.log("info", "password whitelist is: " + whitelist)

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
  let agency = getParentAgencyFromOffice(office) || cas_data['agency-name'];

  logger.log('info', 'Creating new MAX user', {
    email: cas_data['email-address'],
    agency: agency,
    tag: 'createMAXUser'
  });

  let now = new Date();
  let date = (now.getMonth() + 1) + "-" + now.getDate() + "-" + now.getFullYear();
  let user_data = {
    'firstName': cas_data['first-name'],
    'lastName': cas_data['last-name'], 
    'email': cas_data['email-address'],
    'password': null,
    'agency': agency,
    'position': '',
    'userRole': cas_data['userRole'],
    'isRejected': false,
    'isAccepted': true,
    'tempPassword': null,
    'creationDate': date,
    'maxId': cas_data['maxId']
  };

  return User.create(user_data)
    .then(u => {
      return u.id;
    })
    .catch(e => {
      logger.log("error", 'error in: createMAXUser', {error: e, tag:"createMAXUser"});
    });
}


/**
 * Create or update a User table record from the supplied MAX CAS data
 *
 * @param cas_data
 * @return {Promise} Promise
 */
async function createOrUpdateMAXUser(cas_data) {

  try {
    cas_data.maxId = cas_data['max-id'] || cas_data.maxId

    if (!cas_data.maxId) {
      logger.log('error', "Trying to make a token without a MAX ID", {cas_data: cas_data, tag: 'createOrUpdateMAXUser'})
      return false
    }
    let u = await User.findOne({where: {'maxId': cas_data["maxId"]}})
    if (u) {
      return updateMAXUser(cas_data, u)
    } else {
      return createMAXUser(cas_data)

    }
  } catch (e) {
    logger.log("error", "Error caught in create/update MAX User", {error: e, tag: "create/update MAX User"})
  }
}

async function createOrUpdateLoginGovUser(login_gov_data) {
  try {
    let u = await User.findOne({
      where: {
        [Op.or]: [
          { 'email': login_gov_data.email },
          { 'email': { [Op.in]: login_gov_data.all_emails || [] } }
        ]
      }
    });

    logger.log("info", "User found in DB", {user: u, tag: "createOrUpdateLoginGovUser"})

    if (u) {
      return updateUser(login_gov_data, u)
    } else {
      return createUser(login_gov_data)
    }

  } catch (e) {

    logger.log("error", "Error caught in create/update Login.gov User", {error: e.message, tag: "create/update Login.gov User"})

    return res.status(302)
        .set('Location', encodeURI(config['srtClientUrl'] + '/auth' + '?error=Database Error creating user account. Please contact srt@gsa.gov.')) // send them back with no token
        .send(`<html lang="en"><body>Login Failed</body></html>`)

  }
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

  // Get office and agency based on email
  const office = getOfficeFromEmail(srt_userinfo['email'])
  srt_userinfo['office'] = office
  srt_userinfo['agency'] = getParentAgencyFromOffice(office) || translateCASAgencyName(srt_userinfo['org-agency-name'])
  
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

function getUserInfo(access_token) {
  const userEndPoint = config['login_gov_oidc']['user_endpoint']

  let user = fetch(userEndPoint, {
    method: 'get',
    cache: "no-cache",
    headers: {
      "Authorization": `Bearer ${access_token}`,
    }})
    .then( (userResponse) => {
        let userRsp = userResponse.json().then( (rspJson) => {            
            return rspJson
        })
        return userRsp
      });
  
  return user;
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
    //console.log("debug", "creating a renewal token valid for " + getConfig('renewTokenLife') )

    return res.status(200).send({token: newToken, token_life_in_seconds: ms(getConfig('renewTokenLife'))/1000 })
  },

  grabToken: async function (req, res) {
    let accessToken = null
    let expiresIn = null

    //console.log("OG URL: ", req.originalUrl)
    //console.log("Query", req.query)
    const tokenEndPoint = config['login_gov_oidc']['token_endpoint']

    const client_assertion = () => {
      const payload = {
        iss: config['login_gov_oidc']['client_id'],
        sub: config['login_gov_oidc']['client_id'],
        aud: tokenEndPoint,
        jti: jwtSecret,
        exp: Math.floor(Date.now() / 1000) + (5 * 60) // Current time + 5 minutes
      }

      //console.log("payload ", payload)

      return jwt.sign(payload, privateKey, { algorithm: 'RS256' });
    };

    

    body = {
      client_assertion: client_assertion(),
      client_assertion_type: config['login_gov_oidc']['client_assertion_type'],
      code: req.query.code,
      grant_type: 'authorization_code',
    }

    fetch(tokenEndPoint, {
      method: 'post',
      cache: "no-cache",
      headers: {
        "Content-Type": "application/json",
        // 'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: JSON.stringify(body)
    }).then( (tokenResponse) => {
      //console.log("tokenResponse ", tokenResponse)
      tokenResponse.json().then( (rspJson) => {
        accessToken = rspJson.access_token
        expiresIn = rspJson.expires_in
        idToken = rspJson.id_token
        //console.log("rspJson ", rspJson)
        
        if ( !accessToken ) {
          // didn't get a Login Access Token 
          return res.status(302)
            .set('Location', config['srtClientUrl'] + '/auth') // send them back with no token
            .send(`<html lang="en"><body>Login Failed</body></html>`)
        }

        getUserInfo(accessToken).then( (userInfo) => {
          // console.log("user ", userInfo)
          userInfo.accessToken = accessToken

          if ( !userInfo.sub ) {
            // didn't get a Login.gov UUID 
            return res.status(302)
              .set('Location', config['srtClientUrl'] + '/auth') // send them back with no token
              .send(`<html lang="en"><body>Login Failed</body></html>`)
          }

          createOrUpdateLoginGovUser(userInfo)
            .then( (stored_user) => {
              let srt_userinfo = Object.assign({}, stored_user)
              srt_userinfo.user = stored_user.dataValues
              srt_userinfo.user.sessionEnd = Math.floor ((new Date().getTime() + ms(getConfig('sessionLength')) )/ 1000)
              
              logger.log('info', (srt_userinfo.email || userInfo.email) + ' authenticated with LOGIN.GOV', {cas_userinfo: srt_userinfo, tag: 'Login.gov Auth Token'})
              
              console.log("srt_userinfo: ", srt_userinfo)

              let uri_components = {
                token: jwt.sign({access_token: accessToken, user: srt_userinfo.user, sessionEnd: srt_userinfo.sessionEnd, token_life_in_seconds: getConfig('renewTokenLife')}, common.jwtSecret, { expiresIn: getConfig('renewTokenLife') }), 
                token_life_in_seconds: expiresIn, 
                email: srt_userinfo.email || userInfo.email,
                email_verified: userInfo.email_verified,
                agency: srt_userinfo.agency || null,
                id: srt_userinfo.id,
                userRole: srt_userinfo.userRole,
                firstName: srt_userinfo.firstName || userInfo.given_name,
                lastName: srt_userinfo.lastName || userInfo.family_name,
                loginMethod: "login.gov",
              }
              let location = `${config['srtClientUrl']}/auth?info=${jsonToURI(uri_components)}`
              
              //console.log("Redirecting to: ", location)

              return res.redirect(302, location);
          })
        });


      })
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
  tokenCheck: function (req, res) {

    let token = req.body.token
    //console.log("token sent in tokenCheck:", token)
    try {
      if ( token && jwt.verify(token, common.jwtSecret)) {
        let tokenInfo = jwt.decode(token)
        /** @namespace tokenInfo.user */
        
        //console.log('tokenInfo: ', tokenInfo)
        
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
  casStage2: async function(req, res) {
    if (!req.session?.cas_userinfo?.['max-id'] && !req.session?.cas_userinfo?.maxId) {
      return res.status(302)
        .set('Location', config['srtClientUrl'] + '/auth')
        .send(`<html lang="en"><body>Login Failed</body></html>`);
    }
  
    if (!(verifyPIVUsed(req.session) || userOnPasswordOnlyWhitelist(req.session))) {
      req.session.destroy();
      return res.status(302)
        .set('Location', encodeURI(config['srtClientUrl'] + '/auth?error=<p>PIV or CAC login required.<br> Log out of MAX and return here, then log in using a PIV or CAC.</p>'))
        .send(`<html lang="en"><body>Login Failed</body></html>`);
    }
  
    const email = req.session.cas_userinfo['email-address'];
    const maxId = req.session.cas_userinfo['max-id'];
    
    // Get office and agency based on email
    const office = getOfficeFromEmail(email);
    const agency = getParentAgencyFromOffice(office);
    
    // Update cas_userinfo with office and agency
    req.session.cas_userinfo.office = office;
    req.session.cas_userinfo['agency-name'] = agency;
  
    logger.log('info', `${email} authenticated with MAX CAS ID ${maxId}`, {
      cas_userinfo: req.session.cas_userinfo,
      tag: 'casStage2'
    });
  
    const responseJson = await tokenJsonFromCasInfo(req.session.cas_userinfo, common.jwtSecret);
    const location = `${config['srtClientUrl']}/auth?info=${responseJson}`;
  
    const rollList = roles.map(x => x.name);
    const decoded_user_role = JSON.parse(responseJson).userRole;
  
    if (!rollList.includes(decoded_user_role)) {
      logger.log('info', `${email} does not have a SRT role. Rejecting`, {
        responseJson,
        tag: 'casStage2'
      });
      req.session.destroy();
      return res.status(302)
        .set('Location', encodeURI(config['srtClientUrl'] + '/auth?error=Your MAX account is not associated with an SRT role. Please contact srt@gsa.gov for more information.'))
        .send(`<html lang="en"><body>Login Failed</body></html>`);
    }
  
    return res.status(302)
      .set('Location', location)
      .send(`<html lang="en"><body>Preparing login</body></html>`);
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
  createOrUpdateLoginGovUser: createOrUpdateLoginGovUser,
  userInfoFromReq      : userInfoFromReq,
  isGSAAdmin           : isGSAAdmin,
  passwordOnlyWhitelist: userOnPasswordOnlyWhitelist,
  translateCASAgencyName: translateCASAgencyName,
  getGovernmentEmail: getGovernmentEmail,

  roles : roles,
  roleKeys : roleKeys,

  ADMIN_ROLE : ADMIN_ROLE,
  PROGRAM_MANAGER_ROLE : PROGRAM_MANAGER_ROLE,
  FIVE08_COORDINATOR_ROLE : FIVE08_COORDINATOR_ROLE,
  CO_ROLE : CO_ROLE,
  EXEC_ROLE : EXEC_ROLE,
  getOfficeFromEmail,
  getParentAgencyFromOffice,
  topLevelAgencyMap,
  agencyNameVariations


}
