const env = process.env.NODE_ENV || 'development'
const config = require('./config/config.js')[env]
const app = require('./app')()
// noinspection JSUnresolvedVariable
const port = config.srt_server.port

app.listen(port, '0.0.0.0',() => {
  console.log(`Started up at port ${port}`) // allowed output
})

module.exports = app
