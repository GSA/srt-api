//token pass
var jwt = require('jsonwebtoken');

module.exports = function() {
  return function (req, res, next) {
    if (req.headers.hasOwnProperty('authorization'))
    {
      var token = req.headers['authorization'].split(' ')[1];
      if (token != 'null')
      {
        jwt.verify(token, 'innovation', function(err, decoded) {
          if (err) {
            console.log ("fail");
            return res.status(401).send({
              success: false,
              message: 'Unauthorized'
            });
          } else {
            var current = jwt.decode(token).user;
            next();
          }
        });


      }
    }
  }
}
