var winston = require('winston')
var options = {

    transports: [
        new winston.transports.File({filename: "winston.log.json", level: "debug"}),
        new winston.transports.Console({level: "debug", json:true})
    ],
    format: winston.format.prettyPrint(),
    meta: true,
    exitOnError: false,
    requestFilter: function(req, propname) {
        if (propname == "password") {
            return "********";
        } else {
            return req[propname];
        }
    }
};

var logger = winston.createLogger(options);

logger.info("starting winston");

module.exports = logger;
