const migrationUtils = require('../migrationUtil')
const sinon = require('sinon');


describe('migrationUtils tests', async () => {
  test('normal case', async () => {
    let stub = sinon.stub().resolves( { rows: []})

    let pg = { }
    pg.Client = function Client () {
      this.connect = () => {}
      this.query = stub
      this.end = () => {}
    }

    let upDown = migrationUtils.migrateUpDown(['sql1', 'sql2'], ['sql3', 'sql4'], pg)

    await upDown.up()

    expect(stub.calledWith('BEGIN')).toBeTruthy()
    expect(stub.calledWith('sql1')).toBeTruthy()
    expect(stub.calledWith('sql2')).toBeTruthy()
    expect(stub.calledWith('COMMIT')).toBeTruthy()
    expect(stub.callCount).toBe(4)

    stub.resetHistory()
    await upDown.down()
    expect(stub.calledWith('BEGIN')).toBeTruthy()
    expect(stub.calledWith('sql3')).toBeTruthy()
    expect(stub.calledWith('sql4')).toBeTruthy()
    expect(stub.calledWith('COMMIT')).toBeTruthy()
    expect(stub.callCount).toBe(4)
  })

  test('error case', async () => {
    let stub = sinon.stub().resolves( { rows: []})
    stub.withArgs('sql2').throws('SQL Error')

    let pg = { }
    pg.Client = function Client () {
      this.connect = () => {}
      this.query = stub
      this.end = () => {}
    }

    let upDown = migrationUtils.migrateUpDown(['sql1', 'sql2', 'sql3', 'sql4', 'sql5'], ['sql3', 'sql4'], pg)

    try {
      await upDown.up()
    } catch(e) {
      // console.log ("caught expected exception", e)
    }

    expect(stub.calledWith('BEGIN')).toBeTruthy()
    expect(stub.calledWith('sql1')).toBeTruthy()
    expect(stub.calledWith('sql2')).toBeTruthy()
    expect(stub.callCount).toBe(4)
    expect(stub.calledWith('sql5')).toBeFalsy()
  })
})
