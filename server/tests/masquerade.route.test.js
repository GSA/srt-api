const supertestSession = require('supertest-session')
let app = require('../app')()
const mockToken = require('./mocktoken')
// noinspection JSUnresolvedVariable
const User = require('../models').User
const { adminCASData, coordinatorCASData } = require('./test.data')
const {common} = require('../config/config.js')
const jwt = require('jsonwebtoken')
const authRoutes = require('../routes/auth.routes')

let adminUser = {}
let adminToken = {}
let coordinatorUser = {}
let coordinatorToken = {}
let testSession = null

describe('Test masquerade functionality', () => {
  beforeAll(async () => {
    testSession = supertestSession(app)

    adminUser = Object.assign({}, adminCASData)
    adminUser.firstName = 'masq-beforeAllUser'
    adminUser.email = 'crowley+masq@tcg.com'
    delete adminUser.id
    return User.create(adminUser)
      .then(async (user) => {
        adminUser.id = user.id
        adminToken = await mockToken(adminUser, common['jwtSecret'])
      })
      .then(async () => {
        coordinatorUser = Object.assign( {}, coordinatorCASData)
        coordinatorUser.firstName = 'masq-beforeAllUser'
        coordinatorUser.email = 'crowley+masqcoord@tcg.com'
        User.create(coordinatorUser)
          .then( async (user) => {
            coordinatorUser.id = user.id
            coordinatorToken = await mockToken(coordinatorUser, common['jwtSecret'])
          })
      })
  })

  afterAll(() => {

    return User.destroy({ where: { firstName: 'masq-beforeAllUser' } }).then( () =>{
      app.db.sequelize.close()
      })
  })

  test('Get new token',  () => {
    let role = authRoutes.roles[ authRoutes.roleKeys["508_COORDINATOR_ROLE"]].name
    let agency = 'NIH'
    return testSession.get(`/api/user/masquerade?role=${role}&agency=${agency}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .then(async res => {
        // noinspection JSUnresolvedVariable
        expect(res.statusCode).toBe(200)
        expect(res.body.token).toBeDefined()
        let decoded = jwt.decode(res.body.token)
        expect(decoded.user.grouplist).toBe(authRoutes.roleNameToCASGroup(role))
        expect(decoded.user.userRole).toBe(role)
        expect(decoded.user.agency).toBe(agency)
        expect(res.body.agency).toBe(agency)
        expect(res.body.role).toBe(role)
      })
  } )

  test('Masquerade fixes agency name case sensitivity',  () => {
    let role = authRoutes.roles[ authRoutes.roleKeys["508_COORDINATOR_ROLE"]].name
    let agency = 'department of defense'
    return testSession.get(`/api/user/masquerade?role=${role}&agency=${agency}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .then(async res => {
        // noinspection JSUnresolvedVariable
        expect(res.statusCode).toBe(200)
        expect(res.body.token).toBeDefined()
        let decoded = jwt.decode(res.body.token)
        expect(decoded.user.grouplist).toBe(authRoutes.roleNameToCASGroup(role))
        expect(decoded.user.userRole).toBe(role)
        expect(decoded.user.agency).toBe("Department of Defense")
        expect(res.body.agency).toBe("Department of Defense")
        expect(res.body.role).toBe(role)
      })
  } )


  test('Handle invalid role', () => {
    return testSession.get(`/api/user/masquerade?role=fakerole&agency=NIH`)
      .set('Authorization', `Bearer ${adminToken}`)
      .then(async res => {
        // noinspection JSUnresolvedVariable
        expect(res.statusCode).toBe(400)
      })

  })

  test('Only GSA Admin can masquerade', () => {
    let role = authRoutes.roles[ authRoutes.roleKeys["508_COORDINATOR_ROLE"]].name
    let agency = 'NIH'
    return testSession.get(`/api/user/masquerade?role=${role}&agency=${agency}`)
      .set('Authorization', `Bearer ${coordinatorToken}`)
      .then(async res => {
        // noinspection JSUnresolvedVariable
        expect(res.statusCode).toBe(401)
      })

  })


})
