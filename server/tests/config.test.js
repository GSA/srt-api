const {getConfig} = require('../config/configuration')
const {common} = require('../config/config.js')
const conf = require('../config/config.js')[process.env.NODE_ENV]

/**
 * Test can't be run in parallel with others so disabling
 */
describe('configuration tests', () => {
  test.skip('read config from VCAP_SERVICES env variable', () => {
    let dbConfig = require('../config/dbConfig')
    const origEnv = process.env.NODE_ENV
    const origVcap = process.env.VCAP_SERVICES

    process.env.VCAP_SERVICES = '{"aws-rds":[{"label": "aws-rds",       "provider": null,       "plan": "shared-psql",       "name": "test",       "tags": [       "database",       "RDS"     ],       "instance_name": "iname",       "binding_name": null,       "credentials": {       "db_name": "dname",         "host": "127.0.0.1",         "password": "ptest",         "port": "5432",         "uri": "postgres://x:y@127.0.0.1:5432/srt",         "username": "utest"     },     "syslog_drain_url": null,       "volume_mounts": [      ]   }]}'
    process.env.NODE_ENV = 'testenv'

    process.env.NODE_ENV = origEnv
    process.env.VCAP_SERVICES = origVcap

    /** @namespace dbConfig.testenv */
    expect(dbConfig.testenv.database).toBe('dname')
    expect(dbConfig.testenv.password).toBe('ptest')
    expect(dbConfig.testenv.port).toBe('5432')

  })

  test('getConfig splits on :', () => {
    let dict = { one: 1, alpha: 'abc', nested: { deep: 'one deep', deeper: { x: 'deeper entry' } } }
    process.env.CTEST = JSON.stringify(dict)
    process.env.EASYTEST = "easy"

    expect(getConfig('EASYTEST')).toBe("easy")
    expect(getConfig('sessionLength')).toBe(common.sessionLength)
    expect(getConfig('emailFrom')).toBe(conf.emailFrom)
    expect(getConfig('maxCas:cas_url')).toBe(conf.maxCas.cas_url)
    expect(getConfig('CTEST:one')).toBe(1)
    expect(getConfig('CTEST:nested:deep')).toBe('one deep')
    expect(getConfig('CTEST:nested:deeper')).toBeObject()
    expect(getConfig('CTEST:nested:deeper')['x']).toBe('deeper entry')

  })

  test('getConfig returns default value', () => {
    let dict = { one: 1, alpha: 'abc', nested: { deep: 'one deep', deeper: { x: 'deeper entry' } } }
    process.env.CTEST = JSON.stringify(dict)
    process.env.EASYTEST = "easy"

    expect(getConfig('qwertyasdf', 'defval')).toBe('defval')
    expect(getConfig('maxCas:qwertyasdf')).toBeUndefined()
    expect(getConfig('maxCas:qwertyasdf', 'defval2')).toBe('defval2')
    expect(getConfig(undefined, 'fix')).toBe('fix')
    expect(getConfig({test: 'test'}, 'fix')).toBe('fix')
  })

})
