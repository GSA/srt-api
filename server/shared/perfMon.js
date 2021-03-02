const { performance, PerformanceObserver } = require("perf_hooks")
const {getConfig} = require('../config/configuration')
const logger = require('../config/winston')

const perfObserver = new PerformanceObserver((items) => {
    items.getEntries().forEach((entry) => {
        if (getConfig("logPerformance", false)) {
            logger.log("debug", `PERFORMANCE: ${entry.duration} - ${entry.name}`, {tag: "PerformanceObserver", entry: entry})
        }
    })
})

perfObserver.observe({ entryTypes: ["measure"], buffer: true })

module.exports = {
    perfObserver: perfObserver,
    performance: performance
}
