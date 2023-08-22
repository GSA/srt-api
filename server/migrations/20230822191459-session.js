'use strict'
const migrationUtils = require('../migrationUtil')

// This migration is to force a rebuild of the Predictions table

let upSql = [
  ` CREATE TABLE "session" (
    "sid" varchar NOT NULL COLLATE "default",
    "sess" json NOT NULL,
    "expire" timestamp(6) NOT NULL
  ) WITH (OIDS=FALSE); `,
  
  `ALTER TABLE "session" ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE;`,

  `CREATE INDEX "IDX_session_expire" ON "session" ("expire");`,
]

let downSql = [
  `DROP TABLE "session";`
]


module.exports = migrationUtils.migrateUpDown(upSql, downSql)
