'use strict'
const migrationUtils = require('../migrationUtil')

// This migration is to force a rebuild of the Predictions table

let upSql = [
  "insert into notice_type values (0, 'Unknown', '2023-08-21 13:24:18.24947')"
]

let downSql = [
  "delete from notice_type where id = 0"
]


module.exports = migrationUtils.migrateUpDown(upSql, downSql)
