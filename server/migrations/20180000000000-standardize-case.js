'use strict';

const env = process.env.NODE_ENV || 'development';
const config = require(__dirname + '/../config/config.json')[env];
const pg = require ('pg');

var connectionString = "postgres://" + config.username + ":" +config.password+ "@"+ config.host+":" + config.port +"/" + config.database;

var pgClient = new pg.Client(connectionString);



module.exports = {
    up: (queryInterface, Sequelize) => {
        return pgClient.connect()
            .then( () => {
                var sql = "BEGIN"
                console.log (sql)
                return pgClient.query(sql)
                    .then( () => {
                        var sql = 'select * from public.notice limit 1';
                        console.log (sql)
                        return pgClient.query(sql)
                    })
                    .then( (result) => {
                        console.log(result);
                        var sql = 'alter table "notice"  rename to "Notice"';
                        console.log (sql)
                        return pgClient.query(sql)
                    })
                    .then( () => {
                        var sql = 'alter table "notice_type"  rename to "Notice_Type"';
                        console.log (sql)
                        return pgClient.query(sql)
                    })
                    .then( () => {
                        var sql = 'alter table "attachment"  rename to "Attachment"';
                        console.log (sql)
                        return pgClient.query(sql)
                    })
                    .then( () => {
                        var sql = 'alter table "model"  rename to "Model"';
                        console.log (sql)
                        return pgClient.query(sql)
                    })
                    .then( () => {
                        var sql = 'COMMIT';
                        console.log (sql)
                        return pgClient.query(sql)
                    })
            })
            .then ( () => {
                pgClient.end();
            })
            .catch( (e) => {
                var sql = 'ROLLBACK';
                console.log (sql)
                return pgClient.query(sql)
                    .then ( () => {
                        throw e;
                    })
            })
    },
    down: (queryInterface, Sequelize) => {
        return pgClient.connect()
            .then( () => {
                var sql = "BEGIN"
                console.log (sql)
                return pgClient.query(sql)
                    .then( () => {
                        var sql = 'select * from notice limit 1';
                        console.log (sql)
                        return pgClient.query(sql)
                    })
                    .then( (result) => {
                        console.log(result);
                        var sql = 'alter table "Notice"  rename to "notice"';
                        console.log (sql)
                        return pgClient.query(sql)
                    })
                    .then( () => {
                        var sql = 'alter table "Attachment"  rename to "attachment"';
                        console.log (sql)
                        return pgClient.query(sql)
                    })
                    .then( () => {
                        var sql = 'alter table "Notice_Type"  rename to "notice_type"';
                        console.log (sql)
                        return pgClient.query(sql)
                    })
                    .then( () => {
                        var sql = 'alter table "Model"  rename to "model"';
                        console.log (sql)
                        return pgClient.query(sql)
                    })
                    .then( () => {
                        var sql = 'COMMIT';
                        console.log (sql)
                        return pgClient.query(sql)
                    })
            })
            .then ( () => {
                pgClient.end();
            })
            .catch( (e) => {
                console.log (e)
                var sql = 'ROLLBACK';
                console.log (sql)
                return pgClient.query(sql)
                    .then ( () => {
                        throw e;
                    })
            })
    }
};