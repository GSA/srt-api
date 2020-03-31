'use strict'
const migrationUtils = require('../migrationUtil')

// This migration is to force a rebuild of the Predictions table to update
// the auto generated Record Created action status to be Solicitation Posted

let upSql = [
  'ALTER TABLE winston_logs ALTER COLUMN message TYPE text'
]

let downSql = [
  "ALTER TABLE winston_logs ALTER COLUMN message TYPE varchar(255)"
]


module.exports = migrationUtils.migrateUpDown(upSql, downSql)
