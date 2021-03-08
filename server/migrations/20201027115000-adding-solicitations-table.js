'use strict'
const migrationUtils = require('../migrationUtil')

// This migration is to force a rebuild of the Predictions table to update
// the auto generated Record Created action status to be Solicitation Posted

let upSql = [

    `CREATE TABLE solicitations ( 
      "id" SERIAL PRIMARY KEY,
      "solNum" varchar UNIQUE, 
      "active" boolean default True,
      "updatedAt" timestamp without time zone default current_timestamp,
      "createdAt"  timestamp without time zone default current_timestamp)`,

    `insert into solicitations ("solNum", active)  (select distinct solicitation_number, True from notice)`,

    `alter table "Predictions" add column active boolean default TRUE`
]

let downSql = [
    "DROP TABLE solicitations",
    `alter table "Predictions" drop column active`
]


module.exports = migrationUtils.migrateUpDown(upSql, downSql)
