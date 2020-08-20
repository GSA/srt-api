const request = require('supertest')
let app = null // require('../app')();;
const mockToken = require('./mocktoken')
// noinspection JSUnresolvedVariable
const User = require('../models').User
// noinspection JSUnresolvedVariable
const Notice = require('../models').notice
// noinspection JSUnresolvedVariable
const NoticeType = require('../models').notice_type
// noinspection JSUnresolvedVariable
const Op = require('sequelize').Op
// noinspection JSUnresolvedVariable
const Attachment = require('../models').attachment
const env = process.env.NODE_ENV || 'development'
const db = require('../models/index')
let predictionRoutes = require('../routes/prediction.routes')
let randomWords = require('random-words')
const {common, config_keys} = require('../config/config.js')
const timeout = 10000 // set to 10 seconds because some of these tests are slow.
const mocks = require('./mocks')
const configuration = require('../config/configuration')


const { userAcceptedCASData } = require('./test.data')

let myUser = {}
myUser.firstName = 'pred-beforeAllUser'
myUser.email = 'crowley+pred@tcg.com'
myUser.maxId = 'PRT001'
delete myUser.id
let token = {}
let sample_sol_num = ''

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
  beforeAll( async () => {


    jest.setTimeout(10000) // some of these tests are slow
    process.env.MAIL_ENGINE = 'nodemailer-mock'
    app = require('../app')() // don't load the app till the mock is configured

    myUser = Object.assign({}, userAcceptedCASData)
    delete myUser.id
    const user = await  User.create(myUser)
    myUser.id = user.id
    token = await mockToken(myUser, common['jwtSecret'])

    let allowed_types = configuration.getConfig(config_keys.VISIBLE_NOTICE_TYPES).map( (x) => `'${x}'`).join(",")
    let sql = `select solicitation_number
                from notice
                join notice_type on notice.notice_type_id = notice_type.id
                where notice_type.notice_type in (${allowed_types}) and
                      notice_data->>'office' is not null
                order by notice.id desc
                limit 1`
    let rows = await db.sequelize.query(sql, null)
    sample_sol_num = rows[0][0].solicitation_number

  })

  afterAll(() => {
    return User.destroy({ where: { firstName: 'pred-beforeAllUser' } })
      .then(() => {
        return app.db.close();

      })
  })

  test.skip('Test we do not loose history in the notice merges', () => {
    if (env !== 'development') {
      // test depends on history in the database.
      // Should be mocked, but too much work for the return
      // instead, just exit the test if we are in a different environment.
      return
    }

    return predictionRoutes.getPredictions({})
      .then(result => {
        let predictions = result.predictions
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

  test('Empty predictions filter', () => {
    return request(app)
      .post('/api/predictions/filter')
      .set('Authorization', `Bearer ${token}`)
      .send()
      .then((res) => {
        // noinspection JSUnresolvedVariable
        expect(res.statusCode).toBe(200)
        expect(res.body.predictions.length).toBeDefined()
        expect(res.body.predictions[0].noticeType).toBeDefined()
        expect(res.body.predictions[0].url).toContain('http')
        return expect(res.body.predictions[0].title).toBeDefined()
      })
  }, timeout)

  test('Test that all predictions with the same notice number are merged', () => {
    let row_count = 1000
    let filter = {rows: row_count, first:0}
    return request(app)
      .post('/api/predictions/filter')
      .set('Authorization', `Bearer ${token}`)
      .send(filter)
      .then((res) => {
        // noinspection JSUnresolvedVariable
        expect(res.statusCode).toBe(200)
        expect(res.body.predictions.length).toBeDefined()

        expect(res.body.rows).toBeGreaterThan(50)

        // test for no duplicate solNumbers
        let solNumList = {}
        for (let p of res.body.predictions) {
          expect(solNumList[p.solNum]).toBeUndefined()
          solNumList[p.solNum] = true
        }

        return expect(res.body.predictions[0].title).toBeDefined()
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

        expect(res.body.predictions.length).toBeDefined()

        // test for no duplicate solNumbers
        let solNumList = {}
        for (let p of res.body.predictions) {
          expect(solNumList[p.solNum]).toBeUndefined()
          solNumList[p.solNum] = true
        }

        return expect(res.body.predictions[0].title).toBeDefined()
      })
  }, timeout)

  test('Filter predictions to only return a certain office', () => {
    return db.sequelize.query(`select notice_data->>'office' as office from notice where solicitation_number = '${sample_sol_num}' limit 1;`, null)
      .then((rows) => {
        let office = rows[0][0].office

        return request(app)
          .post('/api/predictions/filter')
          .set('Authorization', `Bearer ${token}`)
          .send({ office: office })
          .then((res) => {
            // noinspection JSUnresolvedVariable
            expect(res.statusCode).toBe(200)

            expect(res.body.predictions.length).toBeDefined()
            expect(res.body.predictions[0].title).toBeDefined()

            for (let i = 0; i < res.body.predictions.length; i++) {
              expect(res.body.predictions[i].office).toBe(office)
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

                expect(res.body.predictions.length).toBeDefined()
                expect(res.body.predictions.length).toBe(0)
              })
          })
      })
  }, timeout)

  test('Filter predictions on multiple dimensions', () => {
    // noinspection JSTestFailedLine
    return db.sequelize.query(`select agency from "Predictions" where "solNum" = '${sample_sol_num}'  limit 1;`, null)
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

                expect(res.body.predictions.length).toBeDefined()
                expect(res.body.predictions[0].title).toBeDefined()

                for (let i = 0; i < res.body.predictions.length; i++) {
                  expect(res.body.predictions[i].eitLikelihood.value).toBe('Yes')
                  expect(res.body.predictions[i].agency).toBe(agency)
                }
              })
          })
      })
  }, timeout)

  test('Filter predictions on solicitation number', () => {
    return db.sequelize.query('select solicitation_number from notice join notice_type nt on notice.notice_type_id = nt.id where nt.notice_type = \'Solicitation\' order by notice.id desc limit 1', null)
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

            expect(res.body.predictions.length).toBe(1)
            expect(res.body.predictions[0].title).toBeDefined()
            expect(res.body.predictions[0].solNum).toBe(noticeNum)
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

  test('Test prediction date filters', async () => {
    let rows = await db.sequelize.query('select date from notice order by date desc, agency desc limit 1', null)

    let date = rows[0][0].date
    let year = date.getFullYear()
    let month = date.getMonth() + 1
    let day = date.getDate()
    let dayPlus = day + 2  // account for rounding on the db side might
    let start = `${month}/${day}/${year}`
    let end = `${month}/${dayPlus}/${year}`

    let res = await request(app)
      .post('/api/predictions/filter')
      .set('Authorization', `Bearer ${token}`)
      .send({
        startDate: start,
        endDate: end
      })
    // noinspection JSUnresolvedVariable
    expect(res.statusCode).toBe(200)
    expect(res.body.predictions.length).toBeGreaterThan(1)
    for (let i = 0; i < res.body.predictions.length; i++) {
      res.body.predictions[i].date
      new Date(year, month - 1, dayPlus)
      expect(new Date(res.body.predictions[i].date) > new Date(year, month - 1, day)).toBeTruthy() // don't forget months are 0 indexed!
      expect(new Date(res.body.predictions[i].date) < new Date(year, month - 1, dayPlus)).toBeTruthy()
    }

    res = await request(app)
      .post('/api/predictions/filter')
      .set('Authorization', `Bearer ${token}`)
      .send({ endDate: '1/1/1945' })
    // noinspection JSUnresolvedVariable
    expect(res.statusCode).toBe(200)
    expect(res.body.predictions.length).toBe(0)


  }, timeout)

  test('Test merge prediction function', () => {
    let p1 = Object.assign({}, predictionTemplate,
      {
        solNum: 'pred1',
        date: '2019-01-10T09:02:15.895Z',
        actionDate: '2019-01-01T09:02:15.895Z',
        title: 'incorrect title',
        noticeType: 'N1',
        feedback: [{ answer: 'No', question: 'q1 here', questionID: 1 }, {
          answer: 'No',
          question: 'q2 here',
          questionID: 2
        }],
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
        feedback: [{ answer: 'No', question: 'q3 here', questionID: 3 }, {
          answer: 'No',
          question: 'q4 here',
          questionID: 4
        }],
        noticeType: 'N2',
        contactInfo: { contact: 'aaa', name: 'bbb', position: 'ccc', email: 'ddd@example.com' },
        parseStatus: [{ name: 'n3', status: 's3' }, { name: 'n4', status: 's4' }]
      })
    let p4 = Object.assign({}, predictionTemplate, { solNum: 'noMatch2' })
    let p5 = Object.assign({}, predictionTemplate, { solNum: 'noMatch3' })
    let p6 = Object.assign({}, predictionTemplate, {
      solNum: 'pred6',
      date: '2018-02-02T09:02:15.895Z',
      actionDate: '2019-01-01T09:02:15.895Z',
      contactInfo: { contact: 'alpha', name: 'beta', position: 'gamma', email: 'dddd@example.com' }
    })
    let p7 = Object.assign({}, predictionTemplate, {
      solNum: 'pred6',
      date: '2018-01-01T09:02:15.895Z',
      actionDate: '2019-02-04T09:02:15.895Z',
      contactInfo: { contact: 'ff', name: 'gg', position: 'hh', email: 'ii@example.com' }
    })
    let p8 = Object.assign({}, predictionTemplate, {
      solNum: 'pred8',
      date: '2018-02-02T09:02:15.895Z',
      actionDate: undefined,
      parseStatus: [{ name: 'n1', status: 's1' }, { name: 'n2', status: 's2' }]
    })
    let p9 = Object.assign({}, predictionTemplate, {
      solNum: 'pred8',
      date: '2018-01-01T09:02:15.895Z',
      actionDate: '2019-02-04T09:02:15.895Z',
      parseStatus: [{ name: 'n1', status: 's1' }, { name: 'n2', status: 's2' }]
    })
    let p10 = Object.assign({}, predictionTemplate, {
      solNum: 'pred10',
      date: '2018-02-02T09:02:15.895Z',
      actionDate: '2019-02-04T09:02:15.895Z',
      parseStatus: [{ name: 'n1', status: 's1' }, { name: 'n2', status: 's2' }]
    })
    let p11 = Object.assign({}, predictionTemplate, {
      solNum: 'pred10',
      date: '2018-01-01T09:02:15.895Z',
      actionDate: undefined,
      parseStatus: undefined
    })
    let p12 = Object.assign({}, predictionTemplate, {
      solNum: 'pred8',
      date: '1999-01-01T09:02:15.895Z',
      actionDate: undefined,
      parseStatus: [{ name: 'n1', status: 's1' }, { name: 'n2', status: 's2' }]
    })

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
    for (let key of ['predictions', 'eitLikelihood']) {
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
    return db.sequelize.query(`select notice_id from attachment where attachment_url is not null and attachment_url != '' limit 1`)
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

    notice = { notice_data: {} }
    prediction = predictionRoutes.makeOnePrediction(notice)
    expect(prediction.title).toBe('title not available')

    notice = { notice_data: { subject: 'title here' } }
    prediction = predictionRoutes.makeOnePrediction(notice)
    expect(prediction.title).toBe('title here')
  }, timeout)


  test('prediction pagination ( first /rows )', async () => {

    let event = {
      filters: {},
      first: 55,
      rows: 5,
      globalFilter: null,
      multiSortMeta: undefined,
      sortField: 'id',
      sortOrder: -1
    }

    // get rows 55 to 59
    let res = mocks.mockResponse()
    let req = mocks.mockRequest(event, { 'authorization': `bearer ${token}` })
    await predictionRoutes.predictionFilter(req, res)
    expect(res.status.mock.calls[0][0]).toBe(200);
    let predictions0 = res.send.mock.calls[0][0].predictions
    // expect(predictions0.length).toBe(15);
    let pred59 = predictions0[4]

    // get rows 59 and 60
    event.first = 59
    event.rows = 2
    event.sortOrder = -1
    req = mocks.mockRequest(event, { 'authorization': `bearer ${token}` })
    await predictionRoutes.predictionFilter(req, res)
    expect(res.status.mock.calls[1][0]).toBe(200);
    let predictions1 = res.send.mock.calls[1][0].predictions
    let pred59clone1 = predictions1[0]
    expect(predictions1.length).toBe(2)
    expect(pred59.solNum).toBe(pred59clone1.solNum)

    event.first = 59
    event.rows = 1
    event.sortOrder = -1
    req = mocks.mockRequest(event, { 'authorization': `bearer ${token}` })
    await predictionRoutes.predictionFilter(req, res)
    expect(res.status.mock.calls[2][0]).toBe(200);
    let predictions2 = res.send.mock.calls[2][0].predictions
    let pred59clone2 = predictions2[0]
    expect(predictions2.length).toBe(1)
    expect(pred59clone1.solNum).toBe(pred59clone2.solNum)


    event.sortField = 'reviewRec'
    event.sortOrder = 1
    event.first = 0
    event.rows = 60
    req = mocks.mockRequest(event, { 'authorization': `bearer ${token}` })
    await predictionRoutes.predictionFilter(req, res)
    expect(res.status.mock.calls[3][0]).toBe(200);
    let predictions3 = res.send.mock.calls[3][0].predictions
    let pred59clone3 = predictions3[0]
    expect(predictions3.length).toBe(60)
    // we changed the sort so they should not be equal anymore
    expect(pred59clone2.solNum !== pred59clone3.solNum).toBeTruthy()

    event.sortOrder = -1
    req = mocks.mockRequest(event, { 'authorization': `bearer ${token}` })
    await predictionRoutes.predictionFilter(req, res)
    expect(res.status.mock.calls[4][0]).toBe(200);
    let predictions4 = res.send.mock.calls[4][0].predictions
    let pred59clone4 = predictions4[0]
    expect(predictions4.length).toBe(60)
    // we changed the sort direction so they should not be equal anymore
    expect(pred59clone3.solNum !== pred59clone4.solNum).toBeTruthy()

  })

  function compare (a,b) {
    let sort
    if (typeof (a) === 'string') {
      return a.localeCompare(b)
    }
    if (typeof (a.getTime) === 'function' ) {
      if (a.getTime() === b.getTime()) {
        sort = 0
      } else {
        sort = (a.getTime() < b.getTime()) ? -1 : 1
      }
    } else {
      // noinspection EqualityComparisonWithCoercionJS
      if (a == b) {
        sort = 0
      } else {
        sort = (a < b) ? -1 : 1
      }
    }
    return sort
  }

  test('prediction sorting', async () => {

    /*
    The ways of postgres sorting are mysterious. As long as it
    sorts in some direction, I'll be happy
     */

    let event = {
      filters: {},
      first: 45,
      rows: 10,
      globalFilter: null,
      multiSortMeta: undefined,
      sortField: undefined,
      sortOrder: 0
    }

    expect.extend({
      toBeInOrder(sort, allowed, message) {
        return {
          pass: allowed.includes(sort),
          message: () => message
        }
      }
    })

    for (const field of ['reviewRec', 'date', 'agency', 'noticeType', 'solNum']) {

      event.sortField = field
      event.sortOrder = -1;
      event.first = 0
      event.rows = 10
      let predictions = await getPredictions(event)
      let first = predictions[0][event.sortField]

      event.sortOrder = 1
      predictions = await getPredictions(event);
      let last = predictions[0][event.sortField]
      // noinspection JSUnresolvedFunction
      expect(compare(first,last)).toBeInOrder([-1, 1], `failed to sort ${first} || ${last}`)
    }
  }, 30000)

  async function getPredictions(event){
    let res = mocks.mockResponse()
    let req = mocks.mockRequest(event, { 'authorization': `bearer ${token}` })
    await predictionRoutes.predictionFilter(req, res)
    expect(res.status.mock.calls[0][0]).toBe(200);
    let result = res.send.mock.calls[0][0]
    expect(result.predictions.length).toBe(event.rows);
    return result.predictions;
  }

  test("sol num ordering SQL", async () => {
    let order1 = await predictionRoutes.getPredictions({first: 0, rows: 100, sortField: 'solNum'})

    for (let i = 0; i < 90; i+=22) {
      let order = await predictionRoutes.getPredictions({first:i, rows:100, sortField: 'solNum'})
      expect(order[0]).toBe(order1[i])
    }

    let order2 = await predictionRoutes.getPredictions({first: 252, rows: 100, sortField: 'agency'})

    for (let i = 0; i < 90; i+=29) {
      let order = await predictionRoutes.getPredictions({first:252+i, rows:100, sortField: 'agency'})
      expect(order[0]).toBe(order2[i])
    }
  })

  test("paging no duplicates", async () => {

    for (const field of ['agency', 'date', 'solNum']) {
      let order1 = await predictionRoutes.getPredictions({ first: 0, rows: 50, sortField: field }, mocks.mockAdminUser)
      expect(order1.predictions[0]).toBeTruthy()
      for (let i = 0; i < 50; i += 10) {
        let order = await predictionRoutes.getPredictions({ first: i, rows: 7, sortField: field }, mocks.mockAdminUser)

        // check that first = x is the same as the xth item when starting at 0
        expect(order.predictions[0].solNum).toBe(order1.predictions[i].solNum)

        // check that we different predictions have different titles.
        expect(order1.predictions[0].title).not.toBe(order1.predictions[1].title)

      }
    }

  }, 15000)

  async function globalFilterTest(word){
    const filter = { first: 0, rows: 20000, globalFilter: word }
    let {predictions} = await predictionRoutes.getPredictions(filter, mocks.mockAdminUser)

    let found = false
    for (const p of predictions) {
      found = p.title.toLowerCase().match(word.toLowerCase()) ||
              p.noticeType.toLowerCase().match(word.toLowerCase()) ||
              p.solNum.toLowerCase().match(word.toLowerCase()) ||
              p.office.toLowerCase().match(word.toLowerCase()) ||
              p.reviewRec.toLowerCase().match(word.toLowerCase()) ||
              found
      if (found) {
        break;
      }
    }

    if (! found ) {
      console.log (`didn't find '${word}' in results`)  // allowed output
    }

    expect(found).toBeTruthy()

  }

  test("prediction global filter", async () => {
    // pick a word out of the titles.
    let {predictions} = await predictionRoutes.getPredictions({ first: 33, rows: 200 }, mocks.mockAdminUser)

    const data = [
      {field:'title', regex: /[a-zA-Z]+/},
      {field:'noticeType', regex: /[a-zA-Z]+/},
      {field:'agency', regex: /[a-zA-Z]+/},
      {field:'office', regex: /[a-zA-Z]+/},
      {field:'reviewRec', regex: /[a-zA-Z]+/},
      {field:'solNum', regex: /[0-9]+/}
    ]

    for (const x of data ) {
      let word = null
      for (const p of predictions) {
        word = word || p[x.field].match(x.regex)  // pick out a word from the field
      }
      word = word[0] // grab the first match string
      await globalFilterTest(word)
    }


    for (const x of data ) {
      let word = null
      for (const p of predictions) {
        word = word || p[x.field].match(x.regex)  // pick out a word from the field
      }
      word = word[0].toLowerCase() // grab the first match string

      await globalFilterTest(word)
    }



  }, 30000)

  test("prediction column filter", async () => {

    const data = [
      {field:'noticeType', value: 'Combined Synopsis/Solicitation'},
      {field:'agency', value: 'Department of the Army'},
      // {field:'office'},
      // {field:'reviewRec'},
    ]
    for (const x of data ) {
      let field = x.field
      let word = x.value


      const filter = {
        "first": 0,
        "rows": 150,
        "sortField": "noticeType",
        "sortOrder": -1,
        "filters": { [field]: { "value": word, "matchMode": "equals" } },
        "globalFilter": null
      }
      let {predictions: preds} = await predictionRoutes.getPredictions(filter, mocks.mockAdminUser)

      let allMatch = true
      for (const p of preds) {
        allMatch = p[field] === word
        if ( ! allMatch) {
          break;
        }
      }

      if ( ! allMatch ) {
        console.log (`Found a record that didn't match '${word}' in results for field ${field}`) // allowed output
      }
      expect(allMatch).toBeTrue()
    }
  }, 30000)

  test("Prediction filter call with no results", async () => {
    let predictions_err = await predictionRoutes.getPredictions({ 'agency': 'No Agency Here', first: -1000 }, mocks.mockAdminUser)
    expect(predictions_err.predictions.length).toBe(0)
    expect(predictions_err.first).toBe(0)
    expect(predictions_err.rows).toBe(0)
    expect(predictions_err.totalCount).toBe(0)


    let {predictions} = await predictionRoutes.getPredictions({ 'agency': 'No Agency Here' }, mocks.mockAdminUser)
    expect(predictions.length).toBe(0)
  })


  test("PrimeNG prediction dropdown filter", async () => {

    let {predictions: samples} = await predictionRoutes.getPredictions({ first: 27, rows: 1 }, mocks.mockAdminUser)

    let filter =
      {
        "filters": {
          "noticeType": {
            "matchMode": "equals",
            "value": samples[0].noticeType
          }
        }, "first": 0, "globalFilter": null, "rows": 15, "sortField": "noticeType", "sortOrder": -1
      }

    let {predictions: preds} = await predictionRoutes.getPredictions(filter, mocks.mockAdminUser)


    expect(preds.length).toBeGreaterThan(0)
    for (const p of preds) {
      expect(p.noticeType).toBe(samples[0].noticeType)
    }

  })

  test("Prediction cut off date", async () => {
    // set a default really far in the past
    process.env.minPredictionCutoffDate = "1972-08-01T11:59:53.000Z"

    // grab the oldest prediction
    let {predictions: preds_old, totalCount: totalCount} =
      await predictionRoutes.getPredictions({ rows: 1, sortField: "date", sortOrder: 1 }, mocks.mockAdminUser)
    let oldest = Date.parse(preds_old[0].date)
    expect(totalCount).toBeGreaterThan(50)

    // grab the newest prediction
    let {predictions: preds_new} =
      await predictionRoutes.getPredictions({ rows: 1, sortField: "date", sortOrder: -1 }, mocks.mockAdminUser)
    let newest = Date.parse(preds_new[0].date)

    // pick a date in the middle of the two extremes
    let middle = new Date(0)
    middle.setUTCSeconds( ((oldest + newest) / 2) / 1000 )
    process.env.minPredictionCutoffDate = middle.toISOString() //?

    console.log (process.env.minPredictionCutoffDate)


    // Now that we have a new date cutoff, run the search again....but expect that we get fewer results
    let {predictions: preds_middle, totalCount: middleCount} =
      await predictionRoutes.getPredictions({ rows: 10, sortField: "date", sortOrder: 1 }, mocks.mockAdminUser)

    expect(middleCount).toBeLessThan(totalCount)

    for (const p of preds_middle) {
      expect(p.date.getTime()).toBeGreaterThan(middle.getTime())
    }
  })

  test("User can't override the prediction cut off date", async () => {
    // grab the oldest prediction
    let {predictions: preds} =
      await predictionRoutes.getPredictions({ rows: 1, sortField: "date", sortOrder: 1 }, mocks.mockAdminUser)
    let pred = Date.parse(preds[0].date)

    // try to set the start date far in the past
    let {predictions: preds_older} =
      await predictionRoutes.getPredictions({ rows: 1, "startDate": "1972-01-01T00:00:00.000Z", sortField: "date", sortOrder: 1 }, mocks.mockAdminUser)
    let oldest = Date.parse(preds_older[0].date)

    // we shouldn't be able to get anything older than the un-filtered results just
    // by asking so the dates should be the same

    expect(pred).toBe(oldest)

  })

  test("Regular users only see their own agency predictions", async () => {

    let {totalCount} = await predictionRoutes.getPredictions({}, mocks.mockAdminUser)
    expect(totalCount).toBeGreaterThan(1)

    let {totalCount: dodCount} = await predictionRoutes.getPredictions({}, mocks.mockDoDUser)
    expect(dodCount).toBeGreaterThan(1)
    expect(dodCount).toBeLessThan(totalCount)

  })

})
