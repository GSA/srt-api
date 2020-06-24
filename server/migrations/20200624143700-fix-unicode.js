'use strict'
const migrationUtils = require('../migrationUtil')

// This migration is to force a rebuild of the Predictions table

let upSql = [
  ` update "Predictions" set history = replace(history::text, U&'\\200e', '')::jsonb `,
  ` update notice set history = replace(history::text, U&'\\200e', '')::jsonb `
]

let downSql = [
]


module.exports = migrationUtils.migrateUpDown(upSql, downSql)
