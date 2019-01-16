var express = require('express');
const logger = require('../config/winston');
const Agency = require('../models').Agency;



/**
 * register
 */
module.exports = {

    putAgency: function (req, res) {
        let agency = {
            agency: req.body.agency,
            acronym: req.body.acronym
        };

        Agency.create(agency)
            .then((agency) => {
                return res.status(200).send(agency);
            })
            .catch( (e) => {
                logger.error (e);
                return res.status(400).send(e);
            })
    },

    getAgency: function (req, res) {
        return Agency.findAll().then((age) => {
            let a = new Array();
            age.forEach( (e) => {
                a.push ( {Agency: e.dataValues.agency, Acronym: e.dataValues.acronym} );
            })

            logger.debug("Return " + a.lengh + " agencies from GET /api/agencies");

            return res.status(200).send(a);
        })
            .catch((e) => {
                logger.error(e);
                res.statuws(400).send(e);
            });
    },

    agencyList: function (req, res) {
        Prediction.find({'eitLikelihood.value': 'Yes'}).then((preds) => {
            var agencyList = [];
            var map = new Object();
            for (let item of preds) {
                if (!map.hasOwnProperty(item.agency)) {
                    map[item.agency] = item.agency;
                    agencyList.push(item.agency)
                }
            }
            agencyList.sort();
            res.send(agencyList);
        }, (e) => {
            res.status(400).send(e);
        });
    }
}