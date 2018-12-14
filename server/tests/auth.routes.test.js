var MockExpressRequest = require('mock-express-request');
var MockExpressResponse = require('mock-express-response');

const auth_routes = require('../routes/auth.routes');
const {user1, user2, user3} = require ('./test.data');


describe ('/api/auth/', () => {

    test('test register', async () => {
        expect(4).toBe(4);
        expect(5).toBe(5);


        var request = new MockExpressRequest({
            method: 'PUT',
            body: user1
        });

        var response = {
            send: function(s) { this.body = s; return this;},
            status: function(stat) {this.statusCode = stat; return this;}
        };

        await auth_routes.create(request, response);
        //console.log(response.body)
        expect(response.statusCode).toBe(201);  // http status created


        // authRegister(request, response, null);
        //
        // expect(response.statusCode).toBe(202);


    });


});

