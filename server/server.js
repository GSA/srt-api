const env = process.env.NODE_ENV || 'development'
const config = require('./config/config.js')[env]
const { app, clientPromise } = require('./app');
const appInstance = app(); // If the function requires parameters, pass them here.

const db = require('./models')
// noinspection JSUnresolvedVariable
const port = config.srt_server.port


db.sequelize.sync().then(() => {
  appInstance.listen(port, '0.0.0.0',() => {
    console.log(`Started up at port ${port}`) // allowed output
  })
});

module.exports = appInstance
