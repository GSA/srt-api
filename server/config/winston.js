var winston = require('winston')
var options = {

    transports: [new winston.transports.File({filename: "winston.log", level: "info"})],
    format: winston.format.prettyPrint(),
    meta: true,
    exitOnError: false
};

var logger = winston.createLogger(options);

logger.info("starting winston");

module.exports = logger;
