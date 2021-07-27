'use strict'
const migrationUtils = require('../migrationUtil')

// This migration is to force a rebuild of the Predictions table to update
// the auto generated Record Created action status to be Solicitation Posted

let upSql = [
  `alter table solicitations rename column "eitLikelihood" to category_list`,
  `update solicitations set category_list = '{"value":"yes", "it": "yes", "estar": "no"}'::jsonb`

]

let downSql = [
  `alter table solicitations rename column category_list to "eitLikelihood"`,
  `update solicitations set "eitLikelihood" = '{"value":"yes"}'::jsonb`
]


module.exports = migrationUtils.migrateUpDown(upSql, downSql)





