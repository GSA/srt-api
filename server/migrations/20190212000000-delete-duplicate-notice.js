'use strict';

const env = process.env.NODE_ENV || 'development';
const config = require(__dirname + '/../config/config.json')[env];
const pg = require('pg');
var connectionString = "postgres://" + config.username + ":" + config.password + "@" + config.host + ":" + config.port + "/" + config.database;
var pgClient = new pg.Client(connectionString);

let up_sql = [
    'BEGIN',

    `select * into duplicate_attachment_archive from attachment where notice_id not in
                            (
                              select max(id) as id
                              from notice
                              where notice_number in (select notice_number
                                                      from notice
                                                      group by notice_number
                                                      having count(*) > 1
                                                      order by count(*) desc)
                              group by notice_number
                              union
                              select id
                              from notice
                              where notice_number in
                                    (select notice_number from notice group by notice_number having count(*) = 1)
                            ) `,

    `select * into duplicate_notice_archive from notice where id not in
                            (
                              select max(id) as id
                              from notice
                              where notice_number in (select notice_number
                                                      from notice
                                                      group by notice_number
                                                      having count(*) > 1
                                                      order by count(*) desc)
                              group by notice_number
                              union
                              select id
                              from notice
                              where notice_number in
                                    (select notice_number from notice group by notice_number having count(*) = 1)
                            ) `,

    `delete from attachment where notice_id not in
                            (
                              select max(id) as id
                              from notice
                              where notice_number in (select notice_number
                                                      from notice
                                                      group by notice_number
                                                      having count(*) > 1
                                                      order by count(*) desc)
                              group by notice_number
                              union
                              select id
                              from notice
                              where notice_number in
                                    (select notice_number from notice group by notice_number having count(*) = 1)
                            ) `,


    `delete from notice where id not in
                            (
                              select max(id) as id
                              from notice
                              where notice_number in (select notice_number
                                                      from notice
                                                      group by notice_number
                                                      having count(*) > 1
                                                      order by count(*) desc)
                              group by notice_number
                              union
                              select id
                              from notice
                              where notice_number in
                                    (select notice_number from notice group by notice_number having count(*) = 1)
                            ) `,

    'COMMIT'
];

let down_sql = [
    'BEGIN',

        `insert into notice select * from duplicate_notice_archive where id not in
                            (
                              select max(id) as id
                              from notice
                              where notice_number in (select notice_number
                                                      from notice
                                                      group by notice_number
                                                      having count(*) > 1
                                                      order by count(*) desc)
                              group by notice_number
                              union
                              select id
                              from notice
                              where notice_number in
                                    (select notice_number from notice group by notice_number having count(*) = 1)
                            ) `,

        `insert into attachment select * from duplicate_attachment_archive where notice_id not in
                            (
                              select max(id) as id
                              from notice
                              where notice_number in (select notice_number
                                                      from notice
                                                      group by notice_number
                                                      having count(*) > 1
                                                      order by count(*) desc)
                              group by notice_number
                              union
                              select id
                              from notice
                              where notice_number in
                                    (select notice_number from notice group by notice_number having count(*) = 1)
                            ) `,

    'drop table duplicate_attachment_archive',

    'drop table duplicate_notice_archive',

    'COMMIT'
];
let increment = 0;

function runNext(sql) {
    let promise = null;
    if (increment < sql.length) {
        console.log(sql[increment]);
        promise = pgClient.query(sql[increment]);
    }
    increment++;
    return promise
        .then((res) => {
            res.rows.forEach(r => {
                console.log(r)
            })
        });
}

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await pgClient.connect();
        try {
            while (increment < up_sql.length) {
                await runNext(up_sql).catch(e => {
                    throw e
                });
            }
            return;
        } catch (e) {
            console.log("ROLLBACK");
            console.log(e);
            return pgClient.query("ROLLBACK")
                .then(() => {
                    throw e
                });
        }
    },

    down: async (queryInterface, Sequelize) => {
        await pgClient.connect();
        try {
            while (increment < down_sql.length) {
                await runNext(down_sql).catch(e => {
                    throw e
                });
            }
            return;
        } catch (e) {
            console.log("ROLLBACK");
            console.log(e);
            return pgClient.query("ROLLBACK")
                .then(() => {
                    throw e
                });
        }

    }
};