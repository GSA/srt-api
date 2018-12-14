const request = require('supertest');
const app = require('../app');
var MockExpressRequest = require('mock-express-request');
var MockExpressResponse = require('mock-express-response');
var expect = require("expect");

const user_routes = require('../routes/user.routes');
const auth_routes = require('../routes/auth.routes');
const User = require('../models').User;

const {user1, user_accepted, user_rejected} = require ('./test.data');

describe ('/api/user/filter', () => {

    beforeAll( async ()=>{
        return auth_routes.create( new MockExpressRequest({method: 'PUT', body: user_accepted}), new MockExpressResponse())
            .then( () => {return auth_routes.create( new MockExpressRequest({method: 'PUT', body: user_rejected}), new MockExpressResponse());})
    });
    afterAll( ()=>{
       return User.destroy({where:{firstName: "beforeAllUser"}});
    });

    test('test filter', async () => {
        var request = new MockExpressRequest({
            method: 'GET',
            body:{"isAccepted": "true" }
        });

        var response = {
            send: function(s) {
                this.body = s;
                return this;},
            status: function(stat) {this.statusCode = stat; return this;}
        };

        await user_routes.filter(request, response);
        expect(response.statusCode).toBe(200);  // http status created
        expect(response.body.length).toBeMoreThan  (0, "didn't get any results from the user filter");



        var request = new MockExpressRequest({
            method: 'GET',
            body:{"isRejected": "true" }
        });

        await user_routes.filter(request, response);
        expect(response.statusCode).toBe(200);  // http status created
        expect(response.body.length).toBeMoreThan  (0, "didn't get any results from the user filter looking for rejected users");

    });

    test('authentication required', async () => {
        await request(app)
            .get('/api/user/filter')
            .then( (response) => {
                expect(response.statusCode).toBe(401, "should have rejected an unauthorized request. Got status code " + response.statusCode );
            });
    })


});

