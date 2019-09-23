const request = require('supertest')
let app = null // require('../app')();;
const mockToken = require('./mocktoken')
// noinspection JSUnresolvedVariable
const User = require('../models').User
// noinspection JSUnresolvedVariable
const Notice = require('../models').notice
// noinspection JSUnresolvedVariable
const Attachment = require('../models').attachment
const env = process.env.NODE_ENV || 'development'
const db = require('../models/index')
let predictionRoutes = require('../routes/prediction.routes')
let randomWords = require('random-words')
const {common} = require('../config/config.js')
const timeout = 10000 // set to 10 seconds because some of these tests are slow.

const { userAcceptedCASData } = require('./test.data')

let myUser = {}
myUser.firstName = 'pred-beforeAllUser'
myUser.email = 'crowley+pred@tcg.com'
myUser.maxId = 'PRT001'
delete myUser.id
let token = {}

let predictionTemplate = {
  solNum: '1234',
  title: 'sample title',
  url: 'http://www.tcg.com/',
  predictions: {
    value: 'green'
  },
  reviewRec: 'Compliant', // one of "Compliant", "Non-compliant (Action Required)", or "Undetermined"
  date: '2019-01-10T09:02:15.895Z',
  numDocs: 3,
  eitLikelihood: {
    naics: 'naics here', // initial version uses NAICS code to determine
    value: '45'
  },
  agency: 'National Institutes of Health',
  office: 'Office of the Director',

  contactInfo: {
    contact: 'contact str',
    name: 'Joe Smith',
    position: 'Manager',
    email: 'joe@example.com'
  },
  position: 'pos string',
  reviewStatus: 'on time',
  noticeType: 'N type',
  actionStatus: 'ready',
  actionDate: '02/02/2019',
  parseStatus: [{
    name: 'attachment1',
    status: 'successfully parsed' // "??? enumeration, one of 'successfully parsed', 'processing error'  maybe derived f"
  }],
  history: [
    {
      date: '01/01/2018',
      action: 'sending',
      user: 'crowley',
      status: 'submitted'
    },
    {
      date: '02/02/2018',
      action: 'email',
      user: 'gambit',
      status: 'submitted'
    },
    {
      date: '03/03/2018',
      action: 'other',
      user: 'crowley',
      status: 'submitted'
    }
  ],
  feedback: [{
    questionID: '1',
    question: 'Is this a good solicitation?',
    answer: 'Yes'
  }],
  undetermined: true

}

