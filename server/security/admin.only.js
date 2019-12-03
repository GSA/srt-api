// token pass
let jwt = require('jsonwebtoken')
const logger = require('../config/winston')
const {common} = require('../config/config')

module.exports = function () {
  return async function (req, res, next) {

    try {
      if (! (req.headers && req.headers['authorization'])) {
        return res.status(401).send({ message: 'No authorization token provided' })
      }

      let token = req.headers['authorization'].split(' ')[1]
      jwt.verify(token, common.jwtSecret) // will thrown an error on an invalid token.
      // noinspection JSUnresolvedVariable
      let currentUser = jwt.decode(token).user
      if (currentUser.userRole !== "Administrator") {
        return res.status(401).send({ message: 'Not authorized' })
      }

      logger.log("info", "Admin check passed", { tag: "admin check", user: currentUser, route: req.originalUrl })
      next()

    } catch (e) {
      // Should never happen since token() should be in the call chain before here.
      logger.log("error", "Possibly an invalid token made it to admin.only?", { tag: "admin check", req: req })
      return res.status(401).send({ message: 'Authorization token invalid' })
    }
  }
}
