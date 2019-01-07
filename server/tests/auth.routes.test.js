const supertest = require('supertest');
const request = require('supertest');
var bcrypt = require('bcryptjs');
const app = require('../app');
var MockExpressRequest = require('mock-express-request');
var MockExpressResponse = require('mock-express-response');
const mockToken = require("./mocktoken");
const User = require('../models').User;

const auth_routes = require('../routes/auth.routes');
const {user1, user_accepted, user3} = require ('./test.data');

var myuser = user_accepted;
myuser.firstName = "auth-beforeAllUser";
myuser.email = "crowley+auth@tcg.com";
var myuser_pass = "this is the new password";
var token = {};

describe ('/api/auth/', () => {
    beforeAll( async ()=>{

        await request(app)
            .post("/api/auth")
            .send(myuser);

        return User.find({where:{email:myuser.email}})
            .then( async user => {
                myuser.id = user.id;
                token = mockToken(myuser);

                return request(app)
                    .post("/api/user/updatePassword")
                    .set('Authorization', `Bearer ${token}`)
                    .send({oldpassword:myuser.tempPassword, password: myuser_pass})
            });



    });

    afterAll( ()=>{
        return User.destroy({where:{firstName: "auth-beforeAllUser"}});
    });

    test ( '/api/auth/tokenCheck', async () => {
        var user = Object.assign({}, myuser);
        user.userRole = "Administrator"
        var token = mockToken(user);

        return request(app)
            .post('/api/auth/tokenCheck')
            .send({token:token})
            // send a real token (GSA)
            .then( (res) => {
                expect(res.statusCode).toBe(200);
                expect(res.body.isLogin).toBe(true);
                expect(res.body.isGSAAdmin).toBe(false);
            })
            // send a real token (non-GSA)
            .then( () => {
                var user = Object.assign({}, myuser);
                user.userRole = "Public";
                var token = mockToken(user);
                return request(app)
                    .post('/api/auth/tokenCheck')
                    .send( {token : "token fake"})
                    .then ( (res) => {
                        expect(res.statusCode).toBe(200);
                        expect(res.body.isLogin).toBe(false);
                        expect(res.body.isGSAAdmin).toBe(false);
                    })
            })
            // send a fake token
            .then ( (res) => {
                return request(app)
                    .post('/api/auth/tokenCheck')
                    .send( {token : "token fake"})
                    .then ( (res) => {
                        expect(res.statusCode).toBe(200);
                        expect(res.body.isLogin).toBe(false);
                        expect(res.body.isGSAAdmin).toBe(false);
                    })
            })
            // send NO token
            .then ( () => {
                return request(app)
                    .post('/api/auth/tokenCheck')
                    .send( {no_token : "token fake"})
                    .then ( (res) => {
                        expect(res.statusCode).toBe(400);
                    })
            })


    });

    test ('/api/auth/resetPassword', async () => {
        var user = Object.assign({}, user_accepted)
        user.firstName = "auth-beforeAllUser";
        user.email = "crowley+auth3@tcg.com";
        delete user.id;
        var user_pass = "this is the new password";
        return User.create(user)
            .then( () => {
                return request(app)
                    .post('/api/auth/resetPassword')
                    .send({email: user.email})
                    .then((res) => {
                        expect(res.statusCode).toBe(200);
                        expect(res.body.tempPassword).toBeDefined();
                        expect(res.body.message).toContain('password request');

                        return User.findOne({where : {email:user.email}})
                            .then( (u) => {
                                var success = res.body.tempPassword == u.tempPassword;
                                expect(success).toBe(true);
                            })
                    })

                })
            // make sure we don't fail on bad email
            .then( () => {
                return request(app)
                    .post('/api/auth/resetPassword')
                    .send({email: "fake@example.com"})
                    .then((res) => {
                        expect(res.statusCode).toBe(200);
                        expect(res.body.message).toContain('password request');
                    })
            })
            // make sure we don't fail with no email
            .then( () => {
                return request(app)
                    .post('/api/auth/resetPassword')
                    .send({})
                    .then((res) => {
                        expect(res.statusCode).toBe(200);
                        expect(res.body.message).toContain('password request');
                    })
            })
            .catch( e => {
                console.log(e);
            })



    })


    test('/api/auth/login', async () => {

        // test no password
        await request(app)
            .post("/api/auth/login")
            .send({email : myuser.email})
            .then((res) => {
                expect(res.statusCode).toBe(401);
            });

        // test no email or password
        await request(app)
            .post("/api/auth/login")
            .send({other: "thing"})
            .then((res) => {
                expect(res.statusCode).toBe(401);
            });

        // test wrong password
        await request(app)
            .post("/api/auth/login")
            .send({email : myuser.email, password: "wrong password"})
            .then((res) => {
                expect(res.statusCode).toBe(401);
            });

        // test correct password
        await request(app)
            .post("/api/auth/login")
            .send({email : myuser.email, password: myuser_pass})
            .then((res) => {
                expect(res.statusCode).toBe(200);
                expect(res.body.token).toBeDefined();
                expect(res.body.firstName).toBe(user_accepted.firstName);
            });

    });



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


        // now try the actual api router
        await supertest(app)
            .post('/api/auth')
            .send(user_accepted)
            .then( (response) => {
                expect(response.statusCode).toBe(201);
            })
    });



});

