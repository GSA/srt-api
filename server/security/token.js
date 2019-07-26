// token pass
let jwt = require('jsonwebtoken')
const logger = require('../config/winston')
const {common} = require('../config/config')

module.exports = function () {
  return async function (req, res, next) {
    let failed = true
    let token = '-no token-'

    try {
      if (req.headers.hasOwnProperty('authorization')) {
        token = req.headers['authorization'].split(' ')[1]
        if (token && token !== 'null') {
          jwt.verify(token, common.jwtSecret) // will thrown an error on an invalid token
          failed = false
          next()
        }
      } else {
        failed = true
      }
    } catch (err) {
      // this will be logged in the if (failed) block
      logger.log('error', "error in: token check error 2", { error: err, tag: 'token check error 2' })
    }

    if (failed) {
      logger.log('info', 'failed token check for token ' + token, {tag:'token'})
      return res.status(401).send({
        success: false,
        message: 'Unauthorized'
      })
    }
  }
}
