'use strict'
const migrationUtils = require('../migrationUtil')

// This migration is to force a rebuild of the Predictions table to update
// the auto generated Record Created action status to be Solicitation Posted

let upSql = [

    `CREATE TABLE survey_responses (
      "id" SERIAL PRIMARY KEY,
      "solNum" varchar,
      "contemporary_notice_id" int NOT NULL REFERENCES notice (id),
      response jsonb default '[]'::jsonb,
      "updatedAt" timestamp without time zone default current_timestamp,
      "createdAt"  timestamp without time zone default current_timestamp                  
    )`,

    `create index "ix_feedback_solNum" on "survey_responses" ("solNum")`,

    `insert into survey_responses ("solNum", contemporary_notice_id, response) (select solicitation_number,id, feedback from notice where jsonb_array_length(feedback) > 0)`,

    'alter table "Predictions" drop feedback'

]

let downSql = [
    "DROP TABLE survey_responses"
]


module.exports = migrationUtils.migrateUpDown(upSql, downSql)



