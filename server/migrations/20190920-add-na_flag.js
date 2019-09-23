'use strict'
const migrationUtils = require('../migrationUtil')

let upSql = [
  'select count(*) from Notice',
  'alter table Notice add column "na_flag" boolean default false '
]

let downSql = [
  'alter table Notice drop column "na_flag"'
]

module.exports = migrationUtils.migrateUpDown(upSql, downSql)
