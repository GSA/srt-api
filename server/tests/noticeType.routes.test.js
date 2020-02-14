let app = require('../app')();
const request = require('supertest')
// noinspection JSUnresolvedVariable
const db = require('../models/index')
let noticeRoutes = require('../routes/noticeType.routes')
const mocks = require('./mocks')
const mockToken = require('./mocktoken')
let {  userAcceptedCASData } = require('./test.data')
const {common, config_keys} = require('../config/config.js')
const {getConfig} = require('../config/configuration')

let token = {}


describe('noticeType', () => {
  beforeAll(() => {

    myUser = Object.assign({}, userAcceptedCASData)
    return mockToken(myUser, common['jwtSecret'])
      .then(t=> {
        token = t
      })

  })

  afterAll(() => {
    return app.db.close();
  })

  test('noticeType get API requires login', async () => {
    await request(app)
      .get('/api/noticeTypes')
      .send()
      .then((res) => {
        // noinspection JSUnresolvedVariable
        expect(res.statusCode).toBe(401)
      })

    await request(app)
      .get('/api/noticeTypes')
      .set('Authorization', `Bearer ${token}`)
      .send()
      .then((res) => {
        // noinspection JSUnresolvedVariable
        expect(res.statusCode).toBe(200)
      })
  })

  test('noticeType get API returns all active types', async () => {
        let allTypes = getConfig(config_keys.VISIBLE_NOTICE_TYPES)

        let mockRes = mocks.mockResponse()
        let mockReq = mocks.mockRequest()
        await noticeRoutes.getNoticeTypes(mockReq,mockRes)
        expect(mockRes.status.mock.calls[0][0]).toBe(200)
        let types = mockRes.send.mock.calls[0][0]

        expect(types.length).toBe(allTypes.length)

        for (t of allTypes) {
          expect(types.includes(t)).toBeTruthy()
        }


    // moving to fixed notice types, maybe temporary change so leaving the old test here.

    // return db.sequelize.query('select distinct "noticeType" from "Predictions"')
    //   .then(async (rows) => {
    //     let allTypes = []
    //     for (r of rows[0]) {
    //       allTypes.push(r['noticeType'])
    //     }
    //
    //     let mockRes = mocks.mockResponse()
    //     let mockReq = mocks.mockRequest()
    //     await noticeRoutes.getNoticeTypes(mockReq,mockRes)
    //     expect(mockRes.status.mock.calls[0][0]).toBe(200)
    //     let types = mockRes.send.mock.calls[0][0]
    //
    //     expect(types.length).toBe(allTypes.length)
    //
    //     for (t of allTypes) {
    //       expect(types.includes(t)).toBeTruthy()
    //     }
    //
    //
    //   })
  })

})
