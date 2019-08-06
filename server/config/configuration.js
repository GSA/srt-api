const env = process.env.NODE_ENV || 'development'
const config = require('../config/config')[env]
const {common} = require('../config/config.js')


module.exports = {
  "getConfig": (name) => {
    if (process.env[name]) {
      return process.env[name]
    }
    if (config[name]) {
      return config[name]
    }
    if (common[name]) {
      return common[name]
    }
    return null
  }
}


