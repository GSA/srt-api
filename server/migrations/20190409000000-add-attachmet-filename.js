'use strict';


// /* Make this a no-op for now. */
// module.exports = {
//     up: async (queryInterface, Sequelize) => { },
//     down: async (queryInterface, Sequelize) => { }
// };

const env = process.env.NODE_ENV || 'development';
const config = require(__dirname + '/../config/config.json')[env];
const pg = require ('pg');
let connectionString = "postgres://" + config.username + ":" +config.password+ "@"+ config.host+":" + config.port +"/" + config.database;
let pgClient = new pg.Client(connectionString);

// use manual SQL because Sequelize won't roll back partial transactions
// and there is a chance this could fail due to data issues.

let up_sql = [
    'BEGIN',
    'DO $$                                                                                                 ' +
    '    BEGIN                                                                                             ' +
    '        BEGIN                                                                                         ' +
    '       ALTER TABLE attachment ADD COLUMN filename text default \'no-filename-provided\';              ' +
    '        EXCEPTION                                                                                     ' +
    '            WHEN duplicate_column THEN RAISE NOTICE \'column filename already exists in attachment.\';' +
    '        END;                                                                                          ' +
    '    END;                                                                                              ' +
    '$$                                                                                                    ',
    'COMMIT'
];

let down_sql =[
    'BEGIN',
    'COMMIT'
];
let increment = 0;

function runNext (sql) {
    let promise = {};
    if (increment < sql.length) {
        console.log (sql[increment]);
        promise = pgClient.query(sql[increment]);
    }
    increment++;
    return promise
        .then ( (res) => {
            res.rows.forEach ( r => {
                console.log (r)
            })
        });
}

module.exports = {
    up: async () => {
        await pgClient.connect();
        try {
            while (increment < up_sql.length) {
                await runNext(up_sql).catch( e => {throw e});
            }
        } catch (e) {
            console.log ("ROLLBACK");
            console.log (e);
            return pgClient.query("ROLLBACK")
                .then ( () => {throw e});
        }
    },
    down: async () => {
        await pgClient.connect();
        try {
            while (increment < down_sql.length) {
                await runNext(down_sql).catch( e => {throw e});
            }
        } catch (e) {
            console.log ("ROLLBACK");
            console.log (e);
            return pgClient.query("ROLLBACK")
                .then ( () => {throw e});
        }
    }
};


