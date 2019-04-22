const env = process.env.NODE_ENV || 'development'
const config = require('./config/config.json')[env]
const app = require('./app')()
// noinspection JSUnresolvedVariable
const port = config.srt_server.port

app.listen(port, () => {
  console.log(`Started up at port ${port}`)
})

module.exports = app
