const supertest = require('supertest')
const request = require('supertest')
const app = require('../app')()
const mockToken = require('./mocktoken')
// noinspection JSUnresolvedVariable
const User = require('../models').User
const logger = require('../config/winston')

const { userAccepted } = require('./test.data')

const userRoutes = require('../routes/user.routes')
let myUser = Object.assign({}, userAccepted)
myUser.firstName = 'auth-beforeAllUser'
myUser.email = 'crowley+auth@tcg.com'
let myUserPass = 'this is the new password'
let token = {}

describe('/api/auth/', () => {
  beforeAll(async () => {
    let tempPass = myUser.password

    await request(app)
      .post('/api/auth')
      .send(myUser)

    return User.findOne({ where: { email: myUser.email } })
      .then(async user => {
        myUser.id = user.id
        token = mockToken(myUser)

        return request(app)
          .post('/api/user/updatePassword')
          .set('Authorization', `Bearer ${token}`)
          .send({ oldpassword: tempPass, password: myUserPass })
          .then((res) => {
            // noinspection JSUnresolvedVariable
            expect(res.statusCode).toBe(200)
          })
      })
  })

  afterAll(() => {
    return User.destroy({ where: { firstName: 'auth-beforeAllUser' } })
  })

  test('/api/auth/tokenCheck', async () => {
    let user = Object.assign({}, myUser, { email: 'another2@example.com' })
    user.userRole = 'Administrator'
    user.agency = 'General Services Administration'
    user.firstName = 'auth-beforeAllUser'
    delete user.id
    let token = mockToken(user)
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
      .then(() => {
        let user = Object.assign({}, myUser)
        user.userRole = 'Public'
        user.email = 'notreal@example.com'
        let token = mockToken(user)
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
      .then(() => {
        let user = Object.assign({}, myUser)
        user.userRole = 'Public'
        user.agency = 'National Institutes of Health'
        user.email = 'notreal2@example.com'
        user.firstName = 'auth-beforeAllUser'
        delete user.id
        let token = mockToken(user)
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
        logger.log('error', e, { tag: 'token check test}' })
      })
    // send a real admin token
      .then(() => {
        let user = Object.assign({}, myUser, { email: 'crowley+auth-token@tcg.com' })
        user.userRole = 'Administrator'
        user.agency = 'General Services Administration'
        user.firstName = 'auth-beforeAllUser'
        delete user.id
        let token = mockToken(user)
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

  test('/api/auth/resetPassword', async () => {
    let user = Object.assign({}, userAccepted)
    user.firstName = 'auth-beforeAllUser'
    user.email = 'crowley+auth3@tcg.com'
    delete user.id
    return User.create(user)
      .then(() => {
        return request(app)
          .post('/api/auth/resetPassword')
          .send({ email: user.email })
          .then((res) => {
            // noinspection JSUnresolvedVariable
            expect(res.statusCode).toBe(200)
            expect(res.body.tempPassword).toBeDefined()
            expect(res.body.message).toContain('password request')

            return User.findOne({ where: { email: user.email } })
              .then((u) => {
                let success = res.body.tempPassword === u.tempPassword
                expect(success).toBe(true)
              })
          })
      })
    // make sure we don't fail on bad email
      .then(() => {
        return request(app)
          .post('/api/auth/resetPassword')
          .send({ email: 'fake@example.com' })
          .then((res) => {
            // noinspection JSUnresolvedVariable
            expect(res.statusCode).toBe(200)
            expect(res.body.message).toContain('password request')
          })
      })
    // make sure we don't fail with no email
      .then(() => {
        return request(app)
          .post('/api/auth/resetPassword')
          .send({})
          .then((res) => {
            // noinspection JSUnresolvedVariable
            expect(res.statusCode).toBe(200)
            expect(res.body.message).toContain('password request')
          })
      })
      .catch(e => {
        logger.error(e)
      })
  })

  test('/api/auth/login', async () => {
    let loginUser = Object.assign({}, myUser)
    loginUser.email = 'crowley+login_user@tcg.com'
    let loginUserPass = 'abcdefghijklmnop'
    loginUser.password = loginUserPass

    delete loginUser.id
    return User.create(loginUser)
      .then(async () => {
        // test no password
        await request(app)
          .post('/api/auth/login')
          .send({ email: loginUser.email })
          .then((res) => {
            // noinspection JSUnresolvedVariable
            return expect(res.statusCode).toBe(401)
          })

        // test no email or password
        await request(app)
          .post('/api/auth/login')
          .send({ other: 'thing' })
          .then((res) => {
            // noinspection JSUnresolvedVariable
            return expect(res.statusCode).toBe(401)
          })

        // test wrong password
        await request(app)
          .post('/api/auth/login')
          .send({ email: loginUser.email, password: 'wrong password' })
          .then((res) => {
            // noinspection JSUnresolvedVariable
            return expect(res.statusCode).toBe(401)
          })

        // test correct password
        return User.findOne({ where: { email: loginUser.email } })
          .then((u) => {
            return userRoutes.performUpdatePassword(u, loginUserPass)
              .then((u) => {
                u.isAccepted = true
                u.isRejected = false
                u.tempPassword = 'will-not-be-used'
                return u.save()
                  .then(() => {
                    return request(app)
                      .post('/api/auth/login')
                      .send({ email: loginUser.email, password: loginUserPass })
                      .then((res) => {
                        // noinspection JSUnresolvedVariable
                        expect(res.statusCode).toBe(200)
                        expect(res.body.token).toBeDefined()
                        expect(res.body.id).toBeDefined()
                        expect(res.body.id).toBeGreaterThan(0)
                        return expect(res.body.firstName).toBe(loginUser.firstName)
                      })
                  })
              })
          })
      })
  })

  test('Test temp password', async () => {
    let loginUser = Object.assign({}, myUser)
    loginUser.email = 'crowley+temp@tcg.com'
    loginUser.firstName = 'auth-beforeAllUser'
    let loginUserTempPass = 'tttttt'
    loginUser.tempPassword = loginUserTempPass
    loginUser.password = 'jdslfjsdalfjasdlkjfsaldk'
    delete loginUser.id
    return User.create(loginUser)
      .then(async () => {
        return request(app)
          .post('/api/auth/login')
          .send({ email: loginUser.email, password: loginUserTempPass })
          .then((res) => {
            // noinspection JSUnresolvedVariable
            expect(res.statusCode).toBe(200)
            expect(res.body.token).toBeDefined()
            expect(res.body.id).toBeDefined()
            expect(res.body.id).toBeGreaterThan(0)
            expect(res.body.email).toBe(loginUser.email)
            return expect(res.body.firstName).toBe(loginUser.firstName)
          })
      })
  })

  test('test register', async () => {
    let u = Object.assign({}, userAccepted)
    u.firstName = 'auth-beforeAllUser'
    u.email = 'notreal3@example.com'

    // now try the actual api router
    await supertest(app)
      .post('/api/auth')
      .send(u)
      .then((response) => {
        // noinspection JSUnresolvedVariable
        return expect(response.statusCode).toBe(201)
      })
      .then(() => {
        return User.findOne({ where: { email: u.email } })
          .then((u) => {
            expect(u.agency).toBe(u.agency)
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
})
