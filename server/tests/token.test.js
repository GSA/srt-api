const supertestSession = require('supertest-session')
const {common} = require('../config/config.js')
const env = process.env.NODE_ENV || 'development'
const config = require('./../config/config.js')[env]
const {getConfig} = require('./../config/configuration')
const jwt = require('jsonwebtoken')
const CASAuthentication = require('cas-authentication');
const mockToken = require('./mocktoken')
const mocks = require('./mocks')
let {  userAcceptedCASData, coordinatorCASData } = require('./test.data')
const authRoutes = require('../routes/auth.routes')
// const mocks = require('./mocks')
// noinspection JSUnresolvedVariable
const User = require('../models').User
const ms = require('ms')
const tokenTestFunciton = require('../security/token')()

let token = null
let invalidToken = null


describe('JWT Tests', () => {

  beforeAll(async() => {
    let user1 = Object.assign({}, userAcceptedCASData)
    user1.firstName = 'token-beforeAllUser'
    user1.email = 'crowley+token1@tcg.com'
    token = await mockToken(user1)

    let user2 = Object.assign({}, userAcceptedCASData)
    user2.firstName = 'token-beforeAllUser'
    user2.email = 'crowley+token2@tcg.com'
    invalidToken = await mockToken(user2, 'invalid')
  })

  afterAll(async () => {
    await User.destroy({ where: { firstName: 'token-beforeAllUser' } })
  })


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
     * @type {Session}
     */
    let testSession = supertestSession(app)

    // noinspection JSUnresolvedFunction
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
        expect(decoded.exp).toBeWithin( (now + (ms(common.renewTokenLife)/1000)) - 2, (now + (ms(common.renewTokenLife)/1000)) + 2 )
        expect(decoded.user.sessionStart).toBeWithin( now - 10, now + 10)
        expect(decoded.user.grouplist).toBe(userAcceptedCASData.grouplist)
      })
  })

  test('Valid token required for refresh', async () => {
    let app = require('../app')()
    /**
     * @type {Session}
     */
    let testSession = supertestSession(app)

    // noinspection JSUnresolvedFunction
    return testSession.get('/api/renewToken')
      .set('Authorization', `Bearer ${invalidToken}`)
      .then( (res) => {
        expect(res.statusCode).toBe(401)
        expect(res.body.token).toBeUndefined()
      })
  })

  test('timed out tokens can not be used for refresh', async() => {

    let app = require('../app')()
    /**
     * @type {Session}
     */
    let testSession = supertestSession(app)
    let token = await mockToken(userAcceptedCASData, null, null, 10)  // generate an expired token

    // noinspection JSUnresolvedFunction
    return testSession.get('/api/renewToken')
      .set('Authorization', `Bearer ${token}`)
      .then( (res) => {
        expect(res.statusCode).toBe(401)
        expect(res.body.token).toBeUndefined()
        expect(res.body.msg).toContain("expired")
      })
  })

  test('tokens older then max session length ca not be renewed', async() => {

    // set the date back to be the sessionLength + 10 seconds ago. (ex 30 minutes and 10 seconds ago)
    const realNow = Date.now()
    const realDateNow = Date.now.bind(global.Date);
    // ten seconds more than the timeout ago
    global.Date.now = jest.fn(() => realNow - (common.sessionLength * 1000) - 10000);


    let app = require('../app')()
    /**
     * @type {Session}
     */
    let testSession = supertestSession(app)
    let token = await mockToken(userAcceptedCASData)  // generate an expired token
    global.Date.now = realDateNow; // restore the proper date implementation


    // noinspection JSUnresolvedFunction
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
       * @type {Session}
       */
      let testSession = supertestSession(app)

      // noinspection JSUnresolvedFunction
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

  test('Dynamic agency name mapping', async () => {
    let session = {
      cas_userinfo :{
        "max-id": "Z77",
        "samlauthenticationstatementauthmethod" : getConfig('PIVLoginCheckRegex'),
        "org-agency-name" : "Department of Test",
        "grouplist": "AGY-GSA,EXECUTIVE_BRANCH,AGY-GSA-SRT-ADMINISTRATORS.ROLEMANAGEMENT,MAX-AUTHENTICATION-CUSTOMERS-CAS"
      }
    }
    let res = mocks.mockResponse()
    let req = mocks.mockRequest({}, {}, {}, session)

    await authRoutes.casStage2(req, res);
    expect(res.status).toBeCalledWith(302)
    expect(res.set.mock.calls[0][0]).toBe("Location") // first arg
    let locationRedirect = res.set.mock.calls[0][1] //?
    res.set.mock.calls//?

    let matches = locationRedirect.match('token=({[^}]+})')
    let userTokenData = JSON.parse(matches[1])
    expect(userTokenData.agency).toBe("TEST, DEPARTMENT OF")
    let decoded = jwt.decode(userTokenData.token)
    expect(decoded.user.agency).toBe("TEST, DEPARTMENT OF")

    // test the mapping directly
    let treasury = authRoutes.translateCASAgencyName("Department of Test")
    expect(treasury).toBe("TEST, DEPARTMENT OF")

    // test the env var override
    process.env.AGENCY_LOOKUP = '{"doe" : "Department of Energy", "nat inst health":  "National Institutes of Health"}'
    let energy = authRoutes.translateCASAgencyName("DoE")
    expect(energy).toBe("Department of Energy")
    delete process.env.AGENCY_LOOKUP

    // test the env var override
    process.env.AGENCY_LOOKUP = '{ "department of agriculture" : "AGRICULTURE, DEPARTMENT OF", "department of commerce": "COMMERCE, DEPARTMENT OF", "Department of Education" : "Department of Education", "Department of Health and Human Services" : "HEALTH AND HUMAN SERVICES, DEPARTMENT OF", "Department of Homeland Security": "HOMELAND SECURITY, DEPARTMENT OF", "Department of Housing and Urban Development" : "Department of Housing and Urban Development", "Department of Justice" : "JUSTICE, DEPARTMENT OF", "Department of Labor" : "LABOR, DEPARTMENT OF", "Department of State" : "STATE, DEPARTMENT OF", "Department of the Interior": "INTERIOR, DEPARTMENT OF THE", "Department of the Treasury": "TREASURY, DEPARTMENT OF THE", "Department of Transportation" : "TRANSPORTATION, DEPARTMENT OF", "Environmental Protection Agency" : "ENVIRONMENTAL PROTECTION AGENCY", "Executive Office of the President" : "Executive Office of the President", "International Assistance Programs" : "AGENCY FOR INTERNATIONAL DEVELOPMENT", "National Aeronautics and Space Administration" : "NATIONAL AERONAUTICS AND SPACE ADMINISTRATION", "National Science Foundation" : "National Science Foundation", "Nuclear Regulatory Commission" : "Nuclear Regulatory Commission", "Office of Personnel Management" : "OFFICE OF PERSONNEL MANAGEMENT", "Small Business Administration" : "Small Business Administration", "social security administration" : "SOCIAL SECURITY ADMINISTRATION", "general services administration": "GENERAL SERVICES ADMINISTRATION" }'
    let gsa = authRoutes.translateCASAgencyName("General Services Administration")
    expect(gsa).toBe("GENERAL SERVICES ADMINISTRATION")
    delete process.env.AGENCY_LOOKUP
  })

  test('Users without a SRT role are rejected', async() => {
    let user1 = Object.assign({}, coordinatorCASData)
    user1.firstName = 'token-beforeAllUser'
    user1.email = 'crowley+token3@tcg.com'
    user1.grouplist = user1.grouplist.replace('SRT', 'ATC')
    token = await mockToken(user1)
    let decoded = jwt.decode(token)
    decoded.user.userRole //?

    let res = mocks.mockResponse()
    let req = mocks.mockRequest(null,  {'authorization': `bearer ${token}`})

    await tokenTestFunciton(req, res, ()=>{}) //?
    expect (res.status.mock.calls[0][0]).toBe(401) //?
    expect(res.send.mock.calls[0][0].message).toBe("Account must belong to an SRT role.")

  })

  //
  // test.only ('sample JWT decode', async() => {
  //   let token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjp7ImFkbWluX2dyb3VwbGlzdCI6IkFHWS1HU0EtU1JULTUwOC1DT09SRElOQVRPUixBR1ktR1NBLVNSVC1BRE1JTklTVFJBVE9SUy5ST0xFTUFOQUdFTUVOVCxBR1ktR1NBLVNSVC1DT05UUkFDVElOR09GRklDRVJTLEFHWS1HU0EtU1JULVBST0dSQU0tTUFOQUdFUlMuUk9MRU1BTkFHRU1FTlQsQUdZLUdTQS1TUlQtVVNFUlMiLCJhZ2VuY3ktY29kZSI6IjAyMyIsIm9yZy1hZ2VuY3ktY29kZSI6IjAyMyIsIm1heHNlY3VyaXR5bGV2ZWwiOiJzdGFuZGFyZCwgeDUwOSwgc2VjdXJlUGx1czIsIHNlY3VyZVBsdXMzLCBwaXYiLCJlYXV0aGxvYSI6Imh0dHA6Ly9pZG1hbmFnZW1lbnQuZ292L2ljYW0vMjAwOS8xMi9zYW1sXzIuMF9wcm9maWxlL2Fzc3VyYW5jZWxldmVsMyIsImFnZW5jeS1uYW1lIjoiR2VuZXJhbCBTZXJ2aWNlcyBBZG1pbmlzdHJhdGlvbiIsImdyb3VwbGlzdCI6IkFHWS1HU0EsQUdZLUdTQS1PR1AtRElHSVRBTERBU0hCT0FSRC5BR0VOQ1lBRE1JTixBR1ktR1NBLVNSVC01MDgtQ09PUkRJTkFUT1IsQUdZLUdTQS1TUlQtQURNSU5JU1RSQVRPUlMuUk9MRU1BTkFHRU1FTlQsQUdZLUdTQS1TUlQtQ09OVFJBQ1RJTkdPRkZJQ0VSUyxBR1ktR1NBLVNSVC1QUk9HUkFNLU1BTkFHRVJTLlJPTEVNQU5BR0VNRU5ULEFHWS1HU0EtU1JULVVTRVJTLEJVREdFVC1CRkVMT0ItVEFTS0ZPUkNFLEVYRUNVVElWRV9CUkFOQ0gsTUFYSU5GTyIsInBob25lIjoiMjAyLTUwMS0xMTI2IiwibG9uZ3Rlcm1hdXRoZW50aWNhdGlvbnJlcXVlc3R0b2tlbnVzZWQiOiJmYWxzZSIsInVzZXItY2xhc3NpZmljYXRpb24iOiJGRURFUkFMIiwiaXNmcm9tbmV3bG9naW4iOiJ0cnVlIiwib3JnLXRhZyI6IihHU0EpIiwiYXV0aGVudGljYXRpb25kYXRlIjoiMjAyMC0xMi0xN1QxMTozMzoyNC4zMTEtMDU6MDBbQW1lcmljYS9OZXdfWW9ya10iLCJpdHdlYi1yb2xlIjoibm9faXR3ZWJfcm9sZSIsImJ1cmVhdS1uYW1lIjoiR2VuZXJhbCBTZXJ2aWNlcyBBZG1pbmlzdHJhdGlvbiIsInN1Y2Nlc3NmdWxhdXRoZW50aWNhdGlvbmhhbmRsZXJzIjoiQ2xpZW50QXV0aGVudGljYXRpb25IYW5kbGVyIiwib3JnLWJ1cmVhdS1jb2RlIjoiMDAiLCJuaXN0LTgwMC02My0zLWFhbCI6Imh0dHA6Ly9pZG1hbmFnZW1lbnQuZ292L25zL2Fzc3VyYW5jZS9hYWwvMyIsInVzZXItc3RhdHVzIjoiQSIsIm1heGF1dGhlbnRpY2F0aW9uZ3JvdXBzIjoiQVVUSF9MT0FfUElWLEFVVEhfTE9BXzMsQVVUSF9MT0FfQkFTSUNfVFdPX0ZBQ1RPUixBVVRIX0xPQV9CQVNJQyIsIm1pZGRsZS1uYW1lIjoiVCIsImNyZWRlbnRpYWx0eXBlIjoiQ2xpZW50Q3JlZGVudGlhbCIsInNhbWxhdXRoZW50aWNhdGlvbnN0YXRlbWVudGF1dGhtZXRob2QiOiJ1cm46bWF4OmZpcHMtMjAxLXBpdmNhcmQiLCJvcmctYnVyZWF1LW5hbWUiOiJHZW5lcmFsIFNlcnZpY2VzIEFkbWluaXN0cmF0aW9uIiwiYnVyZWF1LWNvZGUiOiIwMCIsImF1dGhlbnRpY2F0aW9ubWV0aG9kIjoidXJuOm1heDpmaXBzLTIwMS1waXZjYXJkIiwicGl2LWNsaWVudC1jZXJ0IjoiTUlJSG9EQ0NCb2lnQXdJQkFnSUVXejF6TlRBTkJna3Foa2lHOXcwQkFRc0ZBREJ0TVFzd0NRWURWUVFHRXdKVlV6RVFNQTRHQTFVRUNoTUhSVzUwY25WemRERWlNQ0FHQTFVRUN4TVpRMlZ5ZEdsbWFXTmhkR2x2YmlCQmRYUm9iM0pwZEdsbGN6RW9NQ1lHQTFVRUN4TWZSVzUwY25WemRDQk5ZVzVoWjJWa0lGTmxjblpwWTJWeklGTlRVQ0JEUVRBZUZ3MHlNREF4TURneE9UQXpNVGxhRncweU16QXhNRGd4T1RNeE16TmFNSUdJTVFzd0NRWURWUVFHRXdKVlV6RVlNQllHQTFVRUNoTVBWUzVUTGlCSGIzWmxjbTV0Wlc1ME1TZ3dKZ1lEVlFRTEV4OUhaVzVsY21Gc0lGTmxjblpwWTJWeklFRmtiV2x1YVhOMGNtRjBhVzl1TVRVd0ZRWURWUVFERXc1QlVsUklWVklnUWxKVlRsTlBUakFjQmdvSmtpYUprL0lzWkFFQkV3NDBOekF3TVRBd01EQXhORGN5TnpDQ0FTSXdEUVlKS29aSWh2Y05BUUVCQlFBRGdnRVBBRENDQVFvQ2dnRUJBTUpIWkZOQVdIaUtUVGRkM2RUcXlSQm50ZlU5RU41VVhFMUwrdER0U1Z4UWpmOG5XWHpyM3RwSTgwVnBMT3RpN2NNZUpod1V2Q2VqcVhwcDBWM3NuQytEa0h5aXZuZnVaMHI3NVR1Rm5VK29FWkJVejB6eUJIRDdpSTIrYTB1TDJFQU1zVTlUWDRvRStuZ0pHSDJybnZRM1IzQ21NbXI5R2szWTg2RUd3WHJIQzJyQzZidmpQdldVNVlzWlY4VEJSM2NXNWRuU0lGT3JSQk1aeUZHQVZDc2pyek9oeWdGL3RiMnl4WUg0K1E1V3RpL3hFTFYyZktsS1ovQyt1S1BPcjJNWTd1YXRPZWdiY0k1OW5OZ0F2MFJyanM0bU15d0dMVHF3cTN0Y3RLSHdEYUJHTGFqL2NxZnFLby9WWllDMzk1WWpoWnRkNU1YeGk4VHFCSWpnZVMwQ0F3RUFBYU9DQkNvd2dnUW1NQTRHQTFVZER3RUIvd1FFQXdJSGdEQXlCZ05WSFNVRUt6QXBCZ2dyQmdFRkJRY0RBZ1lLS3dZQkJBR0NOeFFDQWdZSEt3WUJCUUlEQkFZSUt3WUJCUVVIQXhVd0Z3WURWUjBnQkJBd0RqQU1CZ3BnaGtnQlpRTUNBUU1OTUJBR0NXQ0dTQUZsQXdZSkFRUURBUUVBTUlJQlhnWUlLd1lCQlFVSEFRRUVnZ0ZRTUlJQlREQkxCZ2dyQmdFRkJRY3dBb1kvYUhSMGNEb3ZMM056Y0hkbFlpNXRZVzVoWjJWa0xtVnVkSEoxYzNRdVkyOXRMMEZKUVM5RFpYSjBjMGx6YzNWbFpGUnZSVTFUVTFOUVEwRXVjRGRqTUlHNEJnZ3JCZ0VGQlFjd0FvYUJxMnhrWVhBNkx5OXpjM0JrYVhJdWJXRnVZV2RsWkM1bGJuUnlkWE4wTG1OdmJTOXZkVDFGYm5SeWRYTjBKVEl3VFdGdVlXZGxaQ1V5TUZObGNuWnBZMlZ6SlRJd1UxTlFKVEl3UTBFc2IzVTlRMlZ5ZEdsbWFXTmhkR2x2YmlVeU1FRjFkR2h2Y21sMGFXVnpMRzg5Ulc1MGNuVnpkQ3hqUFZWVFAyTkJRMlZ5ZEdsbWFXTmhkR1U3WW1sdVlYSjVMR055YjNOelEyVnlkR2xtYVdOaGRHVlFZV2x5TzJKcGJtRnllVEJDQmdnckJnRUZCUWN3QVlZMmFIUjBjRG92TDI5amMzQXViV0Z1WVdkbFpDNWxiblJ5ZFhOMExtTnZiUzlQUTFOUUwwVk5VMU5UVUVOQlVtVnpjRzl1WkdWeU1JR0ZCZ05WSFJFRWZqQjhvQ0lHQ2lzR0FRUUJnamNVQWdPZ0ZBd1NOamc0TkRReU56QTNNRUJIVTBFdVIwOVdvQ2NHQ0dDR1NBRmxBd1lHb0JzRUdkRTRFTmdoRFcyU2NEVWxvV2hhQVFoREFuRWNnVGdRdy9xR0xYVnlianAxZFdsa09qRTJaalZpTmpjNExUUTFNREl0TlRNMFlpMWhaRGxqTFRoa1lqRTJPV0kwTUdKbFpqQ0NBWWtHQTFVZEh3U0NBWUF3Z2dGOE1JSHFvSUhub0lIa2hqUm9kSFJ3T2k4dmMzTndkMlZpTG0xaGJtRm5aV1F1Wlc1MGNuVnpkQzVqYjIwdlExSk1jeTlGVFZOVFUxQkRRVE11WTNKc2hvR3JiR1JoY0RvdkwzTnpjR1JwY2k1dFlXNWhaMlZrTG1WdWRISjFjM1F1WTI5dEwyTnVQVmRwYmtOdmJXSnBibVZrTXl4dmRUMUZiblJ5ZFhOMEpUSXdUV0Z1WVdkbFpDVXlNRk5sY25acFkyVnpKVEl3VTFOUUpUSXdRMEVzYjNVOVEyVnlkR2xtYVdOaGRHbHZiaVV5TUVGMWRHaHZjbWwwYVdWekxHODlSVzUwY25WemRDeGpQVlZUUDJObGNuUnBabWxqWVhSbFVtVjJiMk5oZEdsdmJreHBjM1E3WW1sdVlYSjVNSUdNb0lHSm9JR0dwSUdETUlHQU1Rc3dDUVlEVlFRR0V3SlZVekVRTUE0R0ExVUVDaE1IUlc1MGNuVnpkREVpTUNBR0ExVUVDeE1aUTJWeWRHbG1hV05oZEdsdmJpQkJkWFJvYjNKcGRHbGxjekVvTUNZR0ExVUVDeE1mUlc1MGNuVnpkQ0JOWVc1aFoyVmtJRk5sY25acFkyVnpJRk5UVUNCRFFURVJNQThHQTFVRUF4TUlRMUpNTVRVek56QXdId1lEVlIwakJCZ3dGb0FVNXQwYUJ4ckxhN29ndVpZNWsvZ1UzSmdETnljd0hRWURWUjBPQkJZRUZQNmVyZnUxcTVwOFliUFhmakcvSEtVREpqdGRNQTBHQ1NxR1NJYjNEUUVCQ3dVQUE0SUJBUUFmRnNtTTBIdG1DdjE4OVpCYXJzQnRJd2ZGaWh6QUhZU2pUaFROS2g3S2VVUElPOU8zYzN1b28rU0IzUmprN0wwS214VFMyVlhGckh4dGdVcU9NL2JJdVA0T3E5MUZWMU9Hb29uNk82NktYT3NqeGxHcTVPejJkQk01WjMvdjk3Y25ldDBFZi9hMlYzVUI2MFU4ZmRmc0JUZmUydzhxd1dGc0JOdVMraGE3Si9xbGNkU0RFUXFrVjhRRUlJS3plUkRRcTNyb291WnplUUdEK25iK1V3aStlcmhrdVhEajJjRTFVeVRMOExPSkZxVUp3S3Z5TExaZVFtcVBRU3k1T09ST2V0RUpwQ0s4U3FBL3Y5UjJKTUxobWZLWm1aekJPNDVyVWt5YVk0d0ZSMllhcW9DQXRZdFJGdUQwVHFNSnR3Tm1WSmVpMlZ3SXdEWkRqaGR3dzlYdCIsInVzZXJSb2xlIjoiQWRtaW5pc3RyYXRvciIsIm1heElkIjoiQTAzNjI1MSIsImlkIjo0LCJlbWFpbCI6ImFydGh1ci5icnVuc29uQGdzYS5nb3YiLCJmaXJzdE5hbWUiOiJBcnRodXIiLCJsYXN0TmFtZSI6IkJydW5zb24iLCJhZ2VuY3kiOiJHZW5lcmFsIFNlcnZpY2VzIEFkbWluaXN0cmF0aW9uIiwic2Vzc2lvblN0YXJ0IjoxNjA4MjIyODA2LCJzZXNzaW9uRW5kIjoxNjA4MjY2MDA2fSwiaWF0IjoxNjA4MjIyODA2LCJleHAiOjE2MDgyMjQ2MDZ9.crAye8AuRBsQ_g_F9hIYn2oiGooZet12GremzZGnUiM"
  //
  //   let decoded = jwt.verify(token, "akdj48gndidihh3gi")
  //   user = (decoded.user) ? decoded.user : user; // make sure we got something to prevent crash below
  //
  //
  // })
})
