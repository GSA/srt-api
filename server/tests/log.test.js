const db = require('../models/index')
const {getConfig} = require('../config/configuration')
const predictionRoutes = require('../routes/prediction.routes')
const mockToken = require('./mocktoken')
const { userAcceptedCASData } = require('./test.data')
let jwt = require('jsonwebtoken')


describe('Log testing', () => {

  test('log entries are appearing in the database', async () => {
    let myUser = Object.assign({}, userAcceptedCASData)
    delete myUser.id
    let start_time = new Date()
    const token = await mockToken(myUser, getConfig('jwtSecret'))

    let fullUser = jwt.decode(token).user

    let rows = await db.sequelize.query(`select timestamp from winston_logs order by timestamp desc limit 1 `)
    let time_before = rows[0][0].timestamp

    preds = await predictionRoutes.getPredictions({}, fullUser)

    let rows_after = await db.sequelize.query(`select * from winston_logs order by timestamp desc limit 100`)

    let t_after = rows_after[0][0].timestamp
    let t_meta = rows_after[0][0].meta //?
    t_meta.message //?


    expect(t_after.getTime()).toBeGreaterThan(time_before.getTime())
    expect(t_after.getTime()).toBeGreaterThan(start_time.getTime() - 2)


    // we should have a row "Updated # prediction records" somewhere in the last few entries
    let found_message = false
    for (r of rows_after[0]){
      let msg =  (r.meta.message).toString()
      if (msg.match(/^Updated.*records/ )) {
        found_message = true
        break;
      }
    }

    expect(found_message).toBeTruthy()

  })

})
