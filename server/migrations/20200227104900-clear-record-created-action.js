'use strict'
const migrationUtils = require('../migrationUtil')

// This migration is to force a rebuild of the Predictions table to update
// the auto generated Record Created action status to be Solicitation Posted

let upSql = [
  'delete from "Predictions" where action::TEXT like \'%Record Created%\' ;'
]

let downSql = [
  ""
]


module.exports = migrationUtils.migrateUpDown(upSql, downSql)
