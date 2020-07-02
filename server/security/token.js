// token pass
let jwt = require('jsonwebtoken')
const logger = require('../config/winston')
const {common} = require('../config/config')
const {roles} = require('../routes/auth.routes')

/*
Check that:
 - there is an authorization header
 - the token is properly signed
 - the user has a SRT role
 */
module.exports = function () {
  return async function (req, res, next) {
    let failed = true
    let token = '-no token-'
    let message = 'Unauthorized'

    try {
      if (req.headers.hasOwnProperty('authorization')) {
        token = req.headers['authorization'].split(' ')[1]
        if (token && token !== 'null') {
          jwt.verify(token, common.jwtSecret) // will thrown an error on an invalid token

          // next check the role
          let decoded = jwt.decode(token)
          let rollList = roles.map( (x) => x.name) //?
          if (decoded.user.userRole && rollList.includes(decoded.user.userRole) ) {
            next()
            return
          } else {
            message = 'Account must belong to an SRT role.'
          }
        }
      }
    } catch (err) {
      // this will be logged in the if (failed) block
      logger.log('error', "error in: token check error 2", { error: err, tag: 'token check error 2' })
    }

    if (failed) {
      logger.log('info', 'failed token check for token, message: ' + message, {tag:'token', token: token})
      return res.status(401).send({
        success: false,
        message: message
      })
    }
  }
}
