let appInstance = null // require('../app')();;
// noinspection JSUnresolvedVariable
const User = require('../models').User
const db = require('../models/index')
let predictionRoutes = require('../routes/prediction.routes')
let testSolNum = null
const configuration = require('../config/configuration')
const {config_keys} = require('../config/config')
const mocks = require('./mocks')
const testUtils = require('../shared/test_utils')

let n1 = {
  date: '2019-01-10T00:01:00.000Z',
  compliant: 1
}
let n2 = {
  date: '2019-01-08T00:01:00.000Z',
  compliant: 1
}
let n3 = {
  date: '2019-01-05T00:01:00.000Z',
  compliant: 0
}


describe('Prediction History', () => {
  beforeAll( async () => {
    // tests can give false failure if the time cuttoff removes all the useful test data
    process.env.minPredictionCutoffDate = '1990-01-01';

    process.env.MAIL_ENGINE = 'nodemailer-mock'
    const { app, clientPromise } = require('../app');
    appInstance = app(); // don't load the app till the mock is configured

    // let allowed_types = configuration.getConfig(config_keys.VISIBLE_NOTICE_TYPES).map( (x) => `'${x}'`).join(",")
    // let sql = `select solicitation_number
    //             from notice
    //             join notice_type on notice.notice_type_id = notice_type.id
    //             where notice_type.notice_type in (${allowed_types})
    //             order by notice.id desc
    //             limit 1`
    // let rows = await db.sequelize.query(sql)
    // testSolNum = rows[0][0].solicitation_number

    testSolNum = await testUtils.getSolNumForTesting()

  })

  afterAll(() => {
    return User.destroy({ where: { firstName: 'pred-beforeAllUser' } })
      .then( () => { appInstance.db.close(); })
  })

  test('Solicitations have a prediction history element', () => {
    return predictionRoutes.getPredictions({'solNum' : testSolNum}, mocks.mockAdminUser )
      .then( result => {
        let predictions = result.predictions
        let p = predictions[0]
        expect(p).toHaveProperty('predictions')
        expect(p.predictions).toHaveProperty('history')
        let history = p.predictions.history
        expect(history).toBeArray()
        expect(history[0]).toHaveProperty('date')
        expect(history[0]).toHaveProperty('value')

        // check the last entry in the history is equal to the date of the overall prediction
        let last = (new Date(history.slice(-1)[0].date)).toISOString().split('T')[0] //?
        let pdate = p.date.toISOString().split('T')[0]

        // Don't check the date. There are now times where a predication can be updated without new history (ex. becomes inactive)
        // expect(last).toBe(pdate)
        let color = history.slice(-1)[0].value
        expect(color).toBeOneOf(['red', 'green', 'black', 'yellow'])
      })
  }, 10000)

  test('notices merge history correctly', async () => {
    let solArray = predictionRoutes.mergePredictions([
      await predictionRoutes.makeOnePrediction(n1),
      await predictionRoutes.makeOnePrediction(n2),
      await predictionRoutes.makeOnePrediction(n3),
    ])
    let sol = solArray[0]
    expect(sol).toHaveProperty('predictions')
    expect(sol.predictions).toHaveProperty('history')

    expect(sol.predictions.history).toBeArray()
    expect(sol.predictions.history.length).toBe(3)
    let count = 0
    for (let historyLine of sol.predictions.history) {
      if (historyLine.date === n1.date) { expect(historyLine.value).toBe('green'); count += 1 }
      if (historyLine.date === n2.date) { expect(historyLine.value).toBe('green'); count += 2 }
      if (historyLine.date === n3.date) { expect(historyLine.value).toBe('red'); count += 4 }
    }
    expect(count).toBe(7)
  })

  test('history lines in date order', async () => {
    let sol1 = predictionRoutes.mergePredictions([
      await predictionRoutes.makeOnePrediction(n1),
      await predictionRoutes.makeOnePrediction(n2),
      await predictionRoutes.makeOnePrediction(n3),
    ])[0]

    let sol2 = predictionRoutes.mergePredictions([
      await predictionRoutes.makeOnePrediction(n3),
      await predictionRoutes.makeOnePrediction(n2),
      await predictionRoutes.makeOnePrediction(n1),
    ])[0]

    let history1 = sol1.predictions.history
    let history2 = sol2.predictions.history

    expect(Date.parse(history2[2].date)).toBeGreaterThan(Date.parse(history2[1].date))
    expect(Date.parse(history2[1].date)).toBeGreaterThan(Date.parse(history2[0].date))

    expect(Date.parse(history1[2].date)).toBeGreaterThan(Date.parse(history1[1].date))
    expect(Date.parse(history1[1].date)).toBeGreaterThan(Date.parse(history1[0].date))

  })


})
