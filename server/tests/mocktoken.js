//token pass
var jwt = require('jsonwebtoken');


module.exports = function(user) {
    return jwt.sign({user: user}, 'innovation', {expiresIn: 7200}); // token is good for 2 hours
}
