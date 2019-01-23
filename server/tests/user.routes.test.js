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
const logger = require('../config/winston');

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

    beforeAll(  ()=>{

        var filter_user = Object.assign({}, user_accepted);
        filter_user.firstName = "beforeAll-filter";
        filter_user.isAccepted = true;
        delete filter_user.id;

        return User.create(filter_user).then( () => {
            return User.create(user1)
                .then( (user) => {
                    user_1_id = user.id;
                    return user.id;
                })
                .then( () => {
                    return User.create(user_accepted)
                        .then( (user2) => {
                            token = mockToken(user2);
                            accepted_user_id = user2.id;
                        })
                })
                .then( () => {
                    return User.create(user_rejected);
                })
        });


    });
    afterAll( ()=>{
       return User.destroy({where:{firstName: "beforeAllUser"}})
           .then ( async () => {
               await User.destroy({where:{email: "crowley+Phineas@tcg.com"}});
               await User.destroy({where:{email: "crowley+accepted@tcg.com"}});
               await User.destroy({where:{email: "crowley+rejected@tcg.com"}});
               await User.destroy({where:{email: null}});
               return User.destroy({where:{firstName: "beforeAll-filter"}});
           });
    });

    test('/api/user/update', async() => {
        return request(app)
            .post("/api/user/update")
            .send({id: user_1_id, isAccepted: false, isRejected: false})
            .set('Authorization', `Bearer ${token}`)
            .then( (res) => {
                expect(res.statusCode).toBe(200);
                return User.findByPk(user_1_id).then( (user) => {
                    expect(user.isAccepted).toBeFalsy;
                    return expect(user.isRejected).toBeFalsy;
                });
            })
    });

    test('/api/user/getCurrentUser', async () => {
        return request(app)
            .post("/api/user/getCurrentUser")
            .send({})
            .set('Authorization', `Bearer ${token}`)
            .then((res) => {
                expect(res.statusCode).toBe(200);
                return expect(res.body.creationDate).toBe(user_accepted.creationDate);
            })
            .then( () => {
                return request(app)
                    .post("/api/user/getCurrentUser")
                    .send({})
                    // .set('Authorization', `Bearer ${token}`)  // no token for this test!
                    .then((res) => {
                        expect(res.statusCode).toBe(401);
                    });
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
                // logger.error (res.body);
                expect(user.email).toBe(user_accepted.email + "");
            });

    });

    test('test filter', async () => {
        return request(app)
            .post("/api/user/filter")
            .send({isAccepted : true})
            .set('Authorization', `Bearer ${token}`)
            .then( (res) => {
                expect(res.statusCode).toBe(200);  // http status created
                expect(res.body.length).toBeMoreThan  (0, "didn't get any results from the user filter");
            });
    });

    test('authentication required', async () => {
        return request(app)
            .post('/api/user/filter')
            .then( (response) => {
                return expect(response.statusCode).toBe(401, "should have rejected an unauthorized request. Got status code " + response.statusCode );
            });
    })


});

