const logger = require('../config/winston');
const request = require('supertest');
let app = require('../app');
const mockToken = require("./mocktoken");
const User = require('../models').User;
const env = process.env.NODE_ENV || 'development';
const config = require(__dirname + '/../config/config.json')[env];

const {user1, user_accepted, user3} = require ('./test.data');

var myuser = {};
var token = {};

describe ('/api/email', () => {
    beforeAll(  ()=>{

        myuser = Object.assign({}, user_accepted);
        myuser.firstName = "an-beforeAllUser";
        myuser.email = "crowley+an@tcg.com";
        delete myuser.id;
        return User.create({myuser})
            .then( (user) => {
                myuser.id = user.id;
                token = mockToken(myuser);
            });
    });

    afterAll( ()=>{
        return User.destroy({where:{firstName: "an-beforeAllUser"}});
    });


    test ( '/api/analytics', () => {

        return request(app)
            .post("/api/analytics")
            .set('Authorization', `Bearer ${token}`)
            .send({agency: "Government-wide", fromPeriod: "1/1/1900", toPeriod: "12/31/2100"})
            .then ( (res) => {
                expect(res.statusCode).toBe(200);
                expect(res.body.TopSRTActionChart).toBeDefined()
                expect(res.body.TopSRTActionChart.determinedICT).toBeDefined()
                expect(res.body.TopSRTActionChart.determinedICT).toBeGreaterThan(2);
                return expect(res.body.TopAgenciesChart).toBeDefined();
            });



    });
});