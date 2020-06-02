const env = process.env.NODE_ENV || 'development'
const config = require('../config/config')[env]
const {common} = require('../config/config.js')
const logger = require('../config/winston')

/**
 * True if the input string is valid JSON
 *
 * @param {string} s
 * @return {boolean}
 */
function isJSON(s) {
  try {
    JSON.parse(s)
  } catch (e) {
    return false;
  }
  return true
}

/**
 * Look for the key in any of our configuration repositories.  Priority is:
 *   1) extraDictionary
 *   2) environment variables
 *   3) env specific config file
 *   4) common config file
 *
 * @param {string} key Key to lookup in the configuration
 * @param defaultValue Default value if the key isn't found anywhere
 * @param {Object} extraDictionary Extra dictionary to use when looking for the key
 * @return {string|*}
 */
function lookup(key, defaultValue, extraDictionary) {
  if (extraDictionary == null) {
    extraDictionary = {}
    logger.log("warn", "got a null value for the extraDictionary parameter", {tag:'lookup', key: key, defaultValue: defaultValue})
  }

  if (key in extraDictionary) {
    return extraDictionary[key]
  }
  if (key in process.env) {
    return process.env[key]
  }
  if (key in config) {
    return config[key]
  }
  if (key in common) {
     return common[key]
  }
  return defaultValue
}

/**
 * Look for the key in any of our configuration repositories.  Priority is:
 *   1) extraDictionary
 *   2) environment variables
 *   3) env specific config file
 *   4) common config file
 *
 * The key will be split on any : characters to signify nested config entries
 *
 * @param {string} key
 * @param defaultValue
 * @param {Object} customDictionary
 * @return {string|*}
 */
function getConfig(key, defaultValue, customDictionary = null) {
  if (typeof key !== "string") {
    return defaultValue
  }
  // split on :
  let parts = key.split(":")
  let dict = customDictionary || {}
  while (parts.length > 1) {
    let head = parts.shift()
    dict = lookup(head, defaultValue, dict)
    dict = (isJSON(dict)) ? JSON.parse(dict) : dict
  }
  return lookup(parts[0], defaultValue, dict)
}

module.exports = {
  "getConfig": getConfig
}


