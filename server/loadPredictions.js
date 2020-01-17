const env = process.env.NODE_ENV || 'development'
const config = require('./config/config.js')[env]
const app = require('./app')()
// noinspection JSUnresolvedVariable
const port = config.srt_server.port

let predictionRoutes = require('./routes/prediction.routes')

predictionRoutes.updatePredictionTable()
  .then( () => {
    // process.exit(0)
  })

