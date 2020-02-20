'use strict'
const migrationUtils = require('../migrationUtil')

let upSql = [
  'DO $$                                                                                                  ' +
  '    BEGIN                                                                                            ' +
  '        BEGIN                                                                                        ' +
  '       ALTER TABLE notice_type ADD COLUMN "createdAt" timestamp default NOW();                                               ' +
  '        EXCEPTION                                                                                    ' +
  '            WHEN duplicate_column THEN RAISE NOTICE \'column notice_type.createdAt already exists.\'; ' +
  '        END;                                                                                         ' +
  '    END;                                                                                             ' +
  '$$                                                                                                   ' ,


  'DO $$                                                                                                  ' +
  '    BEGIN                                                                                            ' +
  '        BEGIN                                                                                        ' +
  '       ALTER TABLE notice_type ADD COLUMN "updatedAt" timestamp default NOW();                                               ' +
  '        EXCEPTION                                                                                    ' +
  '            WHEN duplicate_column THEN RAISE NOTICE \'column notice_type.updatedAt already exists.\'; ' +
  '        END;                                                                                         ' +
  '    END;                                                                                             ' +
  '$$                                                                                                   ' ,

]

let downSql = [
  'DO $$                                                                                                  ' +
  '    BEGIN                                                                                            ' +
  '        BEGIN                                                                                        ' +
  '       ALTER TABLE notice_type drop COLUMN "createdAt"  ;                                               ' +
  '        EXCEPTION                                                                                    ' +
  '            WHEN OTHERS THEN RAISE NOTICE \'did not find createdAt\';   ' +
  '        END;                                                                                         ' +
  '    END;                                                                                             ' +
  '$$                                                                                                   ' ,


  'DO $$                                                                                                  ' +
  '    BEGIN                                                                                            ' +
  '        BEGIN                                                                                        ' +
  '       ALTER TABLE notice_type drop COLUMN "updatedAt" ;                                               ' +
  '        EXCEPTION                                                                                    ' +
  '            WHEN OTHERS THEN RAISE NOTICE \'did not find updatedAt\';    ' +
  '        END;                                                                                         ' +
  '    END;                                                                                             ' +
  '$$                                                                                                   ' ,
]

module.exports = migrationUtils.migrateUpDown(upSql, downSql)
