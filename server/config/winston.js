const path = require('path')
const env = process.env.NODE_ENV || 'development'
const config = require(path.join(__dirname, '/../config/config.json'))[env]

let winston = require('winston')
let options = {

  transports: [
    new winston.transports.File({ filename: 'winston.log.json', level: 'debug' })
  ],
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.prettyPrint()
  ),
  meta: true,
  exitOnError: false,
  requestFilter: function (req, propName) {
    if (propName === 'password') {
      return '********'
    } else {
      return req[propName]
    }
  }
}

if (config['logStdOut']) {
  options.transports.push(new winston.transports.Console({ level: 'debug', json: true }))
}

let logger = winston.createLogger(options)

// logger.info("starting winston");

module.exports = logger
