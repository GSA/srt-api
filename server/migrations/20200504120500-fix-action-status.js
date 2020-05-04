'use strict'
const migrationUtils = require('../migrationUtil')

// This migration is to force a rebuild of the Predictions table to update
// the auto generated Record Created action status to be Solicitation Posted

let upSql = [
  `insert into winston_logs (timestamp, level, message, meta) 
     select NOW(), 'debug',  CONCAT('Action for notice ', id,  ' updated during migration.  Original action value in meta.'), action 
     from notice where action::text like '%prediction feedback provided%'`,

  `update notice out set "updatedAt" = now(),  action = (
        select (replace(action::text, 'prediction feedback provided', 'Solicitation Posted'))::jsonb as a
        from notice
        where notice.id = out.id
    ) where action::text like '%prediction feedback provided%' `
]

let downSql = [
  ""
]


module.exports = migrationUtils.migrateUpDown(upSql, downSql)
