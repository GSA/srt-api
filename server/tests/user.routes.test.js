const request = require('supertest')
let app = null // require('../app')();
const mockToken = require('./mocktoken')
// noinspection JSUnresolvedVariable
const User = require('../models').User
const userRoutes = require('../routes/user.routes')
const {common} = require('../config/config')
const jwt = require('jsonwebtoken')

let {  userAcceptedCASData } = require('./test.data')

describe('User API Routes', () => {
  let acceptedUserId = 0
  let user1Id = 0
  let token = {}

  beforeAll(async () => {
    userAcceptedCASData = Object.assign({}, userAcceptedCASData, { "email-address": 'crowley+accepted-user@tcg.com', firstName: 'beforeAllUser' })
    process.env.MAIL_ENGINE = 'nodemailer-mock'
    app = require('../app')() // don't load the app till the mock is configured

    let filterUser = Object.assign({}, userAcceptedCASData)
    filterUser.firstName = 'beforeAll-filter'
    filterUser.isAccepted = true
    delete filterUser.id
    await mockToken(filterUser)  // make sure the filter user is created in the database

    userAcceptedCASData = Object.assign({}, userAcceptedCASData, { "email-address": 'crowley+accepted-token2@tcg.com', firstName: 'beforeAll-filter' })
    return mockToken(userAcceptedCASData, common['jwtSecret'])
      .then( t => {
        token = t
        let acceptedUserInfo = jwt.decode(token)
        // noinspection JSUnresolvedVariable
        acceptedUserId = acceptedUserInfo.user.id
      })


    //
    // return User.create(filterUser).then(() => {
    //   return User.create(user1)
    //     .then((user) => {
    //       user1Id = user.id
    //       return user.id
    //     })
    //     .then(() => {
    //       userAcceptedCASData = Object.assign({}, userAcceptedCASData, { email: 'crowley+accepted-token2@tcg.com', firstName: 'beforeAll-filter' })
    //       return User.create(userAcceptedCASData)
    //         .then(async (user2) => {
    //           // token belongs to userAcceptedCASData
    //           token = await mockToken(user2, common['jwtSecret'])
    //           acceptedUserId = user2.id
    //         })
    //     })
    //     .then(() => {
    //       return User.create(userRejected)
    //     })
    // })
  })

  afterAll(() => {
    return User.destroy({ where: { firstName: 'beforeAllUser' } })
      .then(async () => {
        await User.destroy({ where: { email: 'crowley+Phineas@tcg.com' } })
        await User.destroy({ where: { email: 'crowley+Phineas2@tcg.com' } })
        await User.destroy({ where: { email: 'crowley+accepted@tcg.com' } })
        await User.destroy({ where: { email: 'crowley+rejected@tcg.com' } })
        await User.destroy({ where: { email: null } })
        return User.destroy({ where: { firstName: 'beforeAll-filter' } })
      })
  })

  test('Who am I', () => {
    let name = userRoutes.whoAmI({})
    expect(name).toBe('anonymous')

    name = userRoutes.whoAmI( {session : {email : 'test@example.com'}} )
    expect(name).toBe('test@example.com')

    name = userRoutes.whoAmI( { headers : { authorization : `Bearer ${token}`}})
    expect(name).toBe('crowley+accepted-token2@tcg.com')

    name = userRoutes.whoAmI( { headers : { authorization : `Bearer ${token}`}, session : {email : 'test@example.com'} })
    expect(name).toBe('test@example.com')

  })

  test('/api/user/update', async () => {
    return request(app)
      .post('/api/user/update')
      .send({ id: user1Id, isAccepted: false, isRejected: false })
      .set('Authorization', `Bearer ${token}`)
      .then((res) => {
        // noinspection JSUnresolvedVariable,JSUnresolvedFunction
        expect(res.statusCode).toBe(200)
      })
  })


  test('/api/user/updatePassword', async () => {
    await request(app)
      .post('/api/user/updatePassword')
      .send({ password: 'newPassword', oldpassword: 'not the old password or temp password' })
      .set('Authorization', `Bearer ${token}`)
      .then((res) => {
        // noinspection JSUnresolvedVariable
        expect(res.statusCode).toBe(200)
      })
  })

  test('test /api/user/getUserInfo', async () => {
    await request(app)
      .get('/api/user/getUserInfo')
      .send({ UserId: acceptedUserId })
      .set('Authorization', `Bearer ${token}`)
      .then((res) => {
        // noinspection JSUnresolvedVariable,JSUnresolvedFunction
        expect(res.statusCode).toBe(200)
        expect(res.body.id).toBe(acceptedUserId)
      })
  })

  test('test filter', async () => {
    return request(app)
      .post('/api/user/filter')
      .send({ isAccepted: true })
      .set('Authorization', `Bearer ${token}`)
      .then((res) => {
        // noinspection JSUnresolvedVariable,JSUnresolvedFunction
        expect(res.statusCode).toBe(200)
        // http status created
        expect(res.body.length).toBeGreaterThan(0, "didn't get any results from the user filter")
      })
  })

  test('authentication required', async () => {
    return request(app)
      .post('/api/user/filter')
      .then((response) => {
        // noinspection JSUnresolvedVariable,JSUnresolvedVariable
        return expect(response.statusCode).toBe(401, 'should have rejected an unauthorized request. Got status code ' + response.statusCode)
      })
  })

  test('test getUserInfo', async () => {
    return User.findAll()
      .then(users => {
        let id = users[0].id
        return request(app)
          .post('/api/user/getUserInfo')
          .set('Authorization', `Bearer ${token}`)
          .send({ UserID: id })
          .then((response) => {
            // noinspection JSUnresolvedVariable
            expect(response.statusCode).toBe(200)
            return expect(response.body.email).toMatch(/[a-zA-Z]+@[a-zA-Z]+\.[a-zA-Z]+/)
          })
      })
  })
})
