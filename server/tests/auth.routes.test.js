const request = require('supertest')
const CASAuthentication = require('cas-authentication');
let app = null
const supertestSession = require('supertest-session')
const mockToken = require('./mocktoken')
const env = process.env.NODE_ENV || 'development'
const config = require('./../config/config.js')[env]
const {common} = require('./../config/config.js')
// noinspection JSUnresolvedVariable
const User = require('../models').User
const authRoutes = require('../routes/auth.routes')
const logger = require('../config/winston')
const mocks = require('./mocks')

const { userAcceptedCASData } = require('./test.data')

let myUser = Object.assign({}, userAcceptedCASData)
myUser.firstName = 'auth-beforeAllUser'
myUser.email = 'crowley+auth@tcg.com'
let token = {}
let targetEmail = 'abc883@example.com'

describe('/api/auth/', () => {
  beforeAll(async () => {

    let casConfig = config['maxCas']
    casConfig.dev_mode_info = common['casDevModeData']
    casConfig.is_dev_mode = true
    casConfig.dev_mode_user = "dev_user"
    let cas = new CASAuthentication(casConfig)

    app = require('../app')(null, cas)
    token = await mockToken(myUser, common['jwtSecret'])
  })

  afterAll(async () => {
    await User.destroy({ where: { firstName: 'auth-beforeAllUser' } })
    await User.destroy({ where: {lastName : "AuthTestUser"}})
  })

  test('/api/auth/tokenCheck', async () => {
    let user = Object.assign({}, myUser, { email: 'another2@example.com' })
    user.grouplist = authRoutes.roles[authRoutes.ADMIN_ROLE].casGroup
    user.agency = 'General Services Administration'
    user.firstName = 'auth-beforeAllUser'
    delete user.id
    let token = await mockToken(user, common['jwtSecret'])
    return User.create(user)
      .then(() => {
        return request(app)
          .post('/api/auth/tokenCheck')
          .send({ token: token })
          .then((res) => {
            // noinspection JSUnresolvedVariable
            expect(res.statusCode).toBe(200)
            expect(res.body.isLogin).toBe(true)
            expect(res.body.isGSAAdmin).toBe(true)
          })
      })
    // Make a real token for a non-existing user. It should fail
      .then(async () => {
        let user = Object.assign({}, myUser)
        user.userRole = 'Public'
        user.email = 'notreal@example.com'
        let token = await mockToken(user, common['jwtSecret'])
        return request(app)
          .post('/api/auth/tokenCheck')
          .send({ token: token })
          .then((res) => {
            // noinspection JSUnresolvedVariable
            expect(res.statusCode).toBe(200)
            expect(res.body.isLogin).toBe(false)
            expect(res.body.isGSAAdmin).toBe(false)
          })
      })
    // send a real admin token , but not GSA
      .then(async () => {
        let user = Object.assign({}, myUser)
        user.userRole = 'Public'
        user.agency = 'National Institutes of Health'
        user.email = 'notreal2@example.com'
        user.firstName = 'auth-beforeAllUser'
        delete user.id
        let token = await mockToken(user, common['jwtSecret'])
        return User.create(user)
          .then(() => {
            return request(app)
              .post('/api/auth/tokenCheck')
              .send({ token: token })
              .then((res) => {
                // noinspection JSUnresolvedVariable
                expect(res.statusCode).toBe(200)
                expect(res.body.isLogin).toBe(true)
                expect(res.body.isGSAAdmin).toBe(false) // can't be an admin if you aren't GSA!
              })
          })
      })
      .catch((e) => {
        logger.log('error', 'error in: token check test}', { error:e, tag: 'token check test}' })
      })
    // send a real admin token
      .then(async () => {
        let userCASData = Object.assign({}, myUser, { "email-address": 'crowley+auth-token@tcg.com' })
        userCASData.grouplist = authRoutes.roles[authRoutes.ADMIN_ROLE].casGroup
        userCASData['org-agency-name'] = 'General Services Administration'
        userCASData['first-name'] = 'auth-beforeAllUser'
        userCASData['grouplist'] = authRoutes.roles[authRoutes.roleKeys.PROGRAM_MANAGER_ROLE].casGroup
        delete userCASData.id
        let token = await mockToken(userCASData, common['jwtSecret'])
        return request(app)
          .post('/api/auth/tokenCheck')
          .send({ token: token })
          .then((res) => {
            // noinspection JSUnresolvedVariable
            expect(res.statusCode).toBe(200)
            expect(res.body.isLogin).toBe(true)
            expect(res.body.isGSAAdmin).toBe(true)
          })
      })
    // send a fake token
      .then(() => {
        return request(app)
          .post('/api/auth/tokenCheck')
          .send({ token: 'token fake' })
          .then((res) => {
            // noinspection JSUnresolvedVariable
            expect(res.statusCode).toBe(200)
            expect(res.body.isLogin).toBe(false)
            expect(res.body.isGSAAdmin).toBe(false)
          })
      })
    // send NO token
      .then(() => {
        return request(app)
          .post('/api/auth/tokenCheck')
          .send({ no_token: 'token fake' })
          .then((res) => {
            // legacy app expects a 200 response here!
            // expect(res.statusCode).toBe(400);
            // noinspection JSUnresolvedVariable
            expect(res.statusCode).toBe(200)
            expect(res.body.isLogin).toBe(false)
            expect(res.body.isGSAAdmin).toBe(false)
          })
      })
  })


  // Test what happens when we send an invalid or null JWT
  test('bad token', () => {
    return request(app)
      .post('/api/predictions/filter')
      .set('Authorization', `Bearer null`)
      .send()
      .then((res) => {
        // noinspection JSUnresolvedVariable
        return expect(res.statusCode).toBe(401)
      })
  })

  test('cas login', () => {
    let casConfig = config['maxCas']
    casConfig.dev_mode_info = common['casDevModeData']
    casConfig.is_dev_mode = true
    casConfig.dev_mode_user = "dev_user"
    let cas = new CASAuthentication(casConfig)
    let app3 = require('../app')(null, cas)
    /**
     * @type {express-session}
     */
    let testSession = supertestSession(app3)

    return testSession.get('/api/casLogin')
      .then( (res) => {
        let redirectUrl = res.get('Location')
        expect(res.status).toBe(302)
        expect(redirectUrl).toMatch(config['srtClientUrl'])
        let token = redirectUrl.substr( redirectUrl.indexOf('{') )
        let json = JSON.parse(token)
        expect(json.maxId).toBe('A1234567')
      })
  })

  let casUserInfo = {
    first: 'Al',
    last: 'Crowley',
    'max-id' : 'A11223344'
  }

  test( 'accept cas user token', async () => {

    const token = await mockToken(casUserInfo, common['jwtSecret'])

    return request(app)
      .post('/api/auth/tokenCheck')
      .send({'token' : token})
      .then( (res) => {
        expect(res.status).toBe(200)
        expect(res.body.isGSAAdmin).toBeFalsy()
        expect(res.body.isLogin).toBeTruthy()
      })

  })

  test( 'reject bad token', async () => {
    const badToken = await mockToken(casUserInfo, 'not-secret')

    return request(app)
      .post('/api/auth/tokenCheck')
      .send({'token' : badToken})
      .then( (res) => {
        expect(res.status).toBe(200) // quirky but kept for client compatibility
        expect(res.body.isGSAAdmin).toBeFalsy()
        expect(res.body.isLogin).toBeFalsy()
      })

  })

  test( 'catch fake admin', async () => {
    let fakeAdmin = {
        first: 'Al',
        last: 'Crowley',
        'max-id' : 'A11223344',
        'grouplist' : authRoutes.roles[authRoutes.ADMIN_ROLE].casGroup
    }
    const token = await mockToken(fakeAdmin, common['jwtSecret'])

    return request(app)
      .post('/api/auth/tokenCheck')
      .send({'token' : token})
      .then( (res) => {
        expect(res.status).toBe(200) // quirky but kept for client compatibility
        expect(res.body.isGSAAdmin).toBeFalsy()
        expect(res.body.isLogin).toBeTruthy()
      })

  })

  test( 'check admin token', async () => {
    let adminUser = {
      first: 'Al',
      last: 'Crowley',
      'max-id' : 'A11223344',
      'userRole' : authRoutes.roles[authRoutes.ADMIN_ROLE].casGroup,
      'agency-name' : 'General Services Admin'
    }
    const token = await mockToken(adminUser, common['jwtSecret'])

    return request(app)
      .post('/api/auth/tokenCheck')
      .send({'token' : token})
      .then( (res) => {
        expect(res.status).toBe(200) // quirky but kept for client compatibility
        expect(res.body.isGSAAdmin).toBeFalsy()
        expect(res.body.isLogin).toBeTruthy()
      })

  })


  test( 'fail on bad CAS session', () => {
    const mockReq = {session: { cas_userinfo : { notIDField : false} }}
    const mockRes = {
      status: function (x) {mockRes.statusResult = x; return mockRes; },
      set: function (header, val) {mockRes.hResult = header; mockRes.vResult = val; mockRes.valResult = val; return mockRes},
      send: function (text) {mockRes.textResult = text; return mockRes;}
    }
    return authRoutes.casStage2(mockReq, mockRes).then( () => {
      expect(mockRes.statusResult).toBe(302) // quirky but kept for client compatibility
      expect(mockRes.hResult).toMatch(/Location/)
      expect(mockRes.vResult).toMatch(/auth$/) // should end withOUT a token
    })
  })

  test( 'that PIV login is required', () => {
    process.env.maxCas = '{}'
    const mockReq = {session: { cas_userinfo : common['casDevModeData'], destroy: ()=>true }}
    mockReq.session['cas_userinfo']['samlauthenticationstatementauthmethod'] = 'urn:oasis:names:tc:SAML:1.0:am:password'
    mockReq.session['cas_userinfo']['authenticationmethod'] = 'urn:oasis:names:tc:SAML:1.0:am:password'
    const mockRes = {
      status: function (x) {mockRes.statusResult = x; return mockRes; },
      set: function (header, val) {mockRes.hResult = header; mockRes.vResult = val; mockRes.valResult = val; return mockRes},
      send: function (text) {mockRes.textResult = text; return mockRes;}
    }
    return authRoutes.casStage2(mockReq, mockRes).then( () => {
      expect(mockRes.statusResult).toBe(302) // quirky but kept for client compatibility
      expect(mockRes.hResult).toMatch(/Location/)
      expect(mockRes.vResult).toMatch(/\?error=.*PIV.*login.*required+/)
    })
  })

  test( 'that you can use a password only login if you are on the whitelist', () => {
    // set the password-whitelist to include the expected email
    process.env.maxCas = '{ "password-whitelist": [ "aaron.anderson@example.com", "'+common['casDevModeData']['email-address']+'", "beth_barns@example.com", "example.com", "connor.carson", "gambit@gmail.com" ] }'
    const mockReq = {session: { cas_userinfo : common['casDevModeData'], destroy: ()=>true }}
    mockReq.session['cas_userinfo']['samlauthenticationstatementauthmethod'] = 'urn:oasis:names:tc:SAML:1.0:am:password'
    mockReq.session['cas_userinfo']['authenticationmethod'] = 'urn:oasis:names:tc:SAML:1.0:am:password'

    let mockRes =mocks.mockResponse();
    return authRoutes.casStage2(mockReq, mockRes).then( () => {
      expect(mockRes.status.mock.calls[0][0]).toBe(302) // quirky but kept for client compatibility
      expect(mockRes.set.mock.calls[0][0]).toMatch(/Location/)
      expect(mockRes.set.mock.calls[0][1]).toMatch(/token=/) // we will get a token in the redirect if login was successful

    })
  })

  test('CAS login user record creation', () => {
    let targetId = 'A0000002'

    let casConfig = config['maxCas']
    casConfig.dev_mode_info = common['casDevModeData']
    casConfig.dev_mode_info['email-address'] = targetEmail
    casConfig.dev_mode_info['last-name'] = 'AuthTestUser'
    casConfig.dev_mode_info['max-id'] = targetId
    casConfig.is_dev_mode = true
    casConfig.dev_mode_user = "dev_user"
    casConfig.dev_mode_info['authenticationmethod'] = 'urn:max:fips-201-pivcard'
    let cas = new CASAuthentication(casConfig)

    let app2 = require('../app')(null, cas)

    /** @type {express-session} */
    let session = supertestSession(app2)

    return session.get('/api/casLogin')
      .then( (res) => {
        let location = res.get('Location')
        expect(location).toMatch(/token/)


        let token = location.substr( location.indexOf("token=") + 6 )
        let response = JSON.parse(token)
        let id = response.id
        expect(id).toBeGreaterThan(1)
        return User.findOne({ where: {id : id }})
          .then ( u => {
            expect(u).toBeTruthy()
            expect(u.maxId).toBe(targetId)
            expect(u.creationDate).toMatch(/[0-9]+-[0-9]+-[0-9]+/)
          })
      })
  })

  test ('CAS to user role mapping', () => {
    let aName = authRoutes.roles[authRoutes.ADMIN_ROLE].name
    let aCAS = authRoutes.roles[authRoutes.ADMIN_ROLE].casGroup
    let bName = authRoutes.roles[authRoutes.FIVE08_COORDINATOR_ROLE].name
    let bCAS = authRoutes.roles[authRoutes.FIVE08_COORDINATOR_ROLE].casGroup
    let cName = authRoutes.roles[authRoutes.CO_ROLE].name
    let cCAS = authRoutes.roles[authRoutes.CO_ROLE].casGroup
    let dName = authRoutes.roles[authRoutes.EXEC_ROLE].name
    let dCAS = authRoutes.roles[authRoutes.EXEC_ROLE].casGroup
    let eName = authRoutes.roles[authRoutes.PROGRAM_MANAGER_ROLE].name
    let eCAS = authRoutes.roles[authRoutes.PROGRAM_MANAGER_ROLE].casGroup
    expect (authRoutes.mapCASRoleToUserRole(aCAS)).toBe(aName)
    expect (authRoutes.mapCASRoleToUserRole('stuff,other ,more_things,' + bCAS)).toBe(bName)
    expect (authRoutes.mapCASRoleToUserRole(cCAS + ',trailing,groups')).toBe(cName)
    expect (authRoutes.mapCASRoleToUserRole('before,' + dCAS + ',trailing,groups')).toBe(dName)
    expect (authRoutes.mapCASRoleToUserRole('stuff,other ,more_things,' + eCAS + ',more')).toBe(eName)
    expect (authRoutes.mapCASRoleToUserRole('stuff,other ,more_things,' + aCAS + ',more')).toBe(aName)
    expect (authRoutes.mapCASRoleToUserRole('stuff,other ,more_things,' + dCAS + ',more')).toBe(dName)
    expect (authRoutes.mapCASRoleToUserRole('stuff,other ,more_things,')).toBe("")
    expect (authRoutes.mapCASRoleToUserRole(bCAS+',abc,' + aCAS)).toBe(aName)
    expect (authRoutes.mapCASRoleToUserRole(aCAS+',abc,' + bCAS)).toBe(aName)
    expect (authRoutes.mapCASRoleToUserRole(bCAS+',abc,'+cCAS)).toBe(bName)
    expect (authRoutes.mapCASRoleToUserRole(cCAS+',abc,'+bCAS)).toBe(bName)
  })

  test ('CAS group assignment', async () => {
    let targetId = 'A0000003'

    let casConfig = config['maxCas']
    casConfig.dev_mode_info['max-id'] = targetId
    casConfig.is_dev_mode = true
    casConfig.dev_mode_user = "dev_user"

    let mockReq = {session: { cas_userinfo : common.casDevModeData }}
    let mockRes = {
      status: function (x) {mockRes.statusResult = x; return mockRes; },
      set: function (header, val) {mockRes.hResult = header; mockRes.vResult = val; mockRes.valResult = val; return mockRes},
      send: function (text) {mockRes.textResult = text; return mockRes;}
    }
    await authRoutes.casStage2(mockReq, mockRes)
      .then( () => {
        expect(mockRes.statusResult).toBe(302) // quirky but kept for client compatibility
        expect(mockRes.hResult).toMatch(/Location/)
        expect(mockRes.vResult).toMatch(/token=/)
        let token = mockRes.vResult.substr(mockRes.vResult.indexOf("token=") + 6 )
        let tokenObj = JSON.parse(token)
        expect(tokenObj.userRole).toBe(authRoutes.roles[authRoutes.ADMIN_ROLE].name)
      })

    let mockReq2 = {session: { cas_userinfo : Object.assign({}, common.casDevModeData,{"grouplist": authRoutes.roles[authRoutes.FIVE08_COORDINATOR_ROLE].casGroup}) }}
    let mockRes2 =mocks.mockResponse();
    return authRoutes.casStage2(mockReq2, mockRes2)
      .then( () => {
        expect(mockRes2.status).toBeCalledWith(302)
        // the response.set function should be called with args ( 'Location', 'http://.....')
        let location = mockRes2.set.mock.calls[0][1]
        expect(mockRes2.set.mock.calls[0][0]).toMatch(/Location/)
        expect(location).toMatch(/token=/)
        let token = location.substr(location.indexOf("token=") + 6 )
        let tokenObj = JSON.parse(token)
        expect(tokenObj.userRole).toBe(authRoutes.roles[authRoutes.FIVE08_COORDINATOR_ROLE].name)
      })

  })




  test ('CAS update user record ', async () => {
    let maxId = 'A22233382'
    let email = 'testabc@example.com'
    let userData = { 'first-name': 'Test', 'last-name': 'AuthTestUser', 'email-address': email, 'max-id': maxId }

    await authRoutes.createOrUpdateMAXUser(userData)
    return User.findOne({ where: { email: email } })
      .then(async u => {
        expect(u.maxId).toBe(maxId)
        userData['first-name'] = "NewName"
        await authRoutes.createOrUpdateMAXUser(userData)
        return User.findOne({ where: { email: email } })
          .then( updated => {
            expect(updated.firstName).toBe('NewName')
          })
      })
  })

  test('Test the tokenCheck function', async () => {
    // first try with an invalid token
    let req = mocks.mockRequest({token: 'invalid token'})
    let res = mocks.mockResponse()
    return authRoutes.tokenCheck(req, res)
      .then( () => {
        expect(res.status.mock.calls[0][0]).toBe(200)
        let sentData = res.send.mock.calls[0][0]
        expect(sentData.isGSAAdmin).toBe(false)
        expect(sentData.isLogin).toBe(false)

        // now try with a valid token
        req = mocks.mockRequest({token: token})
        res = mocks.mockResponse()
        return authRoutes.tokenCheck(req, res)
          .then( () => {
            expect(res.status.mock.calls[0][0]).toBe(200)
            sentData = res.send.mock.calls[0][0]
            expect(sentData.isGSAAdmin).toBe(true)
            expect(sentData.isLogin).toBe(true)
          })
      })
  })

  test('MAX ID required to create user', async () => {
    let user = Object.assign({}, myUser, { email: 'another3@example.com' })
    user.grouplist = authRoutes.roles[authRoutes.ADMIN_ROLE].casGroup
    user.agency = 'General Services Administration'
    user.firstName = 'auth-beforeAllUser'
    delete user.id
    delete user["max-id"]
    delete user.maxId
    let id = await authRoutes.createOrUpdateMAXUser(user)
    expect(id).toBe(false)

    authRoutes.tokenJsonFromCasInfo(user, "abc")
      .then( jsn => {
        expect(jsn.valueOf()).toBe("{}")
      })

  })


  test('Test the password only whitelist', () => {

    process.env.maxCas = '{}'
    expect(authRoutes.passwordOnlyWhitelist({})).toBeFalse();

    expect(authRoutes.passwordOnlyWhitelist(
      {'cas_userinfo':{'email-address': 'atc@example.com'}})).toBeFalse();


    process.env.maxCas = '{ "password-whitelist": [ "aaron.anderson@example.com", "beth_barns@example.com", "example.com", "connor.carson", "gambit@gmail.com" ] }'

    expect(authRoutes.passwordOnlyWhitelist(
      {'cas_userinfo':{'email-address': 'atc@example.com'}})).toBeFalse();

    expect(authRoutes.passwordOnlyWhitelist(
      {'cas_userinfo':{'email-address': 'gambit@gmail.com'}})).toBeTrue();

    expect(authRoutes.passwordOnlyWhitelist(
      {'cas_userinfo':{'email-address': 'beth_barns@example.com'}})).toBeTrue();

    expect(authRoutes.passwordOnlyWhitelist(
      {'cas_userinfo':{'email-address': 'joe@example.com'}})).toBeFalse();

    expect(authRoutes.passwordOnlyWhitelist(
      {'cas_userinfo':{'email-address': 'connor.carson@gsa.gov'}})).toBeFalse();

    process.env.maxCas = '{ "password-whitelist": "aaron.anderson" }'

    expect(authRoutes.passwordOnlyWhitelist(
      {'cas_userinfo':{'email-address': 'arron.anderson@gsa.gov'}})).toBeFalse();

    expect(authRoutes.passwordOnlyWhitelist(
      {'cas_userinfo':{'email-address': 'arron.smith@gsa.gov'}})).toBeFalse();
  })

  })
