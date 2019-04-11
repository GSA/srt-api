const request = require('supertest')
let app = null // require('../app')();
const randomString = require('randomstring')
const bcrypt = require('bcryptjs')
const mockToken = require('./mocktoken')
const nodemailerMock = require('nodemailer-mock')
// noinspection JSUnresolvedVariable
const User = require('../models').User
const path = require('path')
const env = process.env.NODE_ENV || 'development'
const config = require(path.join(__dirname, '/../config/config.json'))[env]

let { user1, userAccepted, userRejected } = require('./test.data')

describe('User API Routes', () => {
  let acceptedUserId = 0
  let user1Id = 0
  let token = {}

  beforeAll(() => {
    userAccepted = Object.assign({}, userAccepted, { email: 'crowley+accepted-user@tcg.com', firstName: 'beforeAllUser' })
    process.env.MAIL_ENGINE = 'nodemailer-mock'
    app = require('../app')() // don't load the app till the mock is configured

    let filterUser = Object.assign({}, userAccepted)
    filterUser.firstName = 'beforeAll-filter'
    filterUser.isAccepted = true
    delete filterUser.id

    return User.create(filterUser).then(() => {
      return User.create(user1)
        .then((user) => {
          user1Id = user.id
          return user.id
        })
        .then(() => {
          userAccepted = Object.assign({}, userAccepted, { email: 'crowley+accepted-token2@tcg.com', firstName: 'beforeAll-filter' })
          return User.create(userAccepted)
            .then((user2) => {
              // token belongs to userAccepted
              token = mockToken(user2)
              acceptedUserId = user2.id
            })
        })
        .then(() => {
          return User.create(userRejected)
        })
    })
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

  test('/api/user/update', async () => {
    return request(app)
      .post('/api/user/update')
      .send({ id: user1Id, isAccepted: false, isRejected: false })
      .set('Authorization', `Bearer ${token}`)
      .then((res) => {
        // noinspection JSUnresolvedVariable,JSUnresolvedFunction
        expect(res.statusCode).toBe(200)

        return User.findByPk(user1Id).then((user) => {
          expect(user.isAccepted).toBeFalsy()
          return expect(user.isRejected).toBeFalsy()
        })
      })
      .then(() => {
        return request(app)
          .post('/api/user/updateUserInfo')
          .send({ id: user1Id, isAccepted: false, isRejected: false })
          .set('Authorization', `Bearer ${token}`)
          .then((res) => {
            // noinspection JSUnresolvedVariable,JSUnresolvedFunction
            expect(res.statusCode).toBe(200)

            return User.findByPk(user1Id).then((user) => {
              expect(user.isAccepted).toBeFalsy()
              return expect(user.isRejected).toBeFalsy()
            })
          })
      })
      .then(() => {
        return request(app)
          .post('/api/user/updateUserInfo')
          .send({ UserID: user1Id, NewEmail: 'crowley+Phineas2@tcg.com' })
          .set('Authorization', `Bearer ${token}`)
          .then((res) => {
            // noinspection JSUnresolvedVariable,JSUnresolvedFunction
            expect(res.statusCode).toBe(200)

            return User.findByPk(user1Id).then((user) => {
              return expect(user.email).toBe('crowley+Phineas2@tcg.com')
            })
          })
      })
  })

  test('/api/user/getCurrentUser', async () => {
    return request(app)
      .post('/api/user/getCurrentUser')
      .send({})
      .set('Authorization', `Bearer ${token}`)
      .then((res) => {
        // noinspection JSUnresolvedVariable,JSUnresolvedFunction
        expect(res.statusCode).toBe(200)

        return expect(res.body.creationDate).toBe(userAccepted.creationDate)
      })
      .then(() => {
        return request(app)
          .post('/api/user/getCurrentUser')
          .send({})
        // .set('Authorization', `Bearer ${token}`)  // no token for this test!
          .then((res) => {
            // noinspection JSUnresolvedVariable
            expect(res.statusCode).toBe(401)
          })
      })
  })

  test('/api/user/updatePassword', async () => {
    let newPassword = randomString.generate()

    // fail to update b/c we didn't use correct temp password
    await request(app)
      .post('/api/user/updatePassword')
      .send({ password: newPassword, oldpassword: 'not the old password or temp password' })
      .set('Authorization', `Bearer ${token}`)
      .then((res) => {
        // noinspection JSUnresolvedVariable
        expect(res.statusCode).toBe(401)
      })

    // update with correct temp password
    nodemailerMock.mock.reset()
    await request(app)
      .post('/api/user/updatePassword')
      .send({ password: newPassword, oldpassword: 'tpass' }) // start out with the temp password
      .set('Authorization', `Bearer ${token}`)
      .then((res) => {
        // noinspection JSUnresolvedVariable,JSUnresolvedFunction
        expect(res.statusCode).toBe(200)

        let sentMail = nodemailerMock.mock.sentMail()
        expect(sentMail.length).toBe(1)
        expect(sentMail[0].to).toBe(userAccepted.email)
        expect(sentMail[0].from).toBe(config.emailFrom)
        return User.findByPk(acceptedUserId)
          .then((user) => {
            expect(bcrypt.compareSync(newPassword, user.password)).toBe(true)
          })
      })

    // temp password shouldn't work any more
    await request(app)
      .post('/api/user/updatePassword')
      .send({ password: newPassword, oldpassword: 'tpass' })
      .set('Authorization', `Bearer ${token}`)
      .then((res) => {
        // noinspection JSUnresolvedVariable
        expect(res.statusCode).toBe(401)
      })

    // update with correct temp password
    let newPassword2 = randomString.generate()
    nodemailerMock.mock.reset()
    return request(app)
      .post('/api/user/updatePassword')
      .send({ password: newPassword2, oldpassword: newPassword })
      .set('Authorization', `Bearer ${token}`)
      .then((res) => {
        // noinspection JSUnresolvedVariable,JSUnresolvedFunction
        expect(res.statusCode).toBe(200)

        let sentMail = nodemailerMock.mock.sentMail()
        expect(sentMail.length).toBe(1)
        expect(sentMail[0].to).toBe(userAccepted.email)
        expect(sentMail[0].from).toBe(config.emailFrom)
        return User.findByPk(acceptedUserId)
          .then((user) => {
            expect(bcrypt.compareSync(newPassword2, user.password)).toBe(true)
          })
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

        let user = res.body
        // logger.error (res.body);
        expect(user.email).toBe(userAccepted.email + '')
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
