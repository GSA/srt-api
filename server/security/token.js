//token pass
var jwt = require('jsonwebtoken');
const logger = require('../config/winston');

module.exports = function() {
  return async function (req, res, next) {

    try {
      let failed = false;
      if (req.headers.hasOwnProperty('authorization')) {
        var token = req.headers['authorization'].split(' ')[1];
        if (token != 'null') {
          jwt.verify(token, 'innovation', function (err, decoded) {
            if (err) {
              failed = true;
            } else {
              var current = jwt.decode(token).user;
              next();
            }
          });
        }
      } else {
        failed = true;
      }

      if (failed) {
        return res.status(401).send({
          success: false,
          message: 'Unauthorized'
        });
      }
    } catch (e) {
      logger.log("error", e, {tag: "token check function"});
    }

  }
}
