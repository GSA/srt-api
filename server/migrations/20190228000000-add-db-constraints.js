'use strict'
const migrationUtils = require('../migrationUtil')

/* Make this a no-op for now. */
module.exports = migrationUtils.migrateUpDown([], [])

// const env = process.env.NODE_ENV || 'development';
// const config = require(__dirname + '/../config/config.json')[env];
// const pg = require ('pg');
// var connectionString = "postgres://" + config.username + ":" +config.password+ "@"+ config.host+":" + config.port +"/" + config.database;
// var pgClient = new pg.Client(connectionString);
//
// // use manual SQL because Sequelize won't roll back partial transactions
// // and there is a chance this could fail due to data issues.
//
// let up_sql = [
//     'BEGIN',
//     'delete from "Agencies" where id in (  ' + // delete duplicate rows in the Agencies table
//     '  select max(id) as id                ' + // (old version of migration script had duplicates)
//     '  from (                              ' +
//     '         select id, agency            ' +
//     '         from "Agencies"              ' +
//     '         where agency in              ' +
//     '            (select agency            ' +
//     '             from "Agencies"          ' +
//     '             group by agency          ' +
//     '             having count(*) > 1)     ' +
//     '         order by agency              ' +
//     '       ) dupes                        ' +
//     '  group by agency )',
//
//     'delete from "Users" where id in (           ' + // delete duplicate rows in the Agencies table
//     '  select max(id) as id                      ' + // (old version of migration script had duplicates)
//     '  from (                                    ' +
//     '         select id, email                   ' +
//     '         from "Users"                       ' +
//     '         where email in                     ' +
//     '            (select email                   ' +
//     '             from "Users"                   ' +
//     '             where "lastName" = \'Crowley\' ' +
//     '             group by email                 ' +
//     '             having count(*) > 1)           ' +
//     '         order by email                     ' +
//     '       ) dupes                              ' +
//     '  group by email )',
//     'ALTER TABLE "Users" ADD CONSTRAINT "unique_Users_email" UNIQUE ("email")',
//     'ALTER TABLE "Agencies" ADD CONSTRAINT "unique_Agencies_agency" UNIQUE ("agency")',
//     'ALTER TABLE "Users" ADD CONSTRAINT "fk_Users_Agencies_Agency_name" FOREIGN KEY ("agency") REFERENCES "Agencies" ("agency")',
//     'COMMIT'
// ];
//
// let down_sql =[
//     'BEGIN',
//     'alter table "Users" drop constraint "fk_Users_Agencies_Agency_name"',
//     'alter table "Agencies" drop constraint "unique_Agencies_agency"',
//     'alter table "Users" drop constraint "unique_Users_email"',
//     'COMMIT'
// ];
// let increment = 0;
//
// function runNext (sql) {
//     let promise = null;
//     if (increment < sql.length) {
//         console.log (sql[increment]);
//         promise = pgClient.query(sql[increment]);
//     }
//     increment++;
//     return promise
//         .then ( (res) => {
//             res.rows.forEach ( r => {
//                 console.log (r)
//             })
//         });
// }
//
// module.exports = {
//     up: async (queryInterface, Sequelize) => {
//         await pgClient.connect();
//         try {
//             while (increment < up_sql.length) {
//                 await runNext(up_sql).catch( e => {throw e});
//             }
//             return;
//         } catch (e) {
//             console.log ("ROLLBACK");
//             console.log (e);
//             return pgClient.query("ROLLBACK")
//                 .then ( () => {throw e});
//         }
//     },
//     down: async (queryInterface, Sequelize) => {
//         await pgClient.connect();
//         try {
//             while (increment < down_sql.length) {
//                 await runNext(down_sql).catch( e => {throw e});
//             }
//             return;
//         } catch (e) {
//             console.log ("ROLLBACK");
//             console.log (e);
//             return pgClient.query("ROLLBACK")
//                 .then ( () => {throw e});
//         }
//     }
// };
//
//
