let winston = require('winston')
let expressWinston = require('express-winston')
const express = require('express')
const bodyParser = require('body-parser')
let cors = require('cors')
let token = require('./security/token')
const admin_only = require('./security/admin.only')
const env = process.env.NODE_ENV || 'development'
const config = require('./config/config.js')[env]
const {common} = require('./config/config.js')
const session = require('express-session')
const CASAuthentication = require('cas-authentication')
const jwtSecret = common.jwtSecret || undefined
const {getConfig} = require('./config/configuration')
const logger = require('./config/winston')

if (! jwtSecret) {
  console.log("No JWT secret defined.  Be sure to set JWT_SECRET in the environment before running startup") // allowed output
  process.exit(1)
}

//
// Setup ORM
//
module.exports = function (db, cas) {
  let app = express()

  app.disable('x-powered-by');

  if (db === undefined) {
    db = require('./models/index')
  }
  // noinspection JSUndefinedPropertyAssignment
  app.db = db

  if ( ! cas ) {
    let casConfig = config['maxCas']
    casConfig.dev_mode_info = common['casDevModeData']
    cas = new CASAuthentication(casConfig)
  }

  let authRoutes = require('./routes/auth.routes')
  let userRoutes = require('./routes/user.routes')
  let emailRoutes = require('./routes/email.routes')
  let agencyRoutes = require('./routes/agency.routes')
  let predictionRoutes = require('./routes/prediction.routes')
  let analyticsRoutes = require('./routes/analytics.routes')
  let solicitationRoutes = require('./routes/solicitation.routes')(db, userRoutes)
  let surveyRoutes = require('./routes/survey.routes')
  let versionRoutes = require('./routes/version.routes')()
  let noticeTypeRoutes = require('./routes/noticeType.routes')
  let adminReportRoutes = require('./routes/admin.report.routes')

  app.use(bodyParser.json())

  // setup CORS
  function corsTest (origin, callback) {
    if (origin === undefined || common.CORSWhitelist.indexOf(origin) !== -1) {
      callback(null, true)
    } else {
      logger.log('warn', 'Request from origin ' + origin + ' not allowed by CORS.', { tag: 'CORS' })
      callback(new Error('Not allowed by CORS'))
    }
  }
  app.corsTest = corsTest
  app.use(cors({ origin: corsTest }));

  if (env === 'development') {
    expressWinston.requestWhitelist.push('body')
  }

  let transports = [ new winston.transports.File({ filename: 'winston.log.json', level: 'debug' }) ]
  // Don't log to stdout when running tests
  if (config['logStdOut'] && process.env.JEST_WORKER_ID === undefined) {
    transports.push(new winston.transports.Console({ level: 'debug', json: true }))
  }

  app.use(expressWinston.logger({
    transports: transports,
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
    winstonInstance: logger,
    meta: true,
    // msg: "HTTP {{req.method}} {{req.url}} ",
    msg: function (req, res) {
      let jwt = require('jsonwebtoken')

      let token = null
      let user = { id: null, position: null, userRole: null, email: null }
      if (req.headers['authorization'] && req.headers['authorization'].length > 0) {
        try {
          token = req.headers['authorization'].split(' ')[1]
          let decoded = jwt.verify(token, common.jwtSecret)
          user = (decoded.user) ? decoded.user : user; // make sure we got something to prevent crash below
        } catch (e) {
          user.id = 'Caught error decoding JWT'
        }
      }
      return `${req.method} ${req.url} ${res.statusCode} ${res.responseTime}ms ${user.id} ${user.email} ${user.position} ${user.userRole}`
    },
    responseWhitelist: ['_headers', 'statusCode'],
    expressFormat: false,
    colorize: false,
    ignoreRoute: function () {
      return false
    },
    requestFilter: function (req, propName) {
      if (propName === 'password' || propName === 'tempPassword') {
        return '********'
      } else {
        return req[propName]
      }
    }
  }))

  app.use((req,res,next)=>{
    res.set('Cache-Control', 'no-store')
    next()
  })

  // The server is usually behind a proxy.
  // Setting trust proxy signals that the connection is essentially https even though the actual local protocol
  // is http.  Modules like express-session will work with this setting
  app.set('trust proxy', 1)

  app.use( session({
    secret            : common.jwtSecret,
    resave            : false,
    saveUninitialized : true,
    cookie            : {
      sameSite : 'lax',
      secure: getConfig('sessionCookieSecure', true)  }
  }));

  // This will prevent express from sending 304 responses.
  app.use(function (req, res, next) {
    req.headers['if-none-match'] = 'no-match-for-this'
    next()
  })

  app.get('/api/agencies', token(), agencyRoutes.getAgency)
  app.put('/api/agencies', token(), agencyRoutes.putAgency)
  app.get('/api/agencyList', token(), agencyRoutes.agencyList)
  app.post('/api/analytics', token(), admin_only(), analyticsRoutes.analytics)
  app.post('/api/Analytics', token(), admin_only(), analyticsRoutes.analytics)
  app.post('/api/auth/tokenCheck', authRoutes.tokenCheck)
  app.get('/api/casLogin', cas.bounce, authRoutes.casStage2)
  app.post('/api/email', token(), emailRoutes.email)
  app.post('/api/predictions/filter', token(), predictionRoutes.predictionFilter)
  app.get('/api/renewToken', token(), authRoutes.renewToken)
  app.post('/api/solicitation', token(), solicitationRoutes.postSolicitation)
  app.get('/api/solicitation/:id', token(), solicitationRoutes.get)
  app.post('/api/solicitation/:id', token(), solicitationRoutes.update)
  app.post('/api/feedback', token(), solicitationRoutes.solicitationFeedback)
  app.get('/api/surveys', token(), surveyRoutes.get)
  app.post('/api/user/filter', token(), userRoutes.filter)
  app.get('/api/user/getUserInfo', token(), userRoutes.getUserInfo)
  app.post('/api/user/updateUserInfo', token(), userRoutes.update)
  app.post('/api/user/update', token(), userRoutes.update)
  app.post('/api/user/updatePassword', token(), userRoutes.updatePassword)
  app.post('/api/user/getUserInfo', token(), userRoutes.getUserInfo)
  app.get('/api/user/masquerade', token(), admin_only(), userRoutes.masquerade)
  app.get('/api/version', versionRoutes.version)
  app.get('/api/noticeTypes', token(), noticeTypeRoutes.getNoticeTypes)

  app.get('/api/reports/login', token(), admin_only(), adminReportRoutes.userLogin)
  app.get('/api/reports/feedback', token(), admin_only(), adminReportRoutes.feedback)





  app.use(expressWinston.errorLogger({
    transports: transports,
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
    meta: true,
    // msg: "HTTP {{req.method}} {{req.url}} ",
    msg: function (req, res) {
      let jwt = require('jsonwebtoken')

      let token = null
      let user = { id: null, position: null, userRole: null, email: null }
      if (req.headers['authorization'] && req.headers['authorization'].length > 0) {
        token = req.headers['authorization'].split(' ')[1]
        let decoded = jwt.verify(token, common.jwtSecret)
        user = decoded.user
      }
      return `ERROR - ${req.method} ${req.url} ${res.statusCode} ${res.responseTime}ms ${user.id} ${user.email} ${user.position} ${user.userRole}`
    },
    expressFormat: false,
    colorize: false,
    ignoreRoute: function () {
      return false
    },
    requestFilter: function (req, propName) {
      if (propName === 'password') {
        return '********'
      } else {
        return req[propName]
      }
    }
  }))

  return app
}


