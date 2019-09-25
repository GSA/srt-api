const supertestSession = require('supertest-session')
const app = require('../app')()
const mockToken = require('./mocktoken')
const mocks = require('./mocks')
// noinspection JSUnresolvedVariable
const configuration = require('../config/configuration')
const authRoutes = require('../routes/auth.routes')
const adminOnly = require('../security/admin.only')()

const { adminCASData, coordinatorCASData } = require('./test.data')
let testSession = null;
let adminUser = {}
let adminToken = {}
let coordinatorUser = {}
let coordinatorToken = {}

/** @namespace res.statusCode */

describe('Tests for admin check', () => {

  beforeAll(async () => {
    testSession = supertestSession(app)

    adminUser = Object.assign({}, adminCASData)
    adminUser.firstName = 'adminCheck-beforeAllUser'
    adminToken = await mockToken(adminUser, configuration.getConfig('jwtSecret'))

    coordinatorUser = Object.assign( {}, coordinatorCASData)
    coordinatorUser.firstName = 'masq-beforeAllUser'
    coordinatorToken = await mockToken(coordinatorCASData, configuration.getConfig('jwtSecret'))

  })

  afterAll(() => {
    return User.destroy({ where: { firstName: 'adminCheck-beforeAllUser' } }).then( () =>{
      app.db.sequelize.close()
    })
  })

  test('Admins can access protected routes', async () => {
    return testSession.get(`/api/user/masquerade?role=${authRoutes.roles[2].name}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .then( (res) => {
        expect(res.statusCode).toBe(200)
    })
  })

  test('Non-admins rejected from protected routes', async () => {
    return testSession.get(`/api/user/masquerade?role=${authRoutes.roles[2].name}`)
      .set('Authorization', `Bearer ${coordinatorToken}`)
      .then( (res) => {
        expect(res.statusCode).toBe(401)
      })
  })

  test('admin.only Handles no token situation', async () => {
    let res = mocks.mockResponse()
    let req = mocks.mockRequest()
    await adminOnly(req, res, null)
    expect(res.status).toBeCalledWith(401)
  })

  test('admin.only Handles bad token signature', async () => {
    let badToken =  await mockToken(adminUser, 'not the secret')
    let res = mocks.mockResponse()
    let req = mocks.mockRequest({}, {authorization : `Bearer ${badToken}`})
    await adminOnly(req, res, null)
    expect(res.status).toBeCalledWith(401)
  })
})
