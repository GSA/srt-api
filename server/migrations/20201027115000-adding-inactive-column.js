'use strict'
const migrationUtils = require('../migrationUtil')

// This migration is to force a rebuild of the Predictions table to update
// the auto generated Record Created action status to be Solicitation Posted

let upSql = [

    `CREATE TABLE solicitations ( 
      id SERIAL PRIMARY KEY,
      "solNum" varchar UNIQUE, 
      inactive boolean default False)`,
    `insert into solicitations ("solNum", inactive)  (select distinct solicitation_number, False from notice)`
]

let downSql = [
    "DROP TABLE solicitations"
]


module.exports = migrationUtils.migrateUpDown(upSql, downSql)
