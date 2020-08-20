const db = require('../models/index')
const {getConfig} = require('../config/configuration')
const predictionRoutes = require('../routes/prediction.routes')
const mockToken = require('./mocktoken')
const { userAcceptedCASData } = require('./test.data')
const moment = require('moment')
let jwt = require('jsonwebtoken')
const logger = require('../config/winston')
const authRoutes = require('../routes/auth.routes')


describe('Log testing', () => {

  // Because the logger is in a different transaction space than Sequelize, I haven't figured out how to make a
  // reliable unit test for this.
  test.skip('log entries are appearing in the database', async () => {
    let myUser = Object.assign({}, userAcceptedCASData)
    delete myUser.id
    let start_time = new Date()
    const token = await mockToken(myUser, getConfig('jwtSecret'))

    let fullUser = jwt.decode(token).user

    let rows = await db.sequelize.query(`select timestamp from winston_logs order by timestamp desc limit 1 `)
    let time_before = (rows[0][0]) ? rows[0][0].timestamp : new Date()

    let date = moment(time_before).format('YYYY-MM-DD:HH:mm:ss Z')//?

    // this will generate a new log entry at the 'info' level which should be saved in the database
    await authRoutes.createOrUpdateMAXUser({})

    let rows_after = await db.sequelize.query(`select * from winston_logs where timestamp > '${date}'::timestamp - interval '100 seconds' order by timestamp desc`)
    let t_after = (rows_after[0][0]) ? rows_after[0][0].timestamp : new Date()
    let t_after_milli = BigInt(t_after.getTime() + '' + t_after.getMilliseconds()) //?
    let t_before_milli = BigInt (time_before.getTime() + '' + time_before.getMilliseconds()) //?
    let start_time_milli = BigInt (start_time.getTime() + '' + start_time.getMilliseconds()) //?

    expect(t_after_milli).toBeGreaterThan(t_before_milli)
    expect(t_after_milli).toBeGreaterThan(start_time_milli)


    // we should have a row "Trying to make a token without a MAX ID" somewhere in the last few entries
    let found_message = false
    for (r of rows_after[0]){
      let msg =  (r.meta.message).toString()
      if (msg.match(/Trying to make a token without a MAX ID/ )) {
        found_message = true
        break;
      }
    }

    expect(found_message).toBeTruthy()

  })

})
