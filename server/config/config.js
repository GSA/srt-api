// export DB connection for sequelize command line
// you can run it with:
// node ./node_modules/.bin/sequelize -c server/config/config.js
let config = require('./config.json')

if (process.env.VCAP_SERVICES) {
  // noinspection SpellCheckingInspection
  const VCAP = JSON.parse(process.env.VCAP_SERVICES)

  const dbSettings = {
    database: VCAP['aws-rds'][0]['credentials']['db_name'],
    username: VCAP['aws-rds'][0]['credentials']['username'],
    password: VCAP['aws-rds'][0]['credentials']['password'],
    host: VCAP['aws-rds'][0]['credentials']['host'],
    port: VCAP['aws-rds'][0]['credentials']['port'],
    dialect: 'postgres',
    logging: false
  }

  config= {
    development: dbSettings
  }

  if (process.env.NODE_ENV) {
    config[process.env.NODE_ENV] = dbSettings
  }
}


module.exports = config
