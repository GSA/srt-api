const request = require('supertest')
const { app, clientPromise } = require('../app');
const appInstance = app();
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
        // tests can give false failure if the time cuttoff removes all the useful test data
        process.env.minPredictionCutoffDate = '1990-01-01';

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

        expect(res.status.mock.calls[0][0]).toBe(200)
        expect (stats.solStats).toBeObject()
        for (let key of ["totalSolicitations", "newSolicitations", "updatedSolicitations", "newSolicitationsByDate", "updatedSolicitationsByDate"]) {
            expect(stats.solStats).toContainKey(key)
        }
        expect(stats.solStats.totalSolicitations).toBeGreaterThan(10)


    }, 100000)

    test('/api/analytics', () => {
        return request(appInstance)
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

    test('/api/analytics notApplicable values', () => {
        return request(appInstance)
            .post('/api/analytics')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ agency: 'Government-wide', fromPeriod: '1/1/1900', toPeriod: '12/31/2100' })
            .then((res) => {
                // Log the entire response body and focus on PredictResultChart
                console.log('Full Response Body:', JSON.stringify(res.body, null, 2));
                console.log('PredictResultChart:', res.body.PredictResultChart);
                console.log('notApplicable Value:', res.body.PredictResultChart?.notApplicable);
    
                // Assertions
                expect(res.statusCode).toBe(200);
                expect(res.body.PredictResultChart).toBeDefined();
                expect(res.body.PredictResultChart.notApplicable).toBeDefined();
    
                // Validate 'notApplicable' (adjust expectation if necessary)
                expect(res.body.PredictResultChart.notApplicable).toBeGreaterThan(2);
    
                return expect(res.body.PredictResultChart).toBeDefined();
            });
    });
    
    
    })

