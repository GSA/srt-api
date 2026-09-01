let winston = require('winston')
let expressWinston = require('express-winston')
const express = require('express')
const bodyParser = require('body-parser')
let cors = require('cors')
let token = require('./security/token')
const admin_only = require('./security/admin.only')
const env = process.env.NODE_ENV || 'development'
const config = require('./config/config.js')[env]
const { common } = require('./config/config.js')
const session = require('express-session')
const MemoryStore = require('memorystore')(session)
const CASAuthentication = require('cas-authentication')
const jwtSecret = common.jwtSecret || undefined
const { getConfig } = require('./config/configuration')
const logger = require('./config/winston')
const { cleanAwardNotices } = require('./cron/noticeAwardCleanup')
const { CronJob } = require('cron')
const pg = require('pg');
const querystring = require('querystring');
const ragRoutesFactory = require('./routes/rag.routes');
const ragAnalyticsRoutesFactory = require('./routes/rag-analytics.routes');
const adminAgencyRoutesFactory = require('./routes/admin.agency.routes');
const adminEmailTemplateRoutesFactory = require('./routes/admin.email.templates.routes');
const adminManagementRoutesFactory = require('./routes/admin.management.routes');

const { Issuer, Strategy, generators } = require('openid-client');

const dbConfig = require('./config/dbConfig')[env]


const pgPool = new pg.Pool({
  database: dbConfig.database,
  user: dbConfig.username,
  password: dbConfig.password,
  host: dbConfig.host,
  port: dbConfig.port,
  ssl: env !== 'development' ? { rejectUnauthorized: false } : false
});




if (!jwtSecret) {
  console.log("No JWT secret defined.  Be sure to set JWT_SECRET in the environment before running startup") // allowed output
  process.exit(1)
}

function setupCronJobs() {

  if (process.env.JEST_WORKER_ID == null || process.env.JEST_WORKER_ID == undefined) {
    const noticeAwardJob = new CronJob('20 6 * * *', cleanAwardNotices)
    noticeAwardJob.start()
    // also run the cleanAwardNotices function once on startup!
    cleanAwardNotices()
    logger.log("debug", "Completed cron setup")
  } else {
    logger.log("debug", "Found a JEST_WORKER_ID in the environment so skipping cron start")
  }
}

let login_gov_auth_url

let loginGovClient = Issuer.discover(config['login_gov_oidc']['issuer_url'])
  .then(function (oidcIssuer) {


    const nonce = generators.nonce();

    const state = generators.state();

    const params = {
      acr_values: 'http://idmanagement.gov/ns/assurance/ial/1',
      client_id: config['login_gov_oidc']["client_id"],
      prompt: 'select_account',
      nonce: nonce,
      state: state,
      redirect_uri: config['login_gov_oidc']["redirect_uri"],
      // all_emails is required for getGovernmentEmail() in auth.routes.js to
      // work. Without it Login.gov returns only the account's primary email, so
      // a user whose primary is personal (gmail) but who also holds a verified
      // .gov address arrives as the personal address and resolves to the wrong
      // agency. This is why getGovernmentEmail has always received an empty
      // array despite being correctly implemented and wired in.
      scope: "openid email all_emails profile",
    }

    const client = new oidcIssuer.Client({
      client_id: config['login_gov_oidc']["client_id"],
      response_type: 'code',
      params
    });

    login_gov_auth_url = client.authorizationUrl(params);

    return client;

  });

