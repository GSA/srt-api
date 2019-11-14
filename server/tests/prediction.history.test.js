let app = null // require('../app')();;
// noinspection JSUnresolvedVariable
const User = require('../models').User
const db = require('../models/index')
let predictionRoutes = require('../routes/prediction.routes')
let testSolNum = null

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
  beforeAll(() => {
    process.env.MAIL_ENGINE = 'nodemailer-mock'
    app = require('../app')() // don't load the app till the mock is configured
    return db.sequelize.query("select solicitation_number from notice order by date desc limit 1;")
      .then( (rows) => {
        testSolNum = rows[0][0]['solicitation_number']
      })
  })

  afterAll(() => {
    return User.destroy({ where: { firstName: 'pred-beforeAllUser' } })
      .then( () => { app.db.close(); })
  })

  test('Solicitations have a prediction history element', () => {
    return predictionRoutes.getPredictions({'solNum' : testSolNum} )
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

        let last = (new Date(history.slice(-1)[0].date)).toISOString().split('T')[0]
        let pdate = p.date.toISOString().split('T')[0]

        expect(last).toBe(pdate)
        expect(history.slice(-1)[0].value).toBe(p.predictions.value)
      })
  })

  test('notices merge history correctly', () => {
    let solArray = predictionRoutes.mergePredictions([
      predictionRoutes.makeOnePrediction(n1),
      predictionRoutes.makeOnePrediction(n2),
      predictionRoutes.makeOnePrediction(n3),
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

  test('history lines in date order', () => {
    let sol1 = predictionRoutes.mergePredictions([
      predictionRoutes.makeOnePrediction(n1),
      predictionRoutes.makeOnePrediction(n2),
      predictionRoutes.makeOnePrediction(n3),
    ])[0]

    let sol2 = predictionRoutes.mergePredictions([
      predictionRoutes.makeOnePrediction(n3),
      predictionRoutes.makeOnePrediction(n2),
      predictionRoutes.makeOnePrediction(n1),
    ])[0]

    let history1 = sol1.predictions.history
    let history2 = sol2.predictions.history

    expect(Date.parse(history2[2].date)).toBeGreaterThan(Date.parse(history2[1].date))
    expect(Date.parse(history2[1].date)).toBeGreaterThan(Date.parse(history2[0].date))

    expect(Date.parse(history1[2].date)).toBeGreaterThan(Date.parse(history1[1].date))
    expect(Date.parse(history1[1].date)).toBeGreaterThan(Date.parse(history1[0].date))

  })


})
