const { app, clientPromise } = require('../app');
const appInstance = app();
const db = require('../models/index')
let predictionRoutes = require('../routes/prediction.routes')
// noinspection JSUnresolvedVariable
const Notice = require('../models/index').notice
// noinspection JSUnresolvedVariable
const Prediction = require('../models/index').Prediction
const Solicitation = require('../models/index').Solicitation
const SurveyResponse = require('../models/index').SurveyResponse
const moment = require('moment')
const Op = require('sequelize').Op
const test_utils = require('../shared/test_utils')

describe('Predictions table Test', () => {
    beforeAll(() => {
    })

    afterAll(() => {
        return appInstance.db.close();
    })

    test('Test solicitation -> feedback association', async () => {

        let solNum = await test_utils.getSolNumForTesting({'has_feedback': true})

        let preds = await Solicitation.findAll({
            include: [{
                model: SurveyResponse,
                as: 'feedback'
            }],
            where: {solNum: {[Op.eq]: solNum}}

        });

        expect(preds[0]).toContainKey('feedback')
        expect(preds[0].feedback).toBeArray()
        expect(preds[0].feedback.length).toBeGreaterThan(0)
    })

    // TODO: remove this after completing the move to solicitation table.
    // test('solicitation table update', async () => {
    //
    //     await predictionRoutes.updatePredictionTable()
    //
    //     let result = await db.sequelize.query(`
    //     select "solNum", date
    //     from "Predictions"
    //     order by date desc
    //     limit 1 `, null)
    //     let solNum = result[0][0]['solNum']
    //
    //     await db.sequelize.query(`delete from "solicitations" where "solNum" = '${solNum}' `, null)
    //
    //     await predictionRoutes.prepareSolicitationTable()
    //
    //     let result2 = await db.sequelize.query(`
    //     select "solNum"
    //     from solicitations where "solNum" = '${solNum}' `, null)
    //
    //     expect(solNum).toBe(result2[0][0]['solNum'])
    //
    //
    // })

})
