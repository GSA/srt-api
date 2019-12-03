'use strict'
const migrationUtils = require('../migrationUtil')

let upSql = [
  `drop table if exists "Predictions"`,
  `create table "Predictions"
(
    "id" serial not null
        constraint Predictions_pk
            primary key,
    "title" varchar not null,
    "url" varchar,
    "agency" varchar,
    "numDocs" int,
    "solNum" varchar not null ,
    "noticeType" varchar not null,
    "date" timestamp,
    "office" varchar,
    "na_flag" boolean,
    "eitLikelihood" jsonb,
    "undetermined" boolean,
    "action" jsonb,
    "actionStatus" varchar,
    "actionDate" timestamp,
    "feedback" jsonb,
    "history" jsonb,
    "contactInfo" jsonb,
    "parseStatus" jsonb,
    "predictions" jsonb,
    "reviewRec" varchar,
    "searchText" varchar, 
    "createdAt" timestamp,
    "updatedAt" timestamp,
    CONSTRAINT "uniqueSolNum" UNIQUE ("solNum")
)
`
]

let downSql = [
  'drop table "Predictions"'
]

module.exports = migrationUtils.migrateUpDown(upSql, downSql)
