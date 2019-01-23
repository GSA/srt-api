//token pass
var jwt = require('jsonwebtoken');
const logger = require('../config/winston');

module.exports = function() {
  return async function (req, res, next) {
      let failed = true;
      let token = "-no token-";

      try {
          if (req.headers.hasOwnProperty('authorization')) {
              token = req.headers['authorization'].split(' ')[1];
              if (token != 'null') {
                  let decoded = jwt.verify(token, 'innovation');  // will thrown an error on an invalid token
                  var current = jwt.decode(token).user;
                  failed = false;
                  next();
              }
          } else {
              failed = true;
          }

      } catch (err) {
          // this will be logged in the if (failed) block
          //logger.log("error", err, {tag:"token check error 2"});
      }

      if (failed) {
          logger.log("info", "failed token check for token " + token);
          return res.status(401).send({
              success: false,
              message: 'Unauthorized'
          });
      }

  }
}
