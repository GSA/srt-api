const app = require('../app')()
const db = require('../models/index')
const mockToken = require('./mocktoken')
const mocks = require('./mocks')

const adminReportRoutes = require('../routes/admin.report.routes')
const authRoutes = require('../routes/auth.routes')

describe('Tests for admin reports and charts', () => {

  beforeAll(async () => {

  })

  afterAll(() => {
      return app.db.sequelize.close()
  })

  test('daily login report', async () => {

    let token = await mockToken()
    expect(token).toBeString()
    expect(token.length).toBeGreaterThan(10)

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
    let today = new Date().toLocaleDateString()
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

    let token = await mockToken()
    expect(token).toBeString()
    expect(token.length).toBeGreaterThan(10)

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
    let today = new Date().toLocaleDateString()
    expect(userLogins).toContainKey(today)
    expect(userLogins[today]['test@example.com']).toBe(2)

    await db.sequelize.query(`delete from winston_logs where message like '%authenticated with MAX CAS ID ${id}'`, { type: db.sequelize.QueryTypes.DELETE })

  })


})
