let app =  require('../app')();
const db = require('../models/index')
let predictionRoutes = require('../routes/prediction.routes')
const Notice = require('../models/index').notice
const Prediction = require('../models/index').Prediction

describe('Prediction Update Test', () => {
  beforeAll(() => {
  })

  afterAll(() => {
    return app.db.close();
  })

  test('prediction table update', async () => {

    await predictionRoutes.updatePredictionTable();

    let notices = await Notice.findAll({ limit: 1})
    await notices[0].update ( {feedback: { test: notices[0].feedback} })

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
        order by n.id;`)


    // test about 25 records to make sure the data is correct.
    // takes too long to test them all
    for (let i=0; i < result.length; i = i + Math.ceil(result.length/25)) {
      let r = result[0][i]
      let predictions = await Prediction.findOne({ where: {solNum : r.solicitation_number} })
      expect(predictions.noticeType).toBe(r.notice_type)
    }


  }, 30000)

})