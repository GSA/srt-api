let app = null // require('../app')()
const mockToken = require('./mocktoken')
const mocks = require('./mocks')
const db = require('../models/index')
const {common} = require('../config/config.js')
const solicitationRoutes = require('../routes/solicitation.routes')
// noinspection JSUnresolvedVariable
const Notice = require('../models').notice
const { adminCASData, coordinatorCASData } = require('./test.data')

let myUser = {}
myUser.firstName = 'sol-beforeAllUser'
myUser.email = 'crowley+sol@tcg.com'
delete myUser.id
let adminToken = ""
let coordinatorToken = ""

describe('solicitation tests', async () => {
  beforeAll(async () => {
    process.env.MAIL_ENGINE = 'nodemailer-mock'
    app = require('../app')() // don't load the app till the mock is configured

    adminToken = await mockToken(adminCASData, common['jwtSecret'])
    coordinatorToken = await mockToken(coordinatorCASData, common['jwtSecret'])

  })

  afterAll(() => {
    return app.db.close();
  })


  test('Update Not Applicable', async () => {
    let rows = await db.sequelize.query('select solicitation_number from notice order by solicitation_number desc limit 1')
    let solNum = rows[0][0].solicitation_number
    expect(solNum).toBeDefined()
    let solRoute = solicitationRoutes(db)

    // set it to true
    let res = mocks.mockResponse()
    let req = mocks.mockRequest({ solicitation: { solNum: solNum, na_flag: true } }, {'authorization': `bearer ${adminToken}`})
    await solRoute.update(req, res)
    expect(res.status.mock.calls[0][0]).toBe(200)
    let updateTrue = await Notice.findOne({ where: { solicitation_number: solNum } })
    expect(updateTrue.na_flag).toBe(true)

    // now set it to false
    res = mocks.mockResponse()
    req = mocks.mockRequest({ solicitation: { solNum: solNum, na_flag: false } }, {'authorization': `bearer ${adminToken}`})
    await solRoute.update(req, res)
    expect(res.status.mock.calls[0][0]).toBe(200)
    let updateFalse = await Notice.findOne({ where: { solicitation_number: solNum } })
    expect(updateFalse.na_flag).toBe(false)

  })

  test('Update Not Applicable with bad sol num', async () => {
    let res = mocks.mockResponse();
    let req = mocks.mockRequest({ solicitation: { solNum: 'fake number', na_flag: true } }, {'authorization': `bearer ${adminToken}`})
    let solRoute = solicitationRoutes(db)
    await solRoute.update(req, res)
    expect(res.status.mock.calls[0][0]).toBe(404)
  })

  // noinspection DuplicatedCode
  test('GSA Admins can Update Not Applicable for any sol num', async () => {
    let rows = await db.sequelize.query('select solicitation_number from notice order by solicitation_number desc limit 1')
    let solNum = rows[0][0].solicitation_number
    expect(solNum).toBeDefined()

    let res = mocks.mockResponse();
    let req = mocks.mockRequest({ solicitation: { solNum: solNum, na_flag: true } }, {'authorization': `bearer ${adminToken}`})
    let solRoute = solicitationRoutes(db)
    await solRoute.update(req, res)
    expect(res.status.mock.calls[0][0]).toBe(200)
  })

  // noinspection DuplicatedCode
  test('Agency User can update Not Applicable for any solicitations in their agency', async () => {
    let sql = `select solicitation_number from notice where agency = '${coordinatorCASData["org-agency-name"]}' order by solicitation_number desc limit 1`
    let rows = await db.sequelize.query(sql)
    let solNum = rows[0][0].solicitation_number //?
    expect(solNum).toBeDefined()

    let res = mocks.mockResponse();
    let req = mocks.mockRequest({ solicitation: { solNum: solNum, na_flag: true } }, {'authorization': `bearer ${coordinatorToken}`})
    let solRoute = solicitationRoutes(db)
    await solRoute.update(req, res)
    expect(res.status.mock.calls[0][0]).toBe(200)
  })

  // noinspection DuplicatedCode
  test('Agency User can NOT update Not Applicable for any solicitations for another agency', async () => {
    let sql = `select solicitation_number from notice where agency != '${coordinatorCASData["org-agency-name"]}' order by solicitation_number desc limit 1`
    let rows = await db.sequelize.query(sql)
    let solNum = rows[0][0].solicitation_number //?
    expect(solNum).toBeDefined()

    let res = mocks.mockResponse();
    let req = mocks.mockRequest({ solicitation: { solNum: solNum, na_flag: true } }, {'authorization': `bearer ${coordinatorToken}`})
    let solRoute = solicitationRoutes(db)
    await solRoute.update(req, res)
    expect(res.status.mock.calls[0][0]).toBe(401)
  })

  test('Solicitation updates rejected from people without a ticket', async () => {
    let res = mocks.mockResponse();
    let req = mocks.mockRequest({ solicitation: { solNum: '1234', na_flag: true } })
    let solRoute = solicitationRoutes(db)
    await solRoute.update(req, res)
    expect(res.status.mock.calls[0][0]).toBe(401)

  })

  }) // end describe

