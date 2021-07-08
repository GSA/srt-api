let app = null // require('../app')()
const mockToken = require('./mocktoken')
const mocks = require('./mocks')
const db = require('../models/index')
const {common} = require('../config/config.js')
const userRoutes = require('../routes/user.routes')
const solicitationRoutes = require('../routes/solicitation.routes')
const predictionRoutes = require('../routes/prediction.routes')
// noinspection JSUnresolvedVariable
const { adminCASData, coordinatorCASData } = require('./test.data')
const authRoutes = require('../routes/auth.routes')
const testUtils = require('../shared/test_utils')

let myUser = {}
myUser.firstName = 'sol-beforeAllUser'
myUser.email = 'crowley+sol@tcg.com'
delete myUser.id
let adminToken = ""
let coordinatorToken = ""

describe('solicitation tests',  () => {
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
    // let rows = await db.sequelize.query('select "solNum" from "Predictions"  where "noticeType" = \'Solicitation\' order by id desc limit 1')
    let solNum = await testUtils.getSolNumForTesting()
    expect(solNum).toBeDefined()
    let solRoute = solicitationRoutes(db, userRoutes)

    await db.sequelize.query(`delete from "Predictions" where "solNum" = '${solNum}'`)

    // set it to true
    let user = { agency: "General Services Administration", userRole: "Administrator" }
    let res = mocks.mockResponse()
    let req = mocks.mockRequest({ solicitation: { solNum: solNum, na_flag: true } }, {'authorization': `bearer ${adminToken}`})
    await solRoute.update(req, res)
    expect(res.status.mock.calls[0][0]).toBe(200)

    let p_true = await predictionRoutes.getPredictions({ rows: 1, filters: {"solNum": {value: solNum, matchMode: 'equals'}} }, user);
    expect(p_true.predictions[0].na_flag).toBe(true)

    // now set it to false
    let res2 = mocks.mockResponse()
    let req2 = mocks.mockRequest({ solicitation: { solNum: solNum, na_flag: false } }, {'authorization': `bearer ${adminToken}`})
    await solRoute.update(req2, res2)
    expect(res2.status.mock.calls[0][0]).toBe(200)

    let p_false = await predictionRoutes.getPredictions({ rows: 1, globalFiler: solNum, atctest: 777}, user);
    expect(p_false.predictions[0].na_flag).toBe(false)

  }, 300000)

  test('Update Not Applicable with bad sol num', async () => {
    let res = mocks.mockResponse();
    let req = mocks.mockRequest({ solicitation: { solNum: 'fake number', na_flag: true } }, {'authorization': `bearer ${adminToken}`})
    let solRoute = solicitationRoutes(db, userRoutes)
    await solRoute.update(req, res)
    expect(res.status.mock.calls[0][0]).toBe(404)
  })

  // noinspection DuplicatedCode
  test('GSA Admins can Update Not Applicable for any sol num', async () => {
    let rows = await db.sequelize.query('select solicitation_number from notice join notice_type nt on notice.notice_type_id = nt.id where nt.notice_type = \'Solicitation\' order by notice.id desc limit 1')
    let solNum = rows[0][0].solicitation_number
    expect(solNum).toBeDefined()

    let res = mocks.mockResponse();
    let req = mocks.mockRequest({ solicitation: { solNum: solNum, na_flag: true } }, {'authorization': `bearer ${adminToken}`})
    let solRoute = solicitationRoutes(db, userRoutes)
    await solRoute.update(req, res)
    expect(res.status.mock.calls[0][0]).toBe(200)
  })

  // noinspection DuplicatedCode
  test('Agency User can update Not Applicable for any solicitations in their agency', async () => {
    let dbName = authRoutes.translateCASAgencyName(coordinatorCASData["org-agency-name"])
    let sql = `select solicitation_number from notice where agency = '${dbName}' order by solicitation_number desc limit 1`
    let rows = await db.sequelize.query(sql)
    let solNum = rows[0][0].solicitation_number
    expect(solNum).toBeDefined()

    let res = mocks.mockResponse();
    let req = mocks.mockRequest({ solicitation: { solNum: solNum, na_flag: true } }, {'authorization': `bearer ${adminToken}`})
    let solRoute = solicitationRoutes(db, userRoutes)
    await solRoute.update(req, res)
    expect(res.status.mock.calls[0][0]).toBe(200)
  })

  // noinspection DuplicatedCode
  test('Agency User can NOT update Not Applicable for any solicitations for another agency', async () => {
    let sql = `select "solNum" from solicitations where agency != '${coordinatorCASData["org-agency-name"]}' order by "solNum" desc limit 1`
    let rows = await db.sequelize.query(sql)
    let solNum = rows[0][0].solNum
    expect(solNum).toBeDefined()

    let res = mocks.mockResponse();
    let req = mocks.mockRequest({ solicitation: { solNum: solNum, na_flag: true } }, {'authorization': `bearer ${coordinatorToken}`})
    let solRoute = solicitationRoutes(db, userRoutes)
    await solRoute.update(req, res)
    expect(res.status.mock.calls[0][0]).toBe(401)
  })

  test('Solicitation updates rejected from people without a ticket', async () => {
    let res = mocks.mockResponse();
    let req = mocks.mockRequest({ solicitation: { solNum: '1234', na_flag: true } })
    let solRoute = solicitationRoutes(db, userRoutes)
    await solRoute.update(req, res)
    expect(res.status.mock.calls[0][0]).toBe(401)

  })

  test('Solicitation details include inactive field', async () => {

    let rows = await db.sequelize.query('select "solNum" from "Predictions"  where "noticeType" = \'Solicitation\' order by id desc limit 1;')
    let solNum = rows[0][0]['solNum']
    await db.sequelize.query(`update solicitations set active = true, "updatedAt" = current_timestamp where "solNum" = '${solNum}' ` )

    let res1 = mocks.mockResponse();
    let req1 = mocks.mockRequest({ } , {'authorization': `bearer ${adminToken}`})
    req1.body = {"filters": { ["solNum"]: { "value": solNum, "matchMode": "equals" } } }
    await predictionRoutes.predictionFilter(req1, res1)
    expect(res1.status.mock.calls[0][0]).toBe(200)
    let prediction = res1.send.mock.calls[0][0]['predictions']
    expect(prediction[0].solNum).toBe(solNum)
    expect(prediction[0]['active']).toBe(true)


    await db.sequelize.query(`update solicitations set active = false, "updatedAt" = current_timestamp where "solNum" = '${solNum}' ` )

    let res2 = mocks.mockResponse();
    let req2 = mocks.mockRequest({ } , {'authorization': `bearer ${adminToken}`})
    req2.body = {"filters": { ["solNum"]: { "value": solNum, "matchMode": "equals" } } }
    await predictionRoutes.predictionFilter(req2, res2)
    expect(res2.status.mock.calls[0][0]).toBe(200)
    prediction = res2.send.mock.calls[0][0]['predictions']
    expect(prediction[0].solNum).toBe(solNum)
    expect(prediction[0]['active']).toBe(false)

    //
    // let rows = await db.sequelize.query('select "solNum" from "Predictions"  where "noticeType" = \'Solicitation\' order by id desc limit 1;')
    // let solNum = rows[0][0]['solNum'] //?
    //
    // let solrows = await db.sequelize.query(`select id from "solicitations"  where "solNum" =  '${solNum}' order by id desc limit 1;`)
    // let id = solrows[0][0]['id'] //?
    //
    // await db.sequelize.query(`update solicitations set active = true, "updatedAt" = current_timestamp where "solNum" = '${solNum}' ` )
    //
    // let res = mocks.mockResponse();
    // let req = mocks.mockRequest({ } , {'authorization': `bearer ${adminToken}`})
    // req.params = {"id":id}
    // let solRoute = solicitationRoutes(db, userRoutes)
    // await solRoute.get(req, res)
    // expect(res.status.mock.calls[0][0]).toBe(200)
    // let prediction = res.send.mock.calls[0][0]['dataValues']
    // expect(prediction['active']).toBe(true)
    //
    // let usql = `update solicitations set active = false, "updatedAt" = current_timestamp where "solNum" = '${solNum}' ` //?
    // await db.sequelize.query(usql)
    //
    //
    // let res2 = mocks.mockResponse();
    // let req2 = mocks.mockRequest({ } , {'authorization': `bearer ${adminToken}`})
    // req2.params = {"id":id}
    // await solRoute.get(req2, res2)
    // expect(res2.status.mock.calls[0][0]).toBe(200)
    // prediction = res2.send.mock.calls[0][0]['dataValues']
    // res2.send.mock.calls //?
    // expect(prediction['active']).toBe(false)

  }, 60000)

  test('Filter for only active solicitations', async () => {

    // set some solicitations to true, some to false
    await db.sequelize.query(`
        update solicitations set active = false, "updatedAt" = current_timestamp where "solNum" in
          ( select "solicitation_number" 
            from "notice" 
            join notice_type on notice.notice_type_id = notice_type.id 
            where notice_type = 'Solicitation'
                  and notice.id % 2 = 0
            order by notice.id desc 
            limit 10 
          ) `)
    await db.sequelize.query(`
        update solicitations set active = true, "updatedAt" = current_timestamp where "solNum" in
          ( select "solicitation_number" 
            from "notice" 
            join notice_type on notice.notice_type_id = notice_type.id 
            where notice_type = 'Solicitation'
                  and notice.id % 2 = 1
            order by notice.id desc 
            limit 10 
          ) `)


    const filter = {
      "first": 0,
      "rows": 150,
      "sortField": "noticeType",
      "sortOrder": -1,
      "filters": { ["active"]: { "value": true, "matchMode": "equals" } },
      "globalFilter": null
    }

    let res = mocks.mockResponse()
    let req = mocks.mockRequest(filter, { 'authorization': `bearer ${adminToken}` })
    await predictionRoutes.predictionFilter(req, res)
    activeCount = parseInt( res.send.mock.calls[0][0]['totalCount'])
    expect(res.status.mock.calls[0][0]).toBe(200);
    expect(activeCount).toBeGreaterThan(1);

    filter['filters'] = { ["active"]: { "value": false, "matchMode": "equals" } }
    let res3 = mocks.mockResponse()
    let req3 = mocks.mockRequest(filter, { 'authorization': `bearer ${adminToken}` })
    await predictionRoutes.predictionFilter(req3, res3)
    inactiveCount = res3.send.mock.calls[0][0]['totalCount']
    expect(res3.status.mock.calls[0][0]).toBe(200);
    expect(inactiveCount).toBeGreaterThan(0);

    filter['filters'] = {}
    let res2 = mocks.mockResponse()
    let req2 = mocks.mockRequest(filter, { 'authorization': `bearer ${adminToken}` })
    await predictionRoutes.predictionFilter(req2, res2)
    allCount = res2.send.mock.calls[0][0]['totalCount']
    expect(res2.status.mock.calls[0][0]).toBe(200);
    expect(allCount).toBeGreaterThan(1);

    expect(activeCount+inactiveCount).toBe(allCount)
  })


}) // end describe

