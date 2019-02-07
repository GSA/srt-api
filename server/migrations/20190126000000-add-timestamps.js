'use strict';

const env = process.env.NODE_ENV || 'development';
const config = require(__dirname + '/../config/config.json')[env];
const pg = require ('pg');
var connectionString = "postgres://" + config.username + ":" +config.password+ "@"+ config.host+":" + config.port +"/" + config.database;
var pgClient = new pg.Client(connectionString);

let up_sql = [
    'BEGIN',
    'select * from "Users" limit 1',
    'select * from notice limit 1',
    'alter table "notice" add column "createdAt" timestamp default now(), add column "updatedAt" timestamp default now()',
    'alter table "notice_type" add column "createdAt" timestamp default now(), add column "updatedAt" timestamp default now()',
    'alter table "attachment" add column "createdAt" timestamp default now(), add column "updatedAt" timestamp default now()',
    'COMMIT'
];

let down_sql =[
    'BEGIN',
    'alter table "notice" drop column "createdAt" , drop column "updatedAt" ',
    'alter table "notice_type" drop column "createdAt" , drop column "updatedAt" ',
    'alter table "attachment" drop column "createdAt" , drop column "updatedAt" ',
    'COMMIT'
];
let increment = 0;

function runNext (sql) {
    let promise = null;
    if (increment < sql.length) {
        console.log (sql[increment]);
        promise = pgClient.query(sql[increment]);
    }
    increment++;
    return promise;
}

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await pgClient.connect();
        try {
            while (increment < up_sql.length) {
                await runNext(up_sql).catch( e => {throw e});
            }
            return;
        } catch (e) {
            console.log ("ROLLBACK");
            console.log (e);
            return pgClient.query("ROLLBACK")
                .then ( () => {throw e});
        }

        // return queryInterface.addColumn("notice", "createdAt", {type: "timestamptz", defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')})
        //     .then ( () => {
        //         return queryInterface.addColumn("notice", "updatedAt", {type: "timestamptz", defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')});
        //     })
        //     .then ( () => {
        //         return queryInterface.addColumn("notice_type", "createdAt", {type: "timestamptz", defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')});
        //     })
        //     .then ( () => {
        //         return queryInterface.addColumn("notice_type", "updatedAt", {type: "timestamptz", defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')});
        //     })
        //     .then ( () => {
        //         return queryInterface.addColumn("attachment", "createdAt", {type: "timestamptz", defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')});
        //     })
        //     .then ( () => {
        //         return queryInterface.addColumn("attachment", "updatedAt", {type: "timestamptz", defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')});
        //     })
    },
    down: async (queryInterface, Sequelize) => {
        await pgClient.connect();
        try {
            while (increment < down_sql.length) {
                await runNext(down_sql).catch( e => {throw e});
            }
            return;
        } catch (e) {
            console.log ("ROLLBACK");
            console.log (e);
            return pgClient.query("ROLLBACK")
                .then ( () => {throw e});

        }

        // return queryInterface.dropColumn("notice", "createdAt")
        //     .then( () => {
        //         return queryInterface.dropColumn("notice", "updatedAt")
        //     })
        //     .then( () => {
        //         return queryInterface.dropColumn("notice_type", "createdAt")
        //     })
        //     .then( () => {
        //         return queryInterface.dropColumn("notice_type", "updatedAt")
        //     })
        //     .then( () => {
        //         return queryInterface.dropColumn("attachment", "createdAt")
        //     })
        //     .then( () => {
        //         return queryInterface.dropColumn("attachment", "updatedAt")
        //     })

    }
};