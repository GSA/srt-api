/** @module AgencyRoutes */
const logger = require('../config/winston');
const Agency = require('../models').Agency;
const db = require('../models/index');


/**
 * Defines the functions used to process the various Agency related API routes.
 */
module.exports = {

    /**
     * PUT /api/agencies
     *
     * This function creates a new agency record.
     *
     *
     * @param {Request} req - request
     * @param {Object} req.body - body of requiest
     * @param {string} req.body.agency - agency name to be added
     * @param {string} req.body.acronym - agency acronym to be added
     *
     * @param {Object} res - Response object
     */
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

    /**
     * GET /api/agencies
     *
     * Returns the list of all agencies
     * (legacy code naming convention)
     * <br>
     * Sends an array of {Agency: string, Acronym: string} objects
     *
     * @param {Request} req - unused
     * @param {Response} res - Response object
     * @returns Promise
     */
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

    /**
     * GET /api/agencyList<br>
     *
     * Sends a response containing an array of agency name strings: <br>
     *     [ string, string, string, ... ]
     *
     * @param {Request} req - unused
     * @param {Response} res - Response object
     * @return Promise
     */
    agencyList: function (req, res) {
        db.sequelize.query("select distinct agency from notice order by agency", {type: db.sequelize.QueryTypes.SELECT})
            .then ( agencies => {
                let agencyList = [];
                agencies.forEach( (a) => {agencyList.push(a.agency)});
                return res.status(200).send(agencyList);
            })
            .catch( e => {
                logger.log("error", e, {tag: "agencyList"});
                return res.status(500);
            })

    }
}