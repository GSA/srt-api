let app =  require('../app')();
const db = require('../models/index')
let predictionRoutes = require('../routes/prediction.routes')
// noinspection JSUnresolvedVariable
const Notice = require('../models/index').notice
// noinspection JSUnresolvedVariable
const Prediction = require('../models/index').Prediction
const moment = require('moment')

describe('Predictions table Test', () => {
    beforeAll(() => {
    })

    afterAll(() => {
        return app.db.close();
    })

    test('solicitation table update', async () => {

        await predictionRoutes.updatePredictionTable()

        let result = await db.sequelize.query(`
        select "solNum", date 
        from "Predictions"
        order by date desc
        limit 1 `, null)
        let solNum = result[0][0]['solNum']

        await db.sequelize.query(`delete from "solicitations" where "solNum" = '${solNum}' `, null)

        await predictionRoutes.prepareSolicitationTable()

        let result2 = await db.sequelize.query(`
        select "solNum" 
        from solicitations where "solNum" = '${solNum}' `, null)

        expect(solNum).toBe(result2[0][0]['solNum'])


    })

})
