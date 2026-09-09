// Must be set before any require pulls in email.routes, which resolves its
// transport at module load. Setting it in beforeAll is too late: the describe
// bodies have already run and the real nodemailer is cached.
process.env.MAIL_ENGINE = 'nodemailer-mock'

const request = require('supertest')
let appInstance = null // require('../app')();;
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
    const { app, clientPromise } = require('../app');
    appInstance = app(); // don't load the app till the mock is configured

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

  describe('non-production recipient redirect', () => {
    let emailRoutes
    beforeAll(() => { emailRoutes = require('../routes/email.routes') })
    const ORIGINAL = process.env.EMAIL_REDIRECT_TO

    afterEach(() => {
      if (ORIGINAL === undefined) delete process.env.EMAIL_REDIRECT_TO
      else process.env.EMAIL_REDIRECT_TO = ORIGINAL
      nodemailerMock.mock.reset()
    })

    test('sends to the redirect address, not the real recipient', async () => {
      // Staging holds real user records and uses a real relay, so an unredirected
      // test send reaches actual people at other agencies.
      process.env.EMAIL_REDIRECT_TO = 'redirect-target@gsa.gov'
      await emailRoutes.sendMessage({
        to: 'someone.real@agency.gov', subject: 'Hello', html: '<p>body</p>'
      })
      const sent = nodemailerMock.mock.getSentMail()
      expect(sent.length).toBe(1)
      expect(sent[0].to).toBe('redirect-target@gsa.gov')
      // the intended recipient is preserved so a tester can still see who it would have reached
      expect(sent[0].subject).toContain('someone.real@agency.gov')
    })

    test('leaves the recipient alone when no redirect is configured', async () => {
      delete process.env.EMAIL_REDIRECT_TO
      await emailRoutes.sendMessage({
        to: 'someone.real@agency.gov', subject: 'Hello', html: '<p>body</p>'
      })
      const sent = nodemailerMock.mock.getSentMail()
      expect(sent.length).toBe(1)
      expect(sent[0].to).toBe('someone.real@agency.gov')
      expect(sent[0].subject).toBe('Hello')
    })
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
    return request(appInstance)
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
        return request(appInstance)
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
    return request(appInstance)
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
