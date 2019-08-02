const supertestSession = require('supertest-session')
const {common} = require('../config/config.js')
const env = process.env.NODE_ENV || 'development'
const config = require('./../config/config.js')[env]
const jwt = require('jsonwebtoken')
const CASAuthentication = require('cas-authentication');
const supertest = require('supertest')
const mockToken = require('./mocktoken')
let {  userAcceptedCASData } = require('./test.data')
const authRoutes = require('../routes/auth.routes')
const mocks = require('./mocks')



describe('JWT Tests', () => {
  test('JWT to use common config',  () => {
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

  test('refresh token API call', async () => {
    let app = require('../app')()
    /**
     * @type {express-session}
     */
    let testSession = supertestSession(app)
    let token = await mockToken(userAcceptedCASData)

    return testSession.get('/api/renewToken')
      .set('Authorization', `Bearer ${token}`)
      .then( (res) => {
        expect(res.statusCode).toBe(200);
        expect(res.body.token).toBeDefined()
        let newToken = res.body.token
        let decoded = jwt.decode(newToken)
        let now = Math.round((new Date().getTime() / 1000))
        expect(jwt.verify(newToken, common.jwtSecret)).toBeTruthy()

        expect(newToken).toBeDefined();
        expect(decoded.exp).toBeWithin( (now + common.renewTokenLife) - 2, (now + common.renewTokenLife) + 2 )
        expect(decoded.user.sessionStart).toBeWithin( now - 10, now + 10)
        expect(decoded.user.grouplist).toBe(userAcceptedCASData.grouplist)
      })
  })

  test('Valid token required for refresh', async () => {
    let app = require('../app')()
    /**
     * @type {express-session}
     */
    let testSession = supertestSession(app)
    let token = await mockToken(userAcceptedCASData, 'invalid')

    return testSession.get('/api/renewToken')
      .set('Authorization', `Bearer ${token}`)
      .then( (res) => {
        res.body //?
        expect(res.statusCode).toBe(401)
        expect(res.body.token).toBeUndefined()
      })
  })

  test('timed out tokens can not be used for refresh', async() => {

    // set the date back to be the tokenLife + 10 seconds ago. (ex 30 minutes and 10 seconds ago)
    const realNow = Date.now()
    const realDateNow = Date.now.bind(global.Date);
    const dateNowStub = jest.fn(() => realNow - (common.tokenLife * 1000) - 10000); // ten seconds more than the timeout ago
    global.Date.now = dateNowStub;


    let app = require('../app')()
    /**
     * @type {express-session}
     */
    let testSession = supertestSession(app)
    let token = await mockToken(userAcceptedCASData)  // generate an expired token
    global.Date.now = realDateNow; // restore the proper date implementation


    return testSession.get('/api/renewToken')
      .set('Authorization', `Bearer ${token}`)
      .then( (res) => {
        expect(res.statusCode).toBe(401)
        expect(res.body.token).toBeUndefined()
        expect(res.body.success).toBeFalsy()
      })
  })

  // test('max session length is 12 hours', async() => {
  //
  //   // set the date back to be the sessionLength + 10 seconds ago. (ex 30 minutes and 10 seconds ago)
  //   const realNow = Date.now()
  //   const realDateNow = Date.now.bind(global.Date);
  //   let mockTime = realNow - (common.sessionLength * 1000) - 10000 // ten seconds more than the session timeout
  //   let dateNowStub = jest.fn(() => mockTime);
  //   global.Date.now = dateNowStub;
  //   let token = await mockToken(userAcceptedCASData)  // generate an expired token
  //
  //
  //   for (let i = 0; i < 100 ; i++) {
  //     let req = mocks.mockRequest(null, {authorization : `Bearer ${token}` })
  //     let res = mocks.mockResponse()
  //
  //     authRoutes.renewToken(req, res)
  //     expect(res.getStatus()).toBe(200);
  //
  //     mockTime += 15 * 60 * 1000
  //     let dateNowStub = jest.fn(() => mockTime);
  //     global.Date.now = dateNowStub;
  //   }
  //   global.Date.now = realDateNow; // restore the proper date implementation
  //
  //   expect(false).toBeTruthy()
  // })

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
