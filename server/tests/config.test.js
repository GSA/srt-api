
describe('configuration tests', () => {
  test('read config from VCAP_SERVICES env variable', () => {
    const origEnv = process.env.NODE_ENV
    const origVcap = process.env.VCAP_SERVICES

    process.env.VCAP_SERVICES = '{"aws-rds":[{"label": "aws-rds",       "provider": null,       "plan": "shared-psql",       "name": "test",       "tags": [       "database",       "RDS"     ],       "instance_name": "iname",       "binding_name": null,       "credentials": {       "db_name": "dname",         "host": "127.0.0.1",         "password": "ptest",         "port": "5432",         "uri": "postgres://x:y@127.0.0.1:5432/srt",         "username": "utest"     },     "syslog_drain_url": null,       "volume_mounts": [      ]   }]}'
    process.env.NODE_ENV = 'testenv'
    let dbConfig = require('../config/dbConfig')

    process.env.NODE_ENV = origEnv
    process.env.VCAP_SERVICES = origVcap

    /** @namespace dbConfig.testenv */
    expect(dbConfig.testenv.database).toBe('dname')
    expect(dbConfig.testenv.password).toBe('ptest')
    expect(dbConfig.testenv.port).toBe('5432')

  })
})
