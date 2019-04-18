'use strict'
const env = process.env.NODE_ENV || 'development'
const path = require('path')
const config = require(path.join(__dirname, 'config', 'config.json'))[env]
let connectionString = 'postgres://' + config.username + ':' + config.password + '@' + config.host + ':' + config.port + '/' + config.database

/**
 * Runs a single sql statement and prints results
 *
 * @param pgClient
 * @param sql
 * @return {*|PromiseLike<T | never>|Promise<T | never>}
 */
function runNext (pgClient, sql) {
  return pgClient.query(sql)
    .then((res) => {
      console.log('sql:', sql)
      res.rows.forEach(r => {
        console.log(r)
      })
    })
}

/**
 * Runs a series of SQL statements as a group.
 * Will roll back the entire set if any one fails.
 *
 * @param sqlArray
 * @param pg
 * @return {Promise<*|PromiseLike<*>|Promise<*>>}
 */
async function migrate(sqlArray, pg) {
  sqlArray = ['BEGIN', ...sqlArray, 'COMMIT']
  let pgClient = new pg.Client(connectionString)
  await pgClient.connect()
  try {
    for (let sql of sqlArray) {
      await runNext(pgClient, sql).catch(e => {
        throw e
      })
    }
  } catch (e) {
    console.log('ROLLBACK', e)
    return pgClient.query('ROLLBACK')
      .then(() => {
        throw e
      })
  }
  await pgClient.end()
}

/**
 * Returns an object with an up and down functions that
 * meets the signature expected by a Sequelize migration
 *
 * @param {Array} upSql
 * @param {Array} downSql
 * @param pg optional postgres library module
 * @return {{up: up, down: down}}
 */
function migrateUpDown(upSql, downSql, pg = null) {
  if (pg === null) {
    pg = require('pg/lib')
  }
  return {
    up: async () => {
      await migrate(upSql, pg)
    },
    down: async () => {
      await migrate(downSql, pg)
    }
  }
}

module.exports = {
  migrateUpDown: migrateUpDown
}
