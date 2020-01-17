let app = require('../app')()
let {getConfig} = require('../config/configuration')


describe('App Tests', () => {

  test('JWT to use common config',  () => {
    let falseCallCount = 0
    const mockCallback = jest.fn((x,y) => {
      if (!y){
        falseCallCount++
      }
    })
    app.corsTest("bad.example.com",mockCallback)
    app.corsTest(getConfig("CORSWhitelist")[0],mockCallback)

    expect(falseCallCount).toBe(1)
  })

})
