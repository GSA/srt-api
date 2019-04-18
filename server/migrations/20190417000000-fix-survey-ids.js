'use strict'
const migrationUtils = require('../migrationUtil')

let upSql = [
  'update "Surveys" set id = id-1;'
]

let downSql = [
]

module.exports = migrationUtils.migrateUpDown(upSql, downSql)
