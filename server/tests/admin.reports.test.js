const app = require('../app')()
const db = require('../models/index')
const mockToken = require('./mocktoken')
const mocks = require('./mocks')

const adminReportRoutes = require('../routes/admin.report.routes')
const authRoutes = require('../routes/auth.routes')
const moment = require('moment')

describe('Tests for admin reports and charts', () => {

  let token = null;

  beforeAll(async () => {
    token = await mockToken()
    expect(token).toBeString()
    expect(token.length).toBeGreaterThan(10)

  })

  afterAll(() => {
      return app.db.sequelize.close()
  })

  test('daily login report', async () => {

    let res = mocks.mockResponse()
    let req = mocks.mockRequest({}, { 'authorization': token })

    let id = 112233
    let email = 'test@test.com'
    await db.sequelize.query(`delete from winston_logs where message like '%authenticated with MAX CAS ID ${id}'`, { type: db.sequelize.QueryTypes.DELETE })

    for (email of ['test@example.com', 'test2@example.com', 'test3@example.com']) {
      await db.sequelize.query(`insert into winston_logs (timestamp, message, meta) values 
                                                           (NOW(), '${email} authenticated with MAX CAS ID ${id}', '{"cas_userinfo":{"email-address": "${email}"}}' )`, { type: db.sequelize.QueryTypes.INSERT })
    }

    await adminReportRoutes.dailyLogin(req, res);
    let dailyLogins = res.send.mock.calls[0][0]

    expect(res.status.mock.calls[0][0]).toBe(200)
    expect(dailyLogins).toBeObject()
    let today = moment().format('MM/DD/YYYY')
    expect(dailyLogins).toContainKey(today)
    expect(dailyLogins[today]).toBeGreaterThan(2)


      for (email of ['test@example.com', 'test2@example.com', 'test3@example.com']) {
        await db.sequelize.query(`insert into winston_logs (timestamp, message, meta) values 
                                                           (NOW(), '${email} authenticated with MAX CAS ID ${id}', '{"cas_userinfo":{"email-address": "${email}"}}' )`, { type: db.sequelize.QueryTypes.INSERT })
      }

    let res2 = mocks.mockResponse()
    let req2 = mocks.mockRequest({}, { 'authorization': token })

    await adminReportRoutes.dailyLogin(req2, res2);
    let dailyLogins2 = res2.send.mock.calls[0][0]

    expect(res2.status.mock.calls[0][0]).toBe(200)
    expect(dailyLogins2).toBeObject()
    expect(dailyLogins2).toContainKey(today)
    expect(dailyLogins2[today]).toBe(dailyLogins[today] + 3)

    await db.sequelize.query(`delete from winston_logs where message like '%authenticated with MAX CAS ID ${id}'`, { type: db.sequelize.QueryTypes.DELETE })

  })

  test('user login report', async () => {

    let res = mocks.mockResponse()
    let req = mocks.mockRequest({}, { 'authorization': token })

    let id = 112233
    let email = 'test@test.com'
    await db.sequelize.query(`delete from winston_logs where message like '%authenticated with MAX CAS ID ${id}'`, { type: db.sequelize.QueryTypes.DELETE })

    for (email of ['test@example.com', 'test2@example.com', 'test3@example.com', 'test@example.com']) {
      await db.sequelize.query(`insert into winston_logs (timestamp, message, meta) values 
                                                           (NOW(), '${email} authenticated with MAX CAS ID ${id}', '{"cas_userinfo":{"email-address": "${email}"}}' )`, { type: db.sequelize.QueryTypes.INSERT })
    }

    await adminReportRoutes.userLogin(req, res);
    let userLogins = res.send.mock.calls[0][0]

    expect(res.status.mock.calls[0][0]).toBe(200)
    expect(userLogins).toBeObject()
    let today = moment().format('MM/DD/YYYY')
    expect(userLogins).toContainKey(today)
    expect(userLogins[today]['test@example.com']).toBe(2)

    await db.sequelize.query(`delete from winston_logs where message like '%authenticated with MAX CAS ID ${id}'`, { type: db.sequelize.QueryTypes.DELETE })

  })


  test('feedback report', async () => {
    
    let res = mocks.mockResponse()
    let req = mocks.mockRequest({}, { 'authorization': token })

    await adminReportRoutes.feedback(req,res)
    let report = res.send.mock.calls[0][0]

    expect(Array.isArray(report)).toBeTruthy()
    expect(report.length).toBeGreaterThan(0)
    expect(report[0]).toContainKey("answer")
    expect(report[0]).toContainKey("solicitation_number")
    expect(report[0]).toContainKey("note")
    expect(report[0]).toContainKey("question")
    expect(report[0]).toContainKey("questionID")

    // look through all the report to see if we have data in at least one row for each important item
    const sample = {answer:null, solicitation_number: null, question: null, questionID: null, title: null}
    for (row of report) {
      sample.answer = row.answer || sample.answer
      sample.solicitation_number = row.solicitation_number || sample.solicitation_number
      sample.question = row.question || sample.question
      sample.questionID = row.questionID || sample.questionID
      sample.title = row.title || sample.title
    }
    expect (sample.answer).not.toBeNull()
    expect (sample.solicitation_number).not.toBeNull()
    expect (sample.question).not.toBeNull()
    expect (sample.questionID).not.toBeNull()
    expect (sample.title).not.toBeNull()


  })


})
