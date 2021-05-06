const request = require('supertest')
let app = require('../app')()
const mockToken = require('./mocktoken')
// noinspection JSUnresolvedVariable
const User = require('../models').User
const {userAcceptedCASData, adminCASData} = require('./test.data')
const {common} = require('../config/config.js')
const mocks = require('./mocks')
const analyticRoutes = require('../routes/analytics.routes')

// let myUser = {}
let adminUser = {}
// let token = {}
let adminToken = {}

describe('Analytics routes tests', () => {
    // beforeAll(async () => {
    //     myUser = Object.assign({}, userAcceptedCASData)
    //     myUser.firstName = 'an-beforeAllUser'
    //     myUser.email = 'crowley+an@tcg.com'
    //     delete myUser.id
    //     let user = await User.create(myUser)
    //     myUser.id = user.id
    //     console.log ("getting mock token")
    //     token = await mockToken(myUser, common['jwtSecret'])
    //     console.log (`got token ${token}`)
    //
    //
    //     adminUser = Object.assign({}, adminCASData)
    //     adminUser.firstName = 'adminCheck-beforeAllUser'
    //     adminToken = await mockToken(adminUser, common['jwtSecret'])
    //     console.log (adminToken)
    // })

    beforeAll(async () => {

        try {
            adminUser = Object.assign({}, adminCASData)
            adminUser.firstName = 'adminCheck-beforeAllUser'
            adminToken = await mockToken(adminUser, common['jwtSecret'])
            console.log(adminToken)
        }catch (e) {
            console.log(e)
        }

    })


    afterAll(() => {
        return User.destroy({where: {firstName: 'adminCheck-beforeAllUser'}})
    })

    test('analytics', async () => {

        adminUser = Object.assign({}, adminCASData)
        adminUser.firstName = 'adminCheck-beforeAllUser'
        adminToken = await mockToken(adminUser, common['jwtSecret'])
        console.log(adminToken)

        let res = mocks.mockResponse()
        let req = mocks.mockRequest({startDate: "1/1/1900", endDate: "12/31/2100", agency: "Government-wide"}, {'authorization': `bearer ${adminToken}`})

        await analyticRoutes.analytics(req, res);

        let stats = res.send.mock.calls[0][0];

        expect (stats.solStats).toBeObject()
        for (let key of ["totalSolicitations", "newSolicitations", "updatedSolicitations", "newSolicitationsByDate", "updatedSolicitationsByDate"]) {
            expect(stats.solStats).toContainKey(key)
        }
        expect(stats.solStats.totalSolicitations).toBeGreaterThan(10)


    }, 100000)

    test('/api/analytics', () => {
        return request(app)
            .post('/api/analytics')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({agency: 'Government-wide', fromPeriod: '1/1/1900', toPeriod: '12/31/2100'})
            .then((res) => {
                // noinspection JSUnresolvedVariable
                expect(res.statusCode).toBe(200)
                expect(res.body.TopSRTActionChart).toBeDefined()
                expect(res.body.TopSRTActionChart.determinedICT).toBeDefined()
                expect(res.body.TopSRTActionChart.determinedICT).toBeGreaterThan(2)
                return expect(res.body.TopAgenciesChart).toBeDefined()
            })
    })
})