//
// Setup ORM
//
module.exports = {

  app: function (db, cas) {
    let app = express()

    app.disable('x-powered-by');

    // Pen Test Finding #1: Add HSTS header (OTG-CONFIG-007)
    app.use((req, res, next) => {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
      next();
    });

    // Pen Test Finding #4: Remove information disclosure headers (OTG-INFO-009)
    app.use((req, res, next) => {
      res.removeHeader('X-Powered-By');
      res.removeHeader('Server');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
      next();
    });

    if (db === undefined) {
      db = require('./models/index')
    }
    // noinspection JSUndefinedPropertyAssignment
    app.db = db

    if (!cas) {
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
    let documentRoutes = require('./routes/document.routes')

    app.use(bodyParser.json({ limit: '50mb' }))

    // setup CORS (Pen Test Finding #3: Tighten CORS origin handling - OTG-CLIENT-007)
    function corsTest(origin, callback) {
      if (env !== 'production') {
        // Allow all CORS origins in development for smoother local testing across various ports (4200, 8090, 3000, 127.0.0.1)
        callback(null, true);
        return;
      }

      if (origin === undefined) {
        // Requests with no Origin header (server-to-server, same-origin)
        callback(null, false)
      } else if (common.CORSWhitelist.indexOf(origin) !== -1) {
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

    let transports = [new winston.transports.File({ filename: 'winston.log.json', level: 'debug' })]
    // Don't log to stdout when running tests
    if (config['logStdOut'] && process.env.JEST_WORKER_ID === undefined) {
      transports.push(new winston.transports.Console({ level: getConfig("logStdOutLevel", "info"), json: true }))
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
            logger.log("error", "Caught error decoding JWT.", { "tag": "log", "error": e })
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

    app.use((req, res, next) => {
      res.set('Cache-Control', 'no-store')
      next()
    })

    // The server is usually behind a proxy.
    // Setting trust proxy signals that the connection is essentially https even though the actual local protocol
    // is http.  Modules like express-session will work with this setting
    app.set('trust proxy', 1)

    app.use(session({
      secret: common.jwtSecret,
      resave: false,
      saveUninitialized: false,
      store: new MemoryStore({
        checkPeriod: 86400000 // prune expired entries every 24h
      }),
      cookie: {
        maxAge: 60000 * 60, // One Hour
        httpOnly: true,
        sameSite: 'lax',
        secure: getConfig('sessionCookieSecure', true)
      }
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
    app.get("/api/login", (req, res) => {
      res.redirect(login_gov_auth_url);
    });
    app.get("/api/logout", (req, res) => {

      const logoutEndPoint = config['login_gov_oidc']['logout_endpoint']

      const params = {
        client_id: config['login_gov_oidc']['client_id'],
        post_logout_redirect_uri: config['srtClientUrl'] + '/auth',
      }

      res.redirect(logoutEndPoint + '?' + querystring.stringify(params))

    });
    // Login.gov Failure to Proof URL: 
    // For users who are unable to complete identity proofing and returning to the app
    app.get("odic/failure", (req, res) => {
      return res.status(302)
        .set('Location', config['srtClientUrl'] + '/auth') // send them back with no token
        .send(`<html lang="en"><body>Identity Login Failure</body></html>`)
    });
    app.get("/odic/callback", authRoutes.grabToken);
    app.post('/api/auth/tokenCheck', authRoutes.tokenCheck)
    app.get('/api/casLogin', cas.bounce, authRoutes.casStage2)
    app.get('/api/devLogin', authRoutes.devLogin)
    app.post('/api/email', token(), emailRoutes.email)
    app.post('/api/predictions/filter', token(), predictionRoutes.predictionFilter)
    app.get('/api/renewToken', token(), authRoutes.renewToken)
    app.post('/api/solicitation', token(), solicitationRoutes.postSolicitation)
    app.get('/api/solicitation/:id', token(), solicitationRoutes.get)
    app.post('/api/solicitation/:id', token(), solicitationRoutes.update)
    app.post('/api/solicitation/art/:id', token(), solicitationRoutes.postArtLanguage)
    // /api/feedback is mounted below by the new feedback.routes module, which
    // handles all three sources (manual_upload, solicitation_detail, contact_us).
    // The previous duplicate registration here ran the legacy handler first and
    // returned 500 for Contact Us submissions ("Failed to send message").
    app.get('/api/surveys', token(), surveyRoutes.getSurveyQuestions)
    app.get('/api/surveys/:solNum', token(), surveyRoutes.get)
    app.post('/api/surveys/:solNum', token(), surveyRoutes.postResponse)
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
    app.get('/api/reports/solicitationDownloads', token(), admin_only(), adminReportRoutes.solicitationDownloads)
    app.get('/api/reports/predictionMetrics', token(), admin_only(), adminReportRoutes.predictionReport)
    app.get('/api/reports/noticeTypeChangeReport', token(), admin_only(), adminReportRoutes.noticeTypeChangeReport)
    app.use('/api', documentRoutes)

    // Admin Management Routes (user CRUD, analytics, audit, health)
    const adminMgmt = adminManagementRoutesFactory(pgPool)
    app.get('/api/admin/users', token(), admin_only(), adminMgmt.listUsers)
    app.put('/api/admin/users/:id', token(), admin_only(), adminMgmt.updateUser)
    app.put('/api/admin/users/:id/toggle-status', token(), admin_only(), adminMgmt.toggleUserStatus)
    app.put('/api/admin/users/bulk-deactivate', token(), admin_only(), adminMgmt.bulkDeactivate)
    app.get('/api/admin/audit-log', token(), admin_only(), adminMgmt.getAuditLog)
    app.get('/api/admin/analytics/overview', token(), admin_only(), adminMgmt.getAnalyticsOverview)
    app.get('/api/admin/analytics/feature-usage', token(), admin_only(), adminMgmt.getFeatureUsage)
    app.get('/api/admin/system-health', token(), admin_only(), adminMgmt.getSystemHealth)
    app.get('/api/admin/scheduled-pipeline-stats', token(), admin_only(), adminMgmt.getScheduledPipelineStats)
    app.get('/api/admin/system-logs', token(), admin_only(), adminMgmt.getSystemLogs)
    app.get('/api/admin/overview', token(), admin_only(), adminMgmt.getOverview)
    app.get('/api/admin/last-logins', token(), admin_only(), adminMgmt.getLastLogins)
    app.get('/api/admin/agencies', token(), admin_only(), adminMgmt.listAgencies)

    // Agency hierarchy, domain mapping, solicitation access, and deviation
    // inheritance. Everything here previously required a config change and a
    // deploy. Admin only: these edits change who can see which solicitations.
    const adminAgency = adminAgencyRoutesFactory(pgPool)
    app.get('/api/admin/agency-management', token(), admin_only(), adminAgency.listAgencyManagement)
    app.post('/api/admin/agencies', token(), admin_only(), adminAgency.createAgency)
    app.put('/api/admin/agencies/:id', token(), admin_only(), adminAgency.updateAgency)
    app.put('/api/admin/agencies/:id/scope', token(), admin_only(), adminAgency.setSolicitationScope)
    app.put('/api/admin/agencies/:id/deviation', token(), admin_only(), adminAgency.setDeviationSource)
    app.post('/api/admin/agency-domains', token(), admin_only(), adminAgency.createDomain)
    app.put('/api/admin/agency-domains/:id', token(), admin_only(), adminAgency.updateDomain)
    app.delete('/api/admin/agency-domains/:id', token(), admin_only(), adminAgency.deleteDomain)
    app.get('/api/admin/needs-review', token(), admin_only(), adminAgency.listNeedsReview)
    app.post('/api/admin/needs-review/resolve', token(), admin_only(), adminAgency.resolveNeedsReview)

    // Admin email templates. Previously a hardcoded array in the Angular
    // component, so a template could be edited for one send but never saved.
    const adminEmailTemplates = adminEmailTemplateRoutesFactory(pgPool)
    app.get('/api/admin/email-templates', token(), admin_only(), adminEmailTemplates.list)
    app.post('/api/admin/email-templates', token(), admin_only(), adminEmailTemplates.create)
    app.put('/api/admin/email-templates/:id', token(), admin_only(), adminEmailTemplates.update)
    app.delete('/api/admin/email-templates/:id', token(), admin_only(), adminEmailTemplates.remove)
    app.post('/api/analytics/track', token(), adminMgmt.trackEvent)
    app.post('/api/analytics/track-batch', token(), adminMgmt.trackBatch)
    app.post('/api/admin/send-bulk-email', token(), admin_only(), adminMgmt.sendBulkEmail)

    // Feedback Routes
    const feedbackRoutes = require('./routes/feedback.routes')(pgPool)
    app.post('/api/feedback', token(), feedbackRoutes.submitFeedback)
    app.get('/api/admin/feedback', token(), admin_only(), feedbackRoutes.listFeedback)
    app.put('/api/admin/feedback/:id/status', token(), admin_only(), feedbackRoutes.updateFeedbackStatus)

    // RAG Analysis routes (no token auth for dev)
    const ragRoutes = ragRoutesFactory(pgPool)
    app.get('/api/rag/solicitations', ragRoutes.listSolicitations)
    app.get('/api/rag/solicitation/:solNum', ragRoutes.getSolicitation)
    app.get('/api/rag/solicitation/:solNum/documents', ragRoutes.getDocuments)
    app.get('/api/rag/solicitation/:solNum/matches', ragRoutes.getMatches)

    // Pipeline V2 (Laura's prompts)
    const pipelineV2Routes = require('./routes/pipeline-v2.routes')(pgPool)
    app.post('/api/pipeline-v2/analyze', pipelineV2Routes.analyze)

    // Pipeline V4 (BM25 Gatekeeper — David's)
    const pipelineV4Routes = require('./routes/pipeline-v4.routes')(pgPool)
    // token() is required: this endpoint runs a chain of LLM calls per request,
    // so leaving it open let anyone on the internet spend the USAI budget. The
    // handler's emailFromReq() only attributes drafts — it never rejects.
    app.post('/api/pipeline-v4/analyze', token(), pipelineV4Routes.analyze)

    // My Drafts — per-user auto-saved manual-upload analyses with version
    // history. Owner-scoped via the JWT; no admin listing by design.
    const draftsRoutes = require('./routes/drafts.routes')(pgPool)
    app.get('/api/drafts', token(), draftsRoutes.list)
    app.get('/api/drafts/:id', token(), draftsRoutes.get)
    app.delete('/api/drafts/:id', token(), draftsRoutes.remove)

    // Advanced RAG Analytics Routes for Dashboarding
    const ragAnalyticsRoutes = ragAnalyticsRoutesFactory(pgPool)
    app.get('/api/rag-analytics/tri-state', ragAnalyticsRoutes.getTriState)
    app.get('/api/rag-analytics/posture', ragAnalyticsRoutes.getPosture)
    app.get('/api/rag-analytics/ict-taxonomy', ragAnalyticsRoutes.getIctTaxonomy)
    app.get('/api/rag-analytics/document-intelligence', ragAnalyticsRoutes.getDocumentIntelligence)
    app.get('/api/rag-analytics/vector-violations', ragAnalyticsRoutes.getVectorViolations)
    app.get('/api/rag-analytics/agency-leaderboard', ragAnalyticsRoutes.getAgencyLeaderboard)

    app.get('/api/rag-analytics/playground/status', ragAnalyticsRoutes.getPlaygroundStatus)
    app.get('/api/rag-analytics/adhoc-usage', ragAnalyticsRoutes.getAdhocUsage)
    app.get('/api/rag-analytics/stages', ragAnalyticsRoutes.listStages)
    app.post('/api/rag-analytics/stages', ragAnalyticsRoutes.saveStage)
    app.delete('/api/rag-analytics/stages/:stageId', ragAnalyticsRoutes.deleteStage)
    app.post('/api/rag-analytics/stages/generate-examples', ragAnalyticsRoutes.generateExamples)
    app.get('/api/rag-analytics/pipelines', ragAnalyticsRoutes.listPipelines)
    app.post('/api/rag-analytics/pipelines', ragAnalyticsRoutes.savePipeline)
    app.delete('/api/rag-analytics/pipelines/:templateId', ragAnalyticsRoutes.deletePipeline)
    app.get('/api/rag-analytics/playground/list-models', ragAnalyticsRoutes.listPlaygroundModels)
    app.post('/api/rag-analytics/playground/test-completion', ragAnalyticsRoutes.testPlaygroundCompletion)
    app.post('/api/rag-analytics/playground/test-embeddings', ragAnalyticsRoutes.testPlaygroundEmbeddings)
    app.post('/api/rag-analytics/playground/package-synthesis', ragAnalyticsRoutes.packageSynthesis)
    app.post('/api/rag-analytics/playground/execute-pipeline', ragAnalyticsRoutes.executePipeline)
    app.post('/api/rag-analytics/playground/execute-stage', ragAnalyticsRoutes.executeStage)
    app.post('/api/rag-analytics/playground/generate-prompt', ragAnalyticsRoutes.generatePrompt)
    app.post('/api/rag-analytics/playground/analyze', ragAnalyticsRoutes.playgroundAnalyze)
    app.post('/api/rag-analytics/art-lookup', token(), ragAnalyticsRoutes.artLookup)

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
          try {
            token = req.headers['authorization'].split(' ')[1]
            let decoded = jwt.verify(token, common.jwtSecret)
            user = (decoded.user) ? decoded.user : user
          } catch (e) {
            user.id = 'Caught error decoding JWT in error logger'
          }
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

    setupCronJobs()

    return app
  },

  clientPromise: loginGovClient
};
