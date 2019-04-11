'use strict'
/** @module Models */

/**
 * @typedef {Model} Agency
 * @property {string} agency Agency name
 * @property {string} acronym Agency acronym
 */

/**
 * @typedef {Model} Attachment
 * @property {number} id
 * @property {number} notice_id
 * @property {number} notice_type_id
 * @property {string} attachment_text
 * @property {string} prediction
 * @property {string} decision_boundary
 * @property {string} validation
 * @property {string} attachment_url
 * @property {string} trained
 *
 */

/**
 * @typedef {Model} Notice
 * @property {number} id
 * @property {number} notice_type_id
 * @property {string} solicitation_number
 * @property {string} agency
 * @property {date} date
 * @property {Object} notice_data
 * @property {string} compliant
 * @property {Object} action
 * @property {Object} feedback
 * @property {Object} history
*/

/**
 * @typedef {Model} NoticeType
 * @property {number} id
 * @property {string} notice_type
 */

/**
 * @typedef {Model} Survey
 * @property {number} id
 * @property {string} question
 * @property {Object} choices
 * @property {string} section
 * @property {string} type
 * @property {string} answer
 * @property {string} note
 * @property {Object} choicesNote
 *
 */

/**
 *
 * @type {Model} User
 * @property {string} firstName: DataTypes.STRING,
 * @property {string} lastName: DataTypes.STRING,
 * @property {string} agency: DataTypes.STRING,
 * @property {string} email: DataTypes.STRING,
 * @property {string} password: DataTypes.STRING,
 * @property {string} position: DataTypes.STRING,
 * @property {string} isAccepted: DataTypes.BOOLEAN,
 * @property {string} isRejected: DataTypes.BOOLEAN,
 * @property {string} userRole: DataTypes.STRING,
 * @property {string} rejectionNote: DataTypes.STRING,
 * @property {string} creationDate: DataTypes.STRING,
 * @property {string} tempPassword: DataTypes.STRING
 *
 */

const fs = require('fs')
const path = require('path')
const Sequelize = require('sequelize')
const Umzug = require('umzug')
const logger = require('../config/winston')
const basename = path.basename(__filename)
const env = process.env.NODE_ENV || 'development'
const config = require(path.join(__dirname, '/../config/config.json'))[env]
const db = {}

let sequelize

if (process.env.VCAP_SERVICES) {
  // looks like we have credential info from cloud.gov
  // connect to the first entry in aws-rds
  let dbConfig = JSON.parse(process.env.VCAP_SERVICES)
  dbConfig['aws-rds'][0].credentials.dialect = 'postgres'
  dbConfig['aws-rds'][0].credentials.logging = config.logging
  sequelize = new Sequelize(
    dbConfig['aws-rds'][0]['credentials']['db_name'],
    dbConfig['aws-rds'][0]['credentials']['username'],
    dbConfig['aws-rds'][0]['credentials']['password'],
    dbConfig['aws-rds'][0]['credentials']
  )
} else {
  sequelize = new Sequelize(config.database, config.username, config.password, config)
}

// Now run any database outstanding migrations using umzug
const umzug = new Umzug({
  storage: 'sequelize',

  storageOptions: {
    sequelize: sequelize
  },

  migrations: {
    params: [
      sequelize.getQueryInterface(),
      Sequelize
    ],
    path: path.join(__dirname, '../migrations')
  }
})

umzug.up()
  .then((result) => {
    logger.log('info', result, { tag: 'Umzug db migration results' })
  })

fs
  .readdirSync(__dirname)
  .filter(file => {
    return (file.indexOf('.') !== 0) && (file !== basename) && (file.slice(-3) === '.js')
  })
  .forEach(file => {
    const model = sequelize['import'](path.join(__dirname, file))
    db[model.name] = model
  })

Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db)
  }
})

db.sequelize = sequelize
db.Sequelize = Sequelize

db['notice'].hasMany(db['attachment'], { foreignKey: 'notice_id', sourceKey: 'id' })

module.exports = db
