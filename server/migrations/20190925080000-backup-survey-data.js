'use strict'
const migrationUtils = require('../migrationUtil')

let upSql = [
  'CREATE TABLE survey_backup AS TABLE "Surveys"'
]

let downSql = [
  'drop table "Surveys"',
  'CREATE TABLE "Surveys" AS TABLE survey_backup',
  'drop table survey_backup'
]

module.exports = migrationUtils.migrateUpDown(upSql, downSql)
