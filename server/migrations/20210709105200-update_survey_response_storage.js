'use strict'
const migrationUtils = require('../migrationUtil')

// This migration is to force a rebuild of the Predictions table to update
// the auto generated Record Created action status to be Solicitation Posted

let upSql = [
  `alter table survey_responses drop constraint if exists survey_responses_contemporary_notice_id_fkey`,
  `alter table survey_responses alter column contemporary_notice_id drop not null `,

  `CREATE TABLE survey_responses_archive (
      "id" SERIAL PRIMARY KEY,
      "solNum" varchar,
      "contemporary_notice_id" int,
      response jsonb default '[]'::jsonb,
      "maxId" varchar(256),
      "original_created_at" timestamp without time zone default current_timestamp,
      "updatedAt" timestamp without time zone default current_timestamp,
      "createdAt"  timestamp without time zone default current_timestamp                  
    )`,

]

let downSql = [
]


module.exports = migrationUtils.migrateUpDown(upSql, downSql)