describe('prediction tests', () => {
  beforeAll(() => {
    jest.setTimeout(10000) // some of these tests are slow
    process.env.MAIL_ENGINE = 'nodemailer-mock'
    app = require('../app')() // don't load the app till the mock is configured

    myUser = Object.assign({}, userAcceptedCASData)
    delete myUser.id
    return User.create(myUser)
      .then(async (user) => {
        myUser.id = user.id
        token = await mockToken(myUser, common['jwtSecret'])
        console.log (token)
      })
  })

  afterAll(() => {
    return User.destroy({ where: { firstName: 'pred-beforeAllUser' } })
  })

  test('Test we do not loose history in the notice merges', () => {
    if (env !== 'development') {
      // test depends on history in the database.
      // Should be mocked, but too much work for the return
      // instead, just exit the test if we are in a different environment.
      return
    }

    return predictionRoutes.getPredictions({})
      .then(predictions => {
        let expectedActions = [
          //                    'Solicitation Updated on FBO.gov',
          'sent email to POC',
          'reviewed solicitation action requested summary'
        ]

        for (let targetStatus of expectedActions) {
          let found = targetStatus // set to this string so that any test fail will show it
          for (let i = 0; i < predictions.length && (found !== true); i++) {
            for (let j = 0; j < predictions[i].history.length && (found !== true); j++) {
              if (predictions[i].history[j].action.indexOf(targetStatus) > -1) {
                found = true
              }
            }
          }
          expect(found).toBe(true)
        }

        return expect(
          predictions.map(p => p.history.length)
            .reduce((accum, i) => accum + i)
        ).toBeGreaterThan(1)
      })
  }, timeout)

  test('Empty predictions filter ', () => {
    return request(app)
      .post('/api/predictions/filter')
      .set('Authorization', `Bearer ${token}`)
      .send()
      .then((res) => {
        // noinspection JSUnresolvedVariable
        expect(res.statusCode).toBe(200)

        expect(res.body.length).toBeDefined()
        expect(res.body[0].noticeType).toBeDefined()
        expect(res.body[0].url).toContain('http')
        return expect(res.body[0].title).toBeDefined()
      })
  }, timeout)

  test('Test that all predictions with the same notice number are merged', () => {
    return request(app)
      .post('/api/predictions/filter')
      .set('Authorization', `Bearer ${token}`)
      .send()
      .then((res) => {
        // noinspection JSUnresolvedVariable
        expect(res.statusCode).toBe(200)

        expect(res.body.length).toBeDefined()

        // test for no duplicate solNumbers
        let solNumList = {}
        for (let p of res.body) {
          expect(solNumList[p.solNum]).toBeUndefined()
          solNumList[p.solNum] = true
        }

        return expect(res.body[0].title).toBeDefined()
      })
  }, timeout)

  test('Test that all predictions with the same notice number are merged', () => {
    return request(app)
      .post('/api/predictions/filter')
      .set('Authorization', `Bearer ${token}`)
      .send()
      .then((res) => {
        // noinspection JSUnresolvedVariable
        expect(res.statusCode).toBe(200)

        expect(res.body.length).toBeDefined()

        // test for no duplicate solNumbers
        let solNumList = {}
        for (let p of res.body) {
          expect(solNumList[p.solNum]).toBeUndefined()
          solNumList[p.solNum] = true
        }

        return expect(res.body[0].title).toBeDefined()
      })
  }, timeout)

  test('Test that all predictions with the same notice number are merged', () => {
    return request(app)
      .post('/api/predictions/filter')
      .set('Authorization', `Bearer ${token}`)
      .send()
      .then((res) => {
        // noinspection JSUnresolvedVariable
        expect(res.statusCode).toBe(200)

        expect(res.body.length).toBeDefined()

        // test for no duplicate solNumbers
        let solNumList = {}
        for (let p of res.body) {
          expect(solNumList[p.solNum]).toBeUndefined()
          solNumList[p.solNum] = true
        }

        return expect(res.body[0].title).toBeDefined()
      })
  }, timeout)

  test('Filter predictions to only return a certain office', () => {
    return db.sequelize.query("select notice_data->>'office' as office from notice where notice_data->>'office' is not null order by date desc limit 1;")
      .then((rows) => {
        let office = rows[0][0].office

        return request(app)
          .post('/api/predictions/filter')
          .set('Authorization', `Bearer ${token}`)
          .send({ office: office })
          .then((res) => {
            // noinspection JSUnresolvedVariable
            expect(res.statusCode).toBe(200)

            expect(res.body.length).toBeDefined()
            expect(res.body[0].title).toBeDefined()

            for (let i = 0; i < res.body.length; i++) {
              expect(res.body[i].office).toBe(office)
            }
          })
          .then(() => {
            return request(app)
              .post('/api/predictions/filter')
              .set('Authorization', `Bearer ${token}`)
              .send({ office: 'not a real office' })
              .then((res) => {
                // noinspection JSUnresolvedVariable
                expect(res.statusCode).toBe(200)

                expect(res.body.length).toBeDefined()
                expect(res.body.length).toBe(0)
              })
          })
      })
  }, timeout)

  test('Filter predictions on multiple dimensions', () => {
    return db.sequelize.query('select agency from notice where agency is not null limit 1;')
      .then((rows) => {
        let agency = rows[0][0].agency
        return request(app)
          .post('/api/predictions/filter')
          .set('Authorization', `Bearer ${token}`)
          .send({
            eitLikelihood: 'Yes',
            agency: agency,
            numDocs: 2
          })
          .then((res) => {
            // noinspection JSUnresolvedVariable
            return expect(res.statusCode).toBe(501) // we don't yet support numDocs for the filter
          })
          .then(() => {
            return request(app)
              .post('/api/predictions/filter')
              .set('Authorization', `Bearer ${token}`)
              .send({
                eitLikelihood: 'Yes',
                agency: agency
              })
              .then((res) => {
                // noinspection JSUnresolvedVariable
                expect(res.statusCode).toBe(200)

                expect(res.body.length).toBeDefined()
                expect(res.body[0].title).toBeDefined()

                for (let i = 0; i < res.body.length; i++) {
                  expect(res.body[i].eitLikelihood.value).toBe('Yes')
                  expect(res.body[i].agency).toBe(agency)
                }
              })
          })
      })
  }, timeout)

  test('Filter predictions on solicitation number', () => {
    return db.sequelize.query('select solicitation_number from notice order by id desc limit 1')
      .then((rows) => {
        let noticeNum = rows[0][0].solicitation_number
        expect(noticeNum).toBeDefined()
        return request(app)
          .post('/api/predictions/filter')
          .set('Authorization', `Bearer ${token}`)
          .send({
            solNum: noticeNum
          })
          .then((res) => {
            // noinspection JSUnresolvedVariable
            expect(res.statusCode).toBe(200)

            expect(res.body.length).toBe(1)
            expect(res.body[0].title).toBeDefined()
            expect(res.body[0].solNum).toBe(noticeNum)
          })
      })
  }, timeout)

  test('Test unsupported parameter for Filter predictions', () => {
    return request(app)
      .post('/api/predictions/filter')
      .set('Authorization', `Bearer ${token}`)
      .send({
        reviewStatus: 'yes'
      })
      .then((res) => {
        // noinspection JSUnresolvedVariable
        expect(res.statusCode).toBe(500)
        expect(res.body.message).toMatch('unsupported')
      })
      .then(() => {
        return request(app)
          .post('/api/predictions/filter')
          .set('Authorization', `Bearer ${token}`)
          .send({
            contact: ''
          })
          .then((res) => {
            // if you send an empty unsupported filter, that's not an error.
            // noinspection JSUnresolvedVariable
            expect(res.statusCode).toBe(200)
          })
          .then(() => {
            return request(app)
              .post('/api/predictions/filter')
              .set('Authorization', `Bearer ${token}`)
              .send({
                contact: 'joe'
              })
              .then((res) => {
                // noinspection JSUnresolvedVariable
                expect(res.statusCode).toBe(500)
              })
          })
      })
  }, timeout)

  test('Test prediction date filters', () => {
    return db.sequelize.query('select date from notice order by date desc, agency desc limit 1')
      .then((rows) => {
        let date = rows[0][0].date
        let year = date.getFullYear()
        let month = date.getMonth() + 1
        let day = date.getDate()
        let dayPlus = day + 1
        let start = `${month}/${day}/${year}`
        let end = `${month}/${dayPlus}/${year}`

        return request(app)
          .post('/api/predictions/filter')
          .set('Authorization', `Bearer ${token}`)
          .send({
            startDate: start,
            endDate: end
          })
          .then((res) => {
            // noinspection JSUnresolvedVariable
            expect(res.statusCode).toBe(200)

            expect(res.body.length).toBeGreaterThan(1)
            for (let i = 0; i < res.body.length; i++) {
              expect(new Date(res.body[i].date) > new Date(year, month - 1, day)).toBeTruthy() // don't forget months are 0 indexed!
              expect(new Date(res.body[i].date) < new Date(year, month - 1, dayPlus)).toBeTruthy()
            }
          })
      })
  }, timeout)

  test('Test merge prediction function', () => {
    let p1 = Object.assign({}, predictionTemplate,
      {
        solNum: 'pred1',
        date: '2019-01-10T09:02:15.895Z',
        actionDate: '2019-01-01T09:02:15.895Z',
        title: 'incorrect title',
        noticeType: 'N1',
        feedback: [ { answer: 'No', question: 'q1 here', questionID: 1 }, { answer: 'No', question: 'q2 here', questionID: 2 } ],
        contactInfo: { contact: 'contact str', name: 'Joe Smith', position: 'Manager', email: 'joe@example.com' },
        parseStatus: [{ name: 'n1', status: 's1' }, { name: 'n2', status: 's2' }]
      })
    let p2 = Object.assign({}, predictionTemplate, { solNum: 'noMatch1' })
    let p3 = Object.assign({}, predictionTemplate,
      {
        solNum: 'pred1',
        date: '2019-01-20T09:02:15.895Z',
        actionDate: '2019-02-04T09:02:15.895Z',
        history: [
          {
            date: '04/04/2018',
            action: 'four',
            user: 'phineas',
            status: 'submitted'
          }],
        feedback: [ { answer: 'No', question: 'q3 here', questionID: 3 }, { answer: 'No', question: 'q4 here', questionID: 4 } ],
        noticeType: 'N2',
        contactInfo: { contact: 'aaa', name: 'bbb', position: 'ccc', email: 'ddd@example.com' },
        parseStatus: [{ name: 'n3', status: 's3' }, { name: 'n4', status: 's4' }]
      })
    let p4 = Object.assign({}, predictionTemplate, { solNum: 'noMatch2' })
    let p5 = Object.assign({}, predictionTemplate, { solNum: 'noMatch3' })
    let p6 = Object.assign({}, predictionTemplate, { solNum: 'pred6', date: '2018-02-02T09:02:15.895Z', actionDate: '2019-01-01T09:02:15.895Z', contactInfo: { contact: 'alpha', name: 'beta', position: 'gamma', email: 'dddd@example.com' } })
    let p7 = Object.assign({}, predictionTemplate, { solNum: 'pred6', date: '2018-01-01T09:02:15.895Z', actionDate: '2019-02-04T09:02:15.895Z', contactInfo: { contact: 'ff', name: 'gg', position: 'hh', email: 'ii@example.com' } })
    let p8 = Object.assign({}, predictionTemplate, { solNum: 'pred8', date: '2018-02-02T09:02:15.895Z', actionDate: undefined, parseStatus: [{ name: 'n1', status: 's1' }, { name: 'n2', status: 's2' }] })
    let p9 = Object.assign({}, predictionTemplate, { solNum: 'pred8', date: '2018-01-01T09:02:15.895Z', actionDate: '2019-02-04T09:02:15.895Z', parseStatus: [{ name: 'n1', status: 's1' }, { name: 'n2', status: 's2' }] })
    let p10 = Object.assign({}, predictionTemplate, { solNum: 'pred10', date: '2018-02-02T09:02:15.895Z', actionDate: '2019-02-04T09:02:15.895Z', parseStatus: [{ name: 'n1', status: 's1' }, { name: 'n2', status: 's2' }] })
    let p11 = Object.assign({}, predictionTemplate, { solNum: 'pred10', date: '2018-01-01T09:02:15.895Z', actionDate: undefined, parseStatus: undefined })
    let p12 = Object.assign({}, predictionTemplate, { solNum: 'pred8', date: '1999-01-01T09:02:15.895Z', actionDate: undefined, parseStatus: [{ name: 'n1', status: 's1' }, { name: 'n2', status: 's2' }] })

    // randomize some values to make test data easier to build.
    for (let key of ['title', 'reviewRec', 'agency', 'noticeType', 'office', 'actionStatus']) {
      p6[key] = randomWords()
      p7[key] = randomWords()
    }

    let result = predictionRoutes.mergePredictions([p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12])
    let predictions = {}
    expect(result.length).toBe(7)

    for (let r of result) {
      predictions[r.solNum] = r
    }

    expect(predictions['pred1'].date).toBe('2019-01-20T09:02:15.895Z')
    expect(predictions['pred6'].date).toBe('2018-02-02T09:02:15.895Z')

    // test prediction.history
    expect(predictions['pred1'].history
      .map(history => history.user === 'phineas')
      .reduce((accum, value) => accum || value))
      .toBeTruthy()
    expect(predictions['pred1'].history
      .map(history => history.user === 'crowley')
      .reduce((accum, value) => accum || value))
      .toBeTruthy()

    // test prediction.id
    expect(predictions['pred1'].solNum).toBe('pred1')
    expect(predictions['pred6'].solNum).toBe('pred6')
    expect(predictions['noMatch1'].solNum).toBe('noMatch1')
    expect(predictions['noMatch2'].solNum).toBe('noMatch2')
    expect(predictions['noMatch3'].solNum).toBe('noMatch3')
    // test prediction.title
    // test prediction.reviewRec
    // test prediction.agency
    // test prediction.solNum
    // test prediction.noticeType
    // test prediction.date
    // test prediction.office
    // test prediction.undetermined
    // test prediction.actionStatus
    for (let key of ['title', 'reviewRec', 'agency', 'solNum', 'noticeType', 'date', 'office', 'undetermined', 'actionStatus']) {
      expect(predictions['pred1'][key]).toBeDefined()
      expect(predictions['pred1'][key]).toBe(p3[key])

      expect(predictions['pred6'][key]).toBeDefined()
      expect(predictions['pred6'][key]).toBe(p6[key])

      expect(predictions['noMatch1'][key]).toBe(p2[key])
      expect(predictions['noMatch2'][key]).toBe(p4[key])
      expect(predictions['noMatch3'][key]).toBe(p5[key])
    }
    // test prediction.numDocs
    expect(predictions['pred1'].numDocs).toBe(p1.numDocs + p3.numDocs)
    expect(predictions['pred6'].numDocs).toBe(p6.numDocs + p7.numDocs)
    expect(predictions['noMatch1'].numDocs).toBe(p3.numDocs)

    // test prediction.prediction
    // test prediction.eitLikelihood
    for (let key of [ 'predictions', 'eitLikelihood' ]) {
      expect(predictions['pred1'][key].value).toBe(p3[key].value)
      expect(predictions['pred6'][key].value).toBe(p6[key].value)
    }
    for (let key of ['pred1', 'pred6', 'pred8', 'pred10']) {
      // test prediction.actionDate
      expect(predictions[key].actionDate).toBe('2019-02-04T09:02:15.895Z')
    }

    // test prediction.feedback
    expect(predictions['pred1'].feedback.length).toBe(p1.feedback.length + p3.feedback.length)
    expect(predictions['pred1'].feedback
      .map(f => (f.questionID === 3))
      .reduce((accum, value) => accum || value))
      .toBeTruthy()
    expect(predictions['pred1'].feedback
      .map(f => (f.question === 'q1 here'))
      .reduce((accum, value) => accum || value))
      .toBeTruthy()

    // test prediction.contactInfo
    expect(predictions['pred1'].contactInfo.email).toBe(p3.contactInfo.email)
    expect(predictions['pred6'].contactInfo.email).toBe(p6.contactInfo.email)

    // test prediction.parseStatus
    expect(predictions['pred1'].parseStatus.length).toBe(p1.parseStatus.length + p3.parseStatus.length)
    expect(predictions['pred6'].parseStatus.length).toBe(p6.parseStatus.length + p7.parseStatus.length)
    expect(predictions['pred8'].parseStatus.length).toBe(p8.parseStatus.length + p9.parseStatus.length + p12.parseStatus.length)
    expect(predictions['pred10'].parseStatus.length).toBe(p10.parseStatus.length) // p11.parseStatus is undefined
  }, timeout)

  test('Test attachment association', () => {
    return db.sequelize.query('select notice_id from attachment limit 1')
      .then((rows) => {
        let noticeId = rows[0][0].notice_id
        return Notice.findAll({ include: [{ model: Attachment }], where: { 'id': noticeId } })
          .then(n => {
            let attachment = n[0].attachments[0]
            expect(attachment.attachment_url.length).toBeGreaterThan(4)
          })
      })
  }, timeout)

  test('default solicitation title', () => {
    let notice = {}
    let prediction = predictionRoutes.makeOnePrediction(notice)
    expect(prediction.title).toBe('title not available')

    notice = {notice_data : {} }
    prediction = predictionRoutes.makeOnePrediction(notice)
    expect(prediction.title).toBe('title not available')

    notice = {notice_data : {subject: 'title here'} }
    prediction = predictionRoutes.makeOnePrediction(notice)
    expect(prediction.title).toBe('title here')
  }, timeout)
})
