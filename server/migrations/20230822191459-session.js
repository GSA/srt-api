'use strict'
const migrationUtils = require('../migrationUtil')

// This migration will create a session table for storing session data

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
