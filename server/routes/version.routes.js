const env = process.env.NODE_ENV || 'development';
const config = require(__dirname + '/../config/config.json')[env];
const version_info = require('../version.json')


/**
 * register
 */
module.exports = () =>  {
    let info = Object.assign({env: env}, version_info);;
    return {
        version: function create(req, res) {
            return res.status(200).send(info);
        }
    };
}
