const request = require('supertest');
const app = require('../app');
var MockExpressRequest = require('mock-express-request');
var MockExpressResponse = require('mock-express-response');

const { authRegister } = require ("./auth.functions.js");


test('test register', async () => {
    expect(4).toBe(4);
    expect(5).toBe(5);


    await(app);
    await(app.connection);

        var request = new MockExpressRequest({
            method: 'PUT',
            body:
                {
                    "firstName": "Phineas",
                    "lastName": "Crowley",
                    "email": "crowley+Phineas@tcg.com",
                    "password": "pass",
                    "agency": "GSA",
                    "position": "director",
                    "userRole": "superuser"
                }
        });

        var response = new MockExpressResponse();

        authRegister(request, response, null);

        expect(response.statusCode).toBe(202);


});
