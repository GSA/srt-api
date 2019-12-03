/** @module PredictionRoutes */
const Prediction = require('../models').Prediction
const Sequelize = require('sequelize')

/**
 * Prediction routes
 */
const logger = require('../config/winston')
const db = require('../models/index')
/**
 * @typedef {Object} SqlString
 * @property {function} escape
 */
const env = process.env.NODE_ENV || 'development'
const config = require('../config/config.js')[env]

module.exports = {
  getNoticeTypes : function(req, res) {
    return Prediction.findAll({
      attributes: [
        [Sequelize.fn('DISTINCT', Sequelize.col('noticeType')), 'noticeType']
      ]
    })
      .then( noticeTypes => {
        let typeArray = []
        for (n of noticeTypes) {
          typeArray.push(n.noticeType)
        }
        return res.status(200).send(typeArray)
      })
      .catch( e => {
        e //?
        logger.log("error", "getNoticeTypes exception", {tag:"getNoticeTypes", error:e})
        return res.status(500).send("Server error")
      })

  }

}
