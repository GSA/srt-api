require('./config/config.js');
var winston = require('winston')
var expressWinston = require('express-winston');
const express = require('express');
const bodyParser = require('body-parser');
var cors = require('cors');
var token = require('./security/token');
const env = process.env.NODE_ENV || 'development';
const config = require(__dirname + '/config/config.json')[env];
//const db = require('./models/index');







//
// Setup ORM
//
module.exports = function(db) {
    var app = express();
    if (db == undefined) {
        db = require('./models/index');
    }


    var authRoutes = require('./routes/auth.routes');
    var userRoutes = require('./routes/user.routes');
    var emailRoutes = require('./routes/email.routes');
    var agencyRoutes = require('./routes/agency.routes');
    var predictionRoutes = require('./routes/prediction.routes');
    var analyticsRoutes = require('./routes/analytics.routes');
    var solicitationRoutes = require('./routes/solicitation.routes') (db);
    var surveyRoutes = require('./routes/survey.routes');
    var versionRoutes = require('./routes/version.routes') ();


    app.use(bodyParser.json());
    app.use(cors());

    if (env == 'development' || env == 'sqlite') {
        expressWinston.requestWhitelist.push('body');
    }

    app.use(expressWinston.logger({
        transports: [new winston.transports.File({filename: "winston.log.json", level: "debug"})],
        // format: winston.format.combine(winston.format.colorize(), winston.format.json()),
        format: winston.format.prettyPrint(),
        meta: true,
        // msg: "HTTP {{req.method}} {{req.url}} ",
        msg: function (req, res) {
            let jwt = require('jsonwebtoken');

            let token = null;
            let user = {id: null, position: null, userRole: null, email: null};
            if (req.headers['authorization'] && req.headers['authorization'].length > 0) {
                try {
                    token = req.headers['authorization'].split(' ')[1];
                    let decoded = jwt.verify(token, 'innovation');
                    user = decoded.user;
                } catch (e) {
                    user.id = "Caught error decoding JWT";
                }
            }
            let post_data = JSON.stringify(req.body);
            let dt = new Date().toLocaleString();
            return `${dt} ${req.method} ${req.url} ${res.statusCode} ${res.responseTime}ms ${user.id} ${user.email} ${user.position} ${user.userRole}`;
        },
        expressFormat: false,
        colorize: false,
        ignoreRoute: function (req, res) {
            return false;
        },
        requestFilter: function (req, propname) {
            if (propname == "password" || propname == "tempPassword") {
                return "********";
            } else {
                return req[propname];
            }
        }
    }));

// This will prevent express from sending 304 responses.
// TODO: Maybe we can remove this for production when the site is working properly
    app.use(function (req, res, next) {
        req.headers['if-none-match'] = 'no-match-for-this';
        next();
    });

    app.post('/api/auth', authRoutes.create);
    app.post('/api/auth/login', authRoutes.login);
    app.post('/api/user/filter', token(), userRoutes.filter);
//app.get('/api/user/filtertest',  userRoutes.filter);
    app.get('/api/user/getUserInfo', token(), userRoutes.getUserInfo);
// app.get('/api/user/:userId', token(), userRoutes.getUserInfo);
    app.post('/api/user/updateUserInfo', token(), userRoutes.update);
    app.post('/api/user/update', token(), userRoutes.update);
// app.post('/api/user/:userId', token(), userRoutes.update);
    app.post('/api/user/updatePassword', token(), userRoutes.updatePassword);
    app.post('/api/user/getCurrentUser', token(), userRoutes.getCurrentUser);
    app.post('/api/user/getUserInfo', token(), userRoutes.getUserInfo);

    app.post('/api/auth/login', authRoutes.login);
    app.post('/api/auth/resetPassword', authRoutes.resetPasswordFake);
    app.post('/api/email/resetPassword', authRoutes.resetPassword);
    app.post('/api/auth/tokenCheck', authRoutes.tokenCheck);

    app.post('/api/email', token(), emailRoutes.email);
    app.post('/api/email/updatePassword', token(), emailRoutes.updatePassword);

    app.get('/api/agencies', agencyRoutes.getAgency)
    app.put('/api/agencies', agencyRoutes.putAgency)
    app.get('/api/agencyList', token(), agencyRoutes.agencyList);

    app.post('/api/predictions/filter', token(), predictionRoutes.predictionFilter);

    app.post('/api/analytics', token(), analyticsRoutes.analytics);
    app.post('/api/Analytics', token(), analyticsRoutes.analytics);

    app.post('/api/solicitation', token(), solicitationRoutes.postSolicitation);
    app.get('/api/solicitation/:id', token(), solicitationRoutes.get);
    app.post('/api/solicitation/feedback', token(), solicitationRoutes.solicitationFeedback);

    app.get('/api/surveys', token(), surveyRoutes.get);

    app.get('/api/version', versionRoutes.version)

    app.use(expressWinston.errorLogger({
        transports: [new winston.transports.File({filename: "winston.log.json", level: "debug"})],
        // format: winston.format.combine(winston.format.colorize(), winston.format.json()),
        format: winston.format.prettyPrint(),
        meta: true,
        // msg: "HTTP {{req.method}} {{req.url}} ",
        msg: function (req, res) {
            let jwt = require('jsonwebtoken');

            let token = null;
            let user = {id: null, position: null, userRole: null, email: null};
            if (req.headers['authorization'] && req.headers['authorization'].length > 0) {
                token = req.headers['authorization'].split(' ')[1];
                let decoded = jwt.verify(token, 'innovation');
                user = decoded.user;
            }
            let dt = new Date().toLocaleString();
            return `ERROR - ${dt} ${req.method} ${req.url} ${res.statusCode} ${res.responseTime}ms ${user.id} ${user.email} ${user.position} ${user.userRole}`;
        },
        expressFormat: false,
        colorize: false,
        ignoreRoute: function (req, res) {
            return false;
        },
        requestFilter: function (req, propname) {
            if (propname == "password") {
                return "********";
            } else {
                return req[propname];
            }
        }
    }));

    return app;
}
