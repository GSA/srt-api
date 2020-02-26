// export DB connection for sequelize command line
// you can run it with:
// node ./node_modules/.bin/sequelize -c server/config/dbConfig.js
let dbConfig = {
  "development": {
    "username": "circleci",
    "password": "srtpass",
    "database": "srt",
    "host": "localhost",
    "port": 5432,
    "dialect": "postgres",
    "logging": false,
    "pool": {
      max: 95,
      min: 0,
      acquire: 20000,
      idle: 20000,
      evict: 10000
    }
  },
  "circle": {
    "username": "circleci",
    "password": "srtpass",
    "database": "srt",
    "host": "localhost",
    "port": 5432,
    "dialect": "postgres",
    "logging": false,
  }
}

const env = process.env.NODE_ENV || 'development'

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

  dbConfig= {
    development: dbSettings
  }

  if (process.env.NODE_ENV) {
    dbConfig[env] = dbSettings
  }
}


module.exports = dbConfig

