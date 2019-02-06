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

describe ('/api/analytics', () => {
    beforeAll(() => {

        myuser = Object.assign({}, user_accepted);
        myuser.firstName = "survey-beforeAllUser";
        myuser.email = "crowley+survey@tcg.com";
        delete myuser.id;
        return User.create({myuser})
            .then((user) => {
                myuser.id = user.id;
                token = mockToken(myuser);
            });
    });

    afterAll(() => {
        return User.destroy({where: {firstName: "survey-beforeAllUser"}});
    });


    test('Get surveys', () => {
        return request(app)
            .get("/api/surveys")
            .set('Authorization', `Bearer ${token}`)
            .send({})
            .then( res => {
                expect(res.statusCode).toBe(200);
                return expect(res.body[0].ID).toBeDefined();
            })

    });
});

