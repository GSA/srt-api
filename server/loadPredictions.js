const env = process.env.NODE_ENV || 'development'
const config = require('./config/config.js')[env]
const app = require('./app')()
// noinspection JSUnresolvedVariable
const port = config.srt_server.port
const {cleanAwardNotices} = require('./cron/noticeAwardCleanup')
let predictionRoutes = require('./routes/prediction.routes')

let clearAfterDate = (process.argv.length > 2 && process.argv[2] === '--fast') ? false : process.argv[2]


// Run this cron job function first since it will clean up the db
cleanAwardNotices()

async function update () {
    let updateCount = await predictionRoutes.updatePredictionTable(clearAfterDate)
    console.log(`${updateCount} solicitations updated so far.`)
    if (updateCount < 10) {
        console.log("loadPredications.js complete")
        process.exit(0)
    } else {
        setTimeout( update, config.updatePredictionTableMaxRunTime || 10)
    }
}

console.log("Updating.....")
update();



