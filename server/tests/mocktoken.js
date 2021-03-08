// token pass
const authRoutes = require('../routes/auth.routes')
const {common} = require('../config/config')
const { adminCASData } = require('./test.data')

module.exports = async function (user, secret, expireTime, sessionStart) {
  if ( ! secret ) {
    secret = common.jwtSecret
    if ( (!secret) && (process.env.NODE_ENV === "test" || rocess.env.NODE_ENV === "development")) {
      secret = "abc123"
    }
  }
  if ( ! user ) {
    user = Object.assign({}, adminCASData)
  }

  user.position = "mock"
  let token = await authRoutes.tokenJsonFromCasInfo(user, secret, expireTime, sessionStart)
  let tokenString =  token.valueOf()
  return JSON.parse(tokenString).token
}
