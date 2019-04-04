const logger = require('../config/winston');
const request = require('supertest');
let app = require('../app')();
const mockToken = require("./mocktoken");
const User = require('../models').User;
const env = process.env.NODE_ENV || 'development';
const config = require(__dirname + '/../config/config.json')[env];

const {user1, user_accepted, user3} = require ('./test.data');

var myuser = {};
var token = {};

describe ('/api/analytics', () => {

    test('Get version', () => {
        return request(app)
            .get("/api/version")
            .send({})
            .then( res => {
                expect(res.statusCode).toBe(200);
                expect(["development", "gitlab", "test", "circle"]).toContain(res.body.env);
                expect(res.body.version).toBeDefined();
                return expect (res.body.version).toMatch(/^v[0-9]+\.[0-9]+\.[0-9]+$/);
            })
    });
});

