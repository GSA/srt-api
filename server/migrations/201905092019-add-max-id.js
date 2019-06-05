'use strict'
const migrationUtils = require('../migrationUtil')

let upSql = [
  'alter table "Users" add column "maxId" varchar(256)'
]

let downSql = [
  'alter table "Users" drop column "maxId"'
]

module.exports = migrationUtils.migrateUpDown(upSql, downSql)
