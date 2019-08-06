// token pass
const authRoutes = require('../routes/auth.routes')
const {common} = require('../config/config')

module.exports = async function (user, secret, expireTime, sessionStart) {
  if ( ! secret ) {
    secret = common.jwtSecret
  }
  user.position = "mock"
  let token = await authRoutes.tokenJsonFromCasInfo(user, secret, expireTime, sessionStart)
  let tokenString =  token.valueOf()
  return JSON.parse(tokenString).token
}
