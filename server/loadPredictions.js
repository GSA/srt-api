const env = process.env.NODE_ENV || 'development'
const config = require('./config/config.js')[env]
const app = require('./app')()
// noinspection JSUnresolvedVariable
const port = config.srt_server.port

let predictionRoutes = require('./routes/prediction.routes')

let clearAfterDate = (process.argv.length > 2 && process.argv[2] === '--fast') ? false : process.argv[2]

predictionRoutes.updatePredictionTable(clearAfterDate)
  .then( () => {
    // process.exit(0)
    console.log ("loadPredications.js complete")
    process.exit(0)
  })

