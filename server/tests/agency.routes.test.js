const request = require('supertest');
const app = require('../app');
const mockToken = require("./mocktoken");
const logger = require('../config/winston');
const Agency = require('../models').Agency;

const {user1, user_accepted, user3} = require ('./test.data');


describe ('/api/agencies', () => {
    let agency = "abc";
    let acronym = "def";

    beforeAll( ()=>{});
    afterAll ( () => {
        return Agency.destroy( {where: {agency: agency}});

    });

    test( '/api/agencies (get)', async () => {
        return request(app)
            .get('/api/agencies')
            .then( (res) => {
                expect(res.statusCode).toBe(200);
                expect(res.body.length).toBeGreaterThan(2);
                expect(res.body).toContainEqual({"acronym": "GSA", "agency": "General Services Administration"});

            });
    });


    test( '/api/agencies (put)', async () => {

        return request(app)
            .put('/api/agencies')
            .send({agency:agency, acronym: acronym})
            .then( (res) => {

                expect(res.statusCode).toBe(200);
                return Agency.findOne({where : {acronym: "def"}})
                    .then ( (a) => {
                        return expect(a.agency).toBe(agency);
                    })


            });
    });

});
