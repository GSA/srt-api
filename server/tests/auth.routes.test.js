const supertest = require('supertest');
const request = require('supertest');
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


    test('/api/auth/login', async () => {

        await request(app)
            .post("/api/auth/login")
            .send({email : myuser.email})
            .then((res) => {
                expect(res.statusCode).toBe(401);
            });

        await request(app)
            .post("/api/auth/login")
            .send({other: "thing"})
            .then((res) => {
                expect(res.statusCode).toBe(401);
            });

        await request(app)
            .post("/api/auth/login")
            .send({email : myuser.email, password: "wrong password"})
            .then((res) => {
                expect(res.statusCode).toBe(401);
            });

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


        // authRegister(request, response, null);
        //
        // expect(response.statusCode).toBe(202);


    });


});

