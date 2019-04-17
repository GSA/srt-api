'use strict'
const migrationUtils = require('../migrationUtil')

let upSql = [
  'DO $$                                                                                                 \n' +
    '    BEGIN                                                                                           \n' +
    '        BEGIN                                                                                       \n' +
    '       ALTER TABLE attachment ADD COLUMN filename text default \'no-filename-provided\';            \n' +
    '        EXCEPTION                                                                                   \n' +
    '            WHEN duplicate_column THEN RAISE NOTICE \'column filename already exists in attachment.\';\n' +
    '        END;                                                                                        \n' +
    '    END;                                                                                            \n' +
    '$$                                                                                                  \n'
]

let downSql = [
]

module.exports = migrationUtils.migrateUpDown(upSql, downSql)
