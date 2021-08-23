'use strict'
const migrationUtils = require('../migrationUtil')

// This migration is to force a rebuild of the Predictions table to update
// the auto generated Record Created action status to be Solicitation Posted

let upSql = [
`alter table solicitations
    add column title varchar,
    add column url varchar,
    add column agency varchar,
    add column "numDocs" integer,
    add column "notice_type_id" integer,
    add column "noticeType" varchar,
    add column date timestamp,
    add column office varchar,
    add column na_flag boolean default false,
    add column "eitLikelihood" jsonb,
    add column undetermined boolean,
    add column history jsonb default '[]'::jsonb,
    add column action jsonb default '[]'::jsonb,
    add column "actionDate" timestamp,
    add column "actionStatus" varchar,
    add column "contactInfo" jsonb default Null,
    add column "parseStatus" jsonb default Null,
    add column predictions jsonb default '{"value": "red", "history": []}'::jsonb,
    add column "reviewRec" varchar,
    add column "searchText" varchar,
    add column compliant integer default 0,
    add column "noticeData" jsonb default Null;
`,
  'alter table solicitations alter column "createdAt" set default now()',
  'alter table attachment drop constraint if exists fk_attachment_notice_id_notice',
  'alter table attachment add column solicitation_id integer',
  `update attachment a
     set solicitation_id =
      (select s.id from solicitations s
        join notice n on s."solNum" = n.solicitation_number
        where n.id = a.notice_id
        limit 1)
    where solicitation_id is null`,
  'alter table attachment add constraint fk_attachment_solicitation_id_solicitaiton foreign key (solicitation_id) references solicitations(id)',
  `UPDATE solicitations
     SET
         title = p.title,
         url = p.url,
         agency = p.agency,
         "numDocs" = p."numDocs",
         "notice_type_id" = (select id from notice_type where notice_type = p."noticeType"),
         date = p.date,
         office = p.office,
         na_flag = p.na_flag,
         "eitLikelihood" = p."eitLikelihood",
         undetermined = p.undetermined,
         history = p.history,
         action = p.action,
         "actionDate" = p."actionDate",
         "actionStatus" = p."actionStatus",
         "contactInfo" = p."contactInfo",
         "parseStatus" = p."parseStatus",
         predictions = p.predictions,
         "reviewRec" = p."reviewRec",
         "searchText" = p."searchText"
     FROM
         (select * from "Predictions") as p
     WHERE
         solicitations."solNum" = p."solNum"`

]

let downSql = [
  'alter table attachment drop constraint if exists fk_attachment_solicitation_id_solicitaiton',
  'alter table attachment drop column solicitation_id',
  'alter table attachment add constraint fk_attachment_notice_id_notice foreign key (notice_id) references notice(id)',
`alter table solicitations
    drop column title,
    drop column url,
    drop column agency,
    drop column "numDocs",
    drop column "notice_type_id",
    drop column "noticeType",
    drop column date,
    drop column office,
    drop column na_flag,
    drop column "eitLikelihood",
    drop column undetermined,
    drop column history,
    drop column action,
    drop column "actionDate",
    drop column "actionStatus",
    drop column "contactInfo",
    drop column "parseStatus",
    drop column predictions,
    drop column "reviewRec",
    drop column "searchText",
    drop column compliant,
    drop column "noticeData";
`
  ]


module.exports = migrationUtils.migrateUpDown(upSql, downSql)



