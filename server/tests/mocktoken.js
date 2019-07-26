// token pass
const authRoutes = require('../routes/auth.routes')
const {common} = require('../config/config')

module.exports = async function (user, secret) {
  if ( ! secret ) {
    secret = common.jwtSecret
  }
  user.position = "mock"
  let token = await authRoutes.tokenJsonFromCasInfo(user, secret)
  let tokenString =  token.valueOf()
  return JSON.parse(tokenString).token
}
