'use strict';

const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const Umzug = require('umzug');
const logger = require('../config/winston');
const basename = path.basename(__filename);
const env = process.env.NODE_ENV || 'development';
const config = require(__dirname + '/../config/config.json')[env];
const db = {};

let sequelize;


if (process.env.VCAP_SERVICES ) {
  // looks like we have credential info from cloud.gov
  // connect to the first entry in aws-rds
  let db_config = JSON.parse(process.env.VCAP_SERVICES);
  db_config['aws-rds'][0].credentials.dialect = "postgres";
  db_config['aws-rds'][0].credentials.logging = config.logging;
  sequelize = new Sequelize(
      db_config['aws-rds'][0]['credentials']['db_name'],
      db_config['aws-rds'][0]['credentials']['username'],
      db_config['aws-rds'][0]['credentials']['password'],
      db_config['aws-rds'][0]['credentials']
  );
} else {
  sequelize = new Sequelize(config.database, config.username, config.password, config);
}

// Now run any database outstanding migrations using umzug
const umzug     = new Umzug({
  storage: "sequelize",

  storageOptions: {
    sequelize: sequelize
  },

  migrations: {
    params: [
      sequelize.getQueryInterface(),
      Sequelize
    ],
    path: path.join(__dirname, "../migrations")
  }
});


umzug.up()
    .then( (result) => {
      logger.log ("info", result, {tag: "Umzug db migration results"})
    } );



fs
  .readdirSync(__dirname)
  .filter(file => {
    return (file.indexOf('.') !== 0) && (file !== basename) && (file.slice(-3) === '.js');
  })
  .forEach(file => {
    const model = sequelize['import'](path.join(__dirname, file));
    db[model.name] = model;
  });

Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
