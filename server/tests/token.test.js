const supertestSession = require('supertest-session')
const {common} = require('../config/config.js')
const env = process.env.NODE_ENV || 'development'
const config = require('./../config/config.js')[env]
const jwt = require('jsonwebtoken')
const CASAuthentication = require('cas-authentication');
const supertest = require('supertest')


describe('JWT Tests', () => {
  test('JWT to use common config', () => {
    function wrongSecret() {
      let token = jwt.sign({ a: 1, b: 2, c: 3 }, common.jwtSecret, { expiresIn: '2h' }) // token is good for 2 hours
      jwt.verify(token, 'innovation')
    }
    function correctSecret() {
      let token = jwt.sign({ a: 1, b: 2, c: 3 }, common.jwtSecret, { expiresIn: '2h' }) // token is good for 2 hours
      jwt.verify(token, common.jwtSecret)
    }
    expect(common['jwtSecret']).toBeDefined()
    expect(wrongSecret).toThrow("invalid signature")
    expect(correctSecret).not.toThrow()
  })

  test('REST API no longer uses innovation as the secret key', () => {

    // returns a function that tests the token
    function wrongSecret(token) {
      return () => {
        jwt.verify(token, 'innovation')
      }
    }

    // returns a function that tests the token
    function correctSecret(token) {
      return () => {
        jwt.verify(token, common.jwtSecret)
      }
    }

    let casConfig = config['maxCas']
      casConfig.dev_mode_info = common['casDevModeData']
      casConfig.is_dev_mode = true
      casConfig.dev_mode_user = "dev_user"
      let cas = new CASAuthentication(casConfig)
      let app = require('../app')(null, cas)
      /**
       * @type {express-session}
       */
      let testSession = supertestSession(app)

      return testSession.get('/api/casLogin')
        .then( (res) => {
          let redirectUrl = res.get('Location')
          let data = redirectUrl.substr( redirectUrl.indexOf('{') )
          let json = JSON.parse(data)
          let token = json.token

          expect(res.status).toBe(302)
          expect(wrongSecret(token)).toThrow("invalid signature")
          return res;
        }).then ( (res) =>{
          let redirectUrl = res.get('Location')
          let data = redirectUrl.substr( redirectUrl.indexOf('{') )
          let json = JSON.parse(data)
          let token = json.token

          expect(res.status).toBe(302)
          expect(correctSecret(token)).not.toThrow()
        })
  })

})
