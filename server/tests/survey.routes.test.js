const request = require('supertest')
let app = require('../app')()
const mockToken = require('./mocktoken')
// noinspection JSUnresolvedVariable
const User = require('../models').User
const { userAccepted } = require('./test.data')

let myUser = {}
let token = {}

describe('/api/analytics', () => {
  beforeAll(() => {
    myUser = Object.assign({}, userAccepted)
    myUser.firstName = 'survey-beforeAllUser'
    myUser.email = 'crowley+survey@tcg.com'
    delete myUser.id
    return User.create(myUser)
      .then((user) => {
        myUser.id = user.id
        token = mockToken(myUser)
      })
  })

  afterAll(() => {
    return User.destroy({ where: { firstName: 'survey-beforeAllUser' } })
  })

  test('Get surveys', () => {
    return request(app)
      .get('/api/surveys')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .then(res => {
        // noinspection JSUnresolvedVariable
        expect(res.statusCode).toBe(200)
        expect(res.body[0].Choices.length).toBeDefined()
        return expect(res.body[0].ID).toBeDefined()
      })
  })
})
