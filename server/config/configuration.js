const env = process.env.NODE_ENV || 'development'
const config = require('../config/config')[env]
const {common} = require('../config/config.js')


module.exports = {
  "getConfig": (name, defaultValue) => {
    if (name in process.env) {
      return process.env[name]
    }
    if (name in config) {
      return config[name]
    }
    if (name in common) {
      return common[name]
    }
    return defaultValue
  }
}


