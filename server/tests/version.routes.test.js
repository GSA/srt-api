const request = require('supertest')
const { app, clientPromise } = require('../app');
const appInstance = app();

describe('Version route tests', () => {
  test('Get version', () => {
    return request(appInstance)
      .get('/api/version')
      .send({})
      .then(res => {
        // noinspection JSUnresolvedVariable
        expect(res.statusCode).toBe(200)
        expect(['development', 'gitlab', 'test', 'circle']).toContain(res.body.env)
        expect(res.body.version).toBeDefined()
        return expect(res.body.version).toMatch(/^v[0-9]+\.[0-9]+\.[0-9]+$/)
      })
  })
})
