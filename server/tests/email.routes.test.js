const request = require('supertest')
let app = null // require('../app')();;
const nodemailerMock = require('nodemailer-mock')
const mockToken = require('./mocktoken')
// noinspection JSUnresolvedVariable
const User = require('../models').User
const env = process.env.NODE_ENV || 'development'
const config = require('../config/config.js')[env]
const {common} = require('../config/config.js')

const { userAcceptedCASData } = require('./test.data')

let myUser = {}
myUser.firstName = 'email-beforeAllUser'
myUser.email = 'crowley+email@tcg.com'
let token = {}

describe('/api/email', () => {
  beforeAll(() => {
    process.env.MAIL_ENGINE = 'nodemailer-mock'
    app = require('../app')() // don't load the app till the mock is configured

    myUser = Object.assign({}, userAcceptedCASData)
    myUser.firstName = 'email-beforeAllUser'
    delete myUser.id
    return User.create(myUser)
      .then(async (user) => {
        myUser.id = user.id
        token = await mockToken(myUser, common['jwtSecret'])
      })
  })

  afterAll(() => {
    return User.destroy({ where: { firstName: 'email-beforeAllUser' } })
  })

  test('/api/email', () => {
    // text: req.body.text,
    //     from: "Solicitation Review Tool <solicitationreview@gmail.com>",
    //     to: req.body.emailTo,//req.body.email,
    //     cc: req.body.emailCC,
    //     subject: req.body.subject

    let email = {
      text: 'This is the message body text sent by a unit test.',
      emailTo: 'crowley@tcg.com',
      emailCC: 'c@example.com',
      subject: 'srt unit test at ' + (new Date()).toLocaleString()
    }

    nodemailerMock.mock.reset()
    return request(app)
      .post('/api/email')
      .set('Authorization', `Bearer ${token}`)
      .send({ body: 'this is the body text' })
      .then((res) => {
        expect(nodemailerMock.mock.sentMail.length).toBe(0)
        // noinspection JSUnresolvedVariable
        expect(res.statusCode).toBe(400)
      })
      .then(() => {
        nodemailerMock.mock.reset()
        return request(app)
          .post('/api/email')
          .set('Authorization', `Bearer ${token}`)
          .send(email)
          .then((res) => {
            let sentMail = nodemailerMock.mock.sentMail()
            // noinspection JSUnresolvedVariable
            expect(res.statusCode).toBe(200)
            expect(sentMail.length).toBe(1)
            expect(sentMail[0].to).toBe('crowley@tcg.com')
            expect(sentMail[0].from).toBe(config.emailFrom)
          })
      })
  })

  test('HTML test', () => {
    // text: req.body.text,
    //     from: "Solicitation Review Tool <solicitationreview@gmail.com>",
    //     to: req.body.emailTo,//req.body.email,
    //     cc: req.body.emailCC,
    //     subject: req.body.subject

    let email = {
      text: "This is the <b>message body</b> text sent by a unit test. <p class='myClass'>Sincerely, <br> Unit Tests</p>",
      emailTo: 'crowley@tcg.com',
      emailCC: 'c@example.com',
      subject: 'srt unit test at ' + (new Date()).toLocaleString()
    }

    nodemailerMock.mock.reset()
    return request(app)
      .post('/api/email')
      .set('Authorization', `Bearer ${token}`)
      .send(email)
      .then((res) => {
        let sentMail = nodemailerMock.mock.sentMail()
        // noinspection JSUnresolvedVariable
        expect(res.statusCode).toBe(200)
        expect(sentMail.length).toBe(1)
        expect(sentMail[0].to).toBe('crowley@tcg.com')
        expect(sentMail[0].from).toBe(config.emailFrom)
        expect(sentMail[0].html).toMatch('myClass')
      })
  })

})
