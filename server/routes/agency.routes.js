var express = require('express');
const request = require('supertest'); // for mock call to prediction
const app = require('../app');        // for mock call to prediction

const logger = require('../config/winston');
const Agency = require('../models').Agency;
const predictionRoutes = require('./prediction.routes');


/**
 * agency routes
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

            return res.status(200).send(a);
        })
            .catch((e) => {
                logger.error(e);
                res.statuws(400).send(e);
            });
    },

    agencyList: function (req, res) {


        try {
            let predictionFilterData = predictionRoutes.mockData();

            let agencyList = [];
            let map = new Object();
            for (let item of predictionFilterData) {
                if (!map.hasOwnProperty(item.agency)) {
                    map[item.agency] = item.agency;
                    agencyList.push(item.agency)
                }
            }
            agencyList.sort();
            return res.status(200).send(agencyList);
        }catch(e){
            console.log ("in error");
            console.log(e);
            logger.log("error", e, {tag: "agencyList"});
            return res.status(500);
        };

    }
}