const request = require('supertest');
const app = require('../app');
var MockExpressRequest = require('mock-express-request');
var MockExpressResponse = require('mock-express-response');
var expect = require("expect");
var mockToken = require("./mocktoken");

const user_routes = require('../routes/user.routes');
const auth_routes = require('../routes/auth.routes');
const User = require('../models').User;

const {user1, user_accepted, user_rejected} = require ('./test.data');


describe ('/api/user', () => {

    var accepted_user_id = 0;
    var token = {};
    var mock_response = {
        send: function(s) {
            this.body = s;
            return this;},
        status: function(stat) {this.statusCode = stat; return this;}
    };

    beforeAll( async ()=>{

        return auth_routes.create( new MockExpressRequest({method: 'PUT', body: user_accepted}), new MockExpressResponse())
            .then( (res) => {
                var user = JSON.parse( res._responseData.toString('utf8'));
                token = mockToken(user);
                accepted_user_id = user.id;
                return auth_routes.create( new MockExpressRequest({method: 'PUT', body: user_rejected}), new MockExpressResponse());
            })
    });
    afterAll( ()=>{
       return User.destroy({where:{firstName: "beforeAllUser"}});
    });

    test('test /api/user/getUserInfo', async () => {

        await request(app)
            .get("/api/user/getUserInfo")
            .send({UserId: accepted_user_id})
            .set('Authorization', `Bearer ${token}`)
            .then( (res) => {
                expect(res.statusCode).toBe(200);
                user = res.body;
                expect(user.email).toBe(user_accepted.email);
            });

    });

    test('test filter', async () => {
        var mock_request = new MockExpressRequest({
            method: 'GET',
            body:{"isAccepted": "true" }
        });


        await user_routes.filter(mock_request, mock_response);
        expect(mock_response.statusCode).toBe(200);  // http status created
        expect(mock_response.body.length).toBeMoreThan  (0, "didn't get any results from the user filter");



        mock_request = new MockExpressRequest({
            method: 'GET',
            body:{"isRejected": "true" }
        });

        await user_routes.filter(mock_request, mock_response);
        expect(mock_response.statusCode).toBe(200);  // http status created
        expect(mock_response.body.length).toBeMoreThan  (0, "didn't get any results from the user filter looking for rejected users");

    });

    test('authentication required', async () => {
        request(app)
            .get('/api/user/filter')
            .then( (response) => {
                expect(response.statusCode).toBe(402, "should have rejected an unauthorized request. Got status code " + response.statusCode );
            });
    })


});

