const env = process.env.NODE_ENV || 'development'
const config = require('../config/config.js')[env]

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

if (config['logStdOut']) {
  options.transports.push(new winston.transports.Console({ level: 'debug', json: true, colorize: false }))
}

let logger = winston.createLogger(options)

module.exports = logger
