let app =  require('../app')();
const db = require('../models/index')
let predictionRoutes = require('../routes/prediction.routes')
// noinspection JSUnresolvedVariable
const Notice = require('../models/index').notice
// noinspection JSUnresolvedVariable
const Prediction = require('../models/index').Prediction
const moment = require('moment')

describe('Prediction Update Test', () => {
  beforeAll(() => {
  })

  afterAll(() => {
    return app.db.close();
  })

  test('prediction table update', async () => {

    await predictionRoutes.updatePredictionTable();

    let notices = await Notice.findAll({ limit: 1})
    await notices[0].update ( {feedback: [{ date: moment().format('YYYY-MM-DD:HH:mm:ss')}] })

    let updated_count = await predictionRoutes.updatePredictionTable()
    expect(updated_count).toBeGreaterThan(0)

    // get the notice type for the 'newest' row in the notice table for each solicitation number
    let result = await db.sequelize.query(`
        select notice_type, n.*
        from notice n
            inner join (
                select max(id) id, solicitation_number
                from notice
                group by solicitation_number
            ) nprime on n.solicitation_number = nprime.solicitation_number and n.id = nprime.id
        join notice_type on n.notice_type_id = notice_type.id
        where n.solicitation_number != ''
        order by n.id;`, null)


    // test about 25 records to make sure the data is correct.
    // takes too long to test them all
    for (let i=0; i < result.length; i = i + Math.ceil(result.length/25)) {
      let r = result[0][i]
      let predictions = await Prediction.findOne({ where: {solNum : r.solicitation_number} })
      expect(predictions.noticeType).toBe(r.notice_type)
    }


  }, 30000)

  test("Test agency mapping for prediction table load", () => {
    expect( predictionRoutes.mapAgency("trash") ).toBe("trash")
    expect( predictionRoutes.mapAgency("TRANSPORTATION, DEPARTMENT OF")).toBe("Department of Transportation")
  })

  // skip this test. It can't be run in parallel with others and isn't terribly important
  test.skip('optional wipe of prediction table during update', async () => {
    // initial update
    await predictionRoutes.updatePredictionTable()

    let updateCount = await predictionRoutes.updatePredictionTable()
    expect(updateCount).toBe(0)

    updateCount = await predictionRoutes.updatePredictionTable('2222-01-01')
    expect(updateCount).toBe(0)

    updateCount = await predictionRoutes.updatePredictionTable('1999-01-01')
    expect(updateCount).toBeGreaterThan(50)

    updateCount = await predictionRoutes.updatePredictionTable()
    expect(updateCount).toBe(0)

  }, 60000)

})
