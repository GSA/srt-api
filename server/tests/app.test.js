const { app, clientPromise } = require('../app');
const appInstance = app();
let {getConfig} = require('../config/configuration')


describe('App Tests', () => {

  test('JWT to use common config',  () => {
    let falseCallCount = 0
    const mockCallback = jest.fn((x,y) => {
      if (!y){
        falseCallCount++
      }
    })
    appInstance.corsTest("bad.example.com",mockCallback)
    appInstance.corsTest(getConfig("CORSWhitelist")[0],mockCallback)

    expect(falseCallCount).toBe(1)
  })

})
