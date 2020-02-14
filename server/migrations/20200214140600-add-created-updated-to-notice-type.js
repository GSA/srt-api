'use strict'
const migrationUtils = require('../migrationUtil')

let upSql = [
  'DO $$                                                                                                 \n' +
  '    BEGIN                                                                                           \n' +
  '        BEGIN                                                                                       \n' +
  '       ALTER TABLE notice_type ADD COLUMN "createdAt" timestamp default NOW();                                              \n' +
  '        EXCEPTION                                                                                   \n' +
  '            WHEN duplicate_column THEN RAISE NOTICE \'column notice_type.createdAt already exists.\';\n' +
  '        END;                                                                                        \n' +
  '    END;                                                                                            \n' +
  '$$                                                                                                  \n' ,


  'DO $$                                                                                                 \n' +
  '    BEGIN                                                                                           \n' +
  '        BEGIN                                                                                       \n' +
  '       ALTER TABLE notice_type ADD COLUMN "updatedAt" timestamp default NOW();                                              \n' +
  '        EXCEPTION                                                                                   \n' +
  '            WHEN duplicate_column THEN RAISE NOTICE \'column notice_type.updatedAt already exists.\';\n' +
  '        END;                                                                                        \n' +
  '    END;                                                                                            \n' +
  '$$                                                                                                  \n' ,

]

let downSql = [
  'DO $$                                                                                                 \n' +
  '    BEGIN                                                                                           \n' +
  '        BEGIN                                                                                       \n' +
  '       ALTER TABLE notice_type drop COLUMN "createdAt"  ;                                              \n' +
  '        EXCEPTION                                                                                   \n' +
  '            WHEN OTHERS THEN RAISE NOTICE \'did not find createdAt\';  \n' +
  '        END;                                                                                        \n' +
  '    END;                                                                                            \n' +
  '$$                                                                                                  \n' ,


  'DO $$                                                                                                 \n' +
  '    BEGIN                                                                                           \n' +
  '        BEGIN                                                                                       \n' +
  '       ALTER TABLE notice_type drop COLUMN "updatedAt" ;                                              \n' +
  '        EXCEPTION                                                                                   \n' +
  '            WHEN OTHERS THEN RAISE NOTICE \'did not find updatedAt\';   \n' +
  '        END;                                                                                        \n' +
  '    END;                                                                                            \n' +
  '$$                                                                                                  \n' ,
]

module.exports = migrationUtils.migrateUpDown(upSql, downSql)
