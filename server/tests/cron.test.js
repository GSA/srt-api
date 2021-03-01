// const db = require('../models/index')
// const {getConfig} = require('../config/configuration')
const {cleanAwardNotices} = require('../cron/noticeAwardCleanup')

describe('Cron tests', () => {

    // Because the logger is in a different transaction space than Sequelize, I haven't figured out how to make a
    // reliable unit test for this.
    test('Test award notice cleanup cron', async () => {
        const count_cleaned = await cleanAwardNotices(); //?
        expect (typeof(count_cleaned)).toBe('number')
    }, 100000)
})
