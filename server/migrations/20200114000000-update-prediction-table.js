'use strict'
const migrationUtils = require('../migrationUtil')

// This migration is to force a rebuild of the Predictions table

let upSql = [
  'delete from "Predictions"'
]

let downSql = [
]


module.exports = migrationUtils.migrateUpDown(upSql, downSql)
