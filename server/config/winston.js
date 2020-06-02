const env = process.env.NODE_ENV || 'development'
const config = require('../config/config.js')[env]
const Postgres = require('@albertcrowley/winston-pg-native')
const { stringify } = require('flatted/cjs');


const dbConfig = require('../config/dbConfig')[env]
let connectionString = 'postgres://' + dbConfig.username + ':' + dbConfig.password + '@' + dbConfig.host + ':' + dbConfig.port + '/' + dbConfig.database


let winston = require('winston')
let options = {

  transports: [
    new winston.transports.File({ filename: 'winston.log.json', level: 'debug', colorize: false })
  ],
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  meta: true,
  exitOnError: false,
  colorize: false,
  requestFilter: function (req, propName) {
    if (propName === 'password') {
      return '********'
    } else {
      return req[propName]
    }
  }
}

options.transports.push(
  new Postgres({
    connectionString,
    level: 'info',
    tableName: 'winston_logs'
  })
)


if (config['logStdOut'] ) {
  options.transports.push(
    new winston.transports.Console(
      {
        level: 'debug',
        json: true,
        colorize: false,

        // format this for cloud.gov log aggrigator (timestamp, level, message only)
        format: winston.format.printf( (info) => {
          let loggable = {
            timestamp: info.timestamp,
            message: info.message,
            level: info.level
          }

          // Check to see if this is a HTTP request log....if so, remove the bearer token
          if (info.meta && info.meta.req && info.meta.req.headers && info.meta.req.headers.authorization) {
            delete info.meta.req.headers.authorization
          }

          // add extra data to the end of the message
          for (let i in info) {
            if ( ! ['timestamp', 'level', 'message'].includes(i) ) {
              let value =  (typeof(info[i]) == 'string') ? info[i] : stringify(info[i])
              loggable.message += ` [ ${i} : ${value} ]`
            }
          }
          return stringify(loggable)
        })
      }))
}

let logger = winston.createLogger(options)

module.exports = logger
