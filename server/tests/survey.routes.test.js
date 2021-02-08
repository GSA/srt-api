const mockToken = require('./mocktoken')
const mocks = require('./mocks')
// noinspection JSUnresolvedVariable
const {common} = require('../config/config.js')
const surveyRoutes = require('../routes/survey.routes')
const {coordinatorCASData,feedback} = require('./test.data')
const random_words = require('random-words')
const {getSolNumForTesting} = require('../shared/test_utils')

let token = {}

describe('Survey routes tests', () => {
    beforeAll(async () => {
        token = await mockToken(coordinatorCASData, common['jwtSecret'])
    })

    afterAll(() => {

    })

    test('Get survey questions', async () => {

        let res = mocks.mockResponse();
        let req = mocks.mockRequest({}, {'authorization': `bearer ${token}`})
        await surveyRoutes.getSurveyQuestions(req, res) //?

        expect(res.status.mock.calls[0][0]).toBe(200)
        body = res.send.mock.calls[0][0]
        expect(body[0].Choices.length).toBeDefined()
        expect(body[0].ID).toBeDefined()
    })

    test('Save and pull a new survey result', async () => {

        solNum = await getSolNumForTesting({'offset': 4, 'notice_count': 4}) //?

        let res = mocks.mockResponse();
        let req = mocks.mockRequest({
            "solNum": solNum,
            "feedback": feedback
        }, {'authorization': `bearer ${token}`}, {"solNum": solNum})
        await surveyRoutes.postResponse(req, res)

        expect(res.status.mock.calls[0][0]).toBe(200)
        let body = res.send.mock.calls[0][0]
        expect(body.solNum).toBe(solNum)
        expect(body.response[0].answer).toBe("Maybe")


        let res_get = mocks.mockResponse();
        let req_get = mocks.mockRequest({}, {'authorization': `bearer ${token}`}, {"solNum": solNum})
        await surveyRoutes.get(req_get, res_get)

        expect(res_get.status.mock.calls[0][0]).toBe(200)
        body = res_get.send.mock.calls[0][0]
        expect(body[0].answer).toBe("Maybe")

    }, 600000)


    test('Get a 404 if you ask for a survey response that does not exist', async () => {

        let res_get = mocks.mockResponse();
        let req_get = mocks.mockRequest({}, {'authorization': `bearer ${token}`}, {"solNum": "not a real sol number"})
        await surveyRoutes.get(req_get, res_get)

        expect(res_get.status.mock.calls[0][0]).toBe(404)

    })
})
