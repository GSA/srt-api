const request = require('supertest')
let app = require('../app')()
const mockToken = require('./mocktoken')
// noinspection JSUnresolvedVariable
const User = require('../models').User
const { userAcceptedCASData } = require('./test.data')
const {common} = require('../config/config.js')

let myUser = {}
let token = {}

describe('Analytics routes tests', () => {
  beforeAll(() => {
    myUser = Object.assign({}, userAcceptedCASData)
    myUser.firstName = 'an-beforeAllUser'
    myUser.email = 'crowley+an@tcg.com'
    delete myUser.id
    return User.create(myUser)
      .then(async (user) => {
        myUser.id = user.id
        token = await mockToken(myUser, common['jwtSecret'])
      })
  })

  afterAll(() => {
    return User.destroy({ where: { firstName: 'an-beforeAllUser' } })
  })

  test('/api/analytics', () => {
    return request(app)
      .post('/api/analytics')
      .set('Authorization', `Bearer ${token}`)
      .send({ agency: 'Government-wide', fromPeriod: '1/1/1900', toPeriod: '12/31/2100' })
      .then((res) => {
        // noinspection JSUnresolvedVariable
        expect(res.statusCode).toBe(200)
        expect(res.body.TopSRTActionChart).toBeDefined()
        expect(res.body.TopSRTActionChart.determinedICT).toBeDefined()
        expect(res.body.TopSRTActionChart.determinedICT).toBeGreaterThan(2)
        return expect(res.body.TopAgenciesChart).toBeDefined()
      })
  } )
})
