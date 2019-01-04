const request = require('supertest');
const app = require('../app');
const randomString = require('randomstring');
const bcrypt = require('bcryptjs');

const MockExpressRequest = require('mock-express-request');
const MockExpressResponse = require('mock-express-response');
const expect = require("expect");
const mockToken = require("./mocktoken");

const user_routes = require('../routes/user.routes');
const auth_routes = require('../routes/auth.routes');
const User = require('../models').User;

const {user1, user_accepted, user_rejected} = require ('./test.data');


describe ('User API Routes', () => {

    var accepted_user_id = 0;
    var user_1_id = 0;
    var token = {};
    var mock_response = {
        send: function(s) {
            this.body = s;
            return this;},
        status: function(stat) {this.statusCode = stat; return this;}
    };

    beforeAll( async ()=>{

        await auth_routes.create( new MockExpressRequest({method: 'PUT', body: user1}), new MockExpressResponse())
            .then ( (res) => {
                var user = JSON.parse( res._responseData.toString('utf8'));
                user_1_id = user.id;
            });

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

    test('/api/user/update', async() => {
        return request(app)
            .post("/api/user/update")
            .send({_id: user_1_id, isAccepted: false, isRejected: false})
            .set('Authorization', `Bearer ${token}`)
            .then( (res) => {
                expect(res.statusCode).toBe(200);
                return User.findByPk(user_1_id).then( (user) => {
                    expect(user.isAccepted).toBe('false');
                    expect(user.isRejected).toBe('false');
                });
            })
    });

    test('/api/user/getCurrentUser', async () => {
        await request(app)
            .post("/api/user/getCurrentUser")
            .send({})
            .set('Authorization', `Bearer ${token}`)
            .then((res) => {
                expect(res.statusCode).toBe(200);
                expect(res.body.creationDate).toBe(user_accepted.creationDate);
            });

        return request(app)
            .post("/api/user/getCurrentUser")
            .send({})
            // .set('Authorization', `Bearer ${token}`)  // no token for this test!
            .then((res) => {
                expect(res.statusCode).toBe(401);
            });

    });

    test ('/api/user/updatePassword', async () => {
        var new_password = randomString.generate();

        // fail to update b/c we didn't use correct temp password
        await request(app)
            .post("/api/user/updatePassword")
            .send({password :new_password, oldpassword: 'not the old password or temp password'})
            .set('Authorization', `Bearer ${token}`)
            .then( (res) => {
                expect(res.statusCode).toBe(401);
            })


        // update with correct temp password
        await request(app)
            .post("/api/user/updatePassword")
            .send({password :new_password, oldpassword: 'tpass'}) // start out with the temp password
            .set('Authorization', `Bearer ${token}`)
            .then( (res) => {
                expect(res.statusCode).toBe(200);
                return User.findByPk(accepted_user_id)
                    .then ( (user) => {
                        expect( bcrypt.compareSync(new_password, user.password)).toBe(true);
                    })
            })

        // temp password shouldn't work any more
        await request(app)
            .post("/api/user/updatePassword")
            .send({password :new_password, oldpassword: 'tpass'})
            .set('Authorization', `Bearer ${token}`)
            .then( (res) => {
                expect(res.statusCode).toBe(401);
            })

        var new_password_2 = randomString.generate();
        // update with correct temp password
        return await request(app)
            .post("/api/user/updatePassword")
            .send({password :new_password_2, oldpassword: new_password})
            .set('Authorization', `Bearer ${token}`)
            .then( (res) => {
                expect(res.statusCode).toBe(200);
                return User.findByPk(accepted_user_id)
                    .then ( (user) => {
                        expect( bcrypt.compareSync(new_password_2, user.password)).toBe(true);
                    })
            })

    });

    test('test /api/user/getUserInfo', async () => {

        await request(app)
            .get("/api/user/getUserInfo")
            .send({UserId: accepted_user_id})
            .set('Authorization', `Bearer ${token}`)
            .then( (res) => {
                expect(res.statusCode).toBe(200);
                user = res.body;
                // console.log (res.body);
                expect(user.email).toBe(user_accepted.email + "");
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
                expect(response.statusCode).toBe(401, "should have rejected an unauthorized request. Got status code " + response.statusCode );
            });
    })


});

