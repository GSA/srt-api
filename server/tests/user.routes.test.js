const request = require('supertest');
let app = null; // require('../app')();
let user_routes = null; //
let auth_routes = null;
const randomString = require('randomstring');
const bcrypt = require('bcryptjs');

const MockExpressRequest = require('mock-express-request');
const MockExpressResponse = require('mock-express-response');
const expect = require("expect");
const mockToken = require("./mocktoken");
const nodemailerMock = require('nodemailer-mock');

const User = require('../models').User;
const logger = require('../config/winston');
const env = process.env.NODE_ENV || 'development';
const config = require(__dirname + '/../config/config.json')[env];

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

        process.env.MAIL_ENGINE = "nodemailer-mock";
        app = require('../app')(); // don't load the app till the mock is configured
        user_routes = require('../routes/user.routes'); // don't load the user_routes till the email mock is configured
        auth_routes = require('../routes/auth.routes');

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
                            // token belongs to user_accepted
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
               await User.destroy({where:{email: "crowley+Phineas2@tcg.com"}});
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
            .then( () => {
                return request(app)
                    .post("/api/user/updateUserInfo")
                    .send({id: user_1_id, isAccepted: false, isRejected: false})
                    .set('Authorization', `Bearer ${token}`)
                    .then( (res) => {
                        expect(res.statusCode).toBe(200);
                        return User.findByPk(user_1_id).then( (user) => {
                            expect(user.isAccepted).toBeFalsy;
                            return expect(user.isRejected).toBeFalsy;
                        });
                    })
            })
            .then( () => {
                return request(app)
                    .post("/api/user/updateUserInfo")
                    .send({UserID: user_1_id, NewEmail: "crowley+Phineas2@tcg.com"})
                    .set('Authorization', `Bearer ${token}`)
                    .then( (res) => {
                        expect(res.statusCode).toBe(200);
                        return User.findByPk(user_1_id).then( (user) => {
                            return expect(user.email).toBe("crowley+Phineas2@tcg.com");
                        });
                    })
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

        let count = 1;
        // fail to update b/c we didn't use correct temp password
        await request(app)
            .post("/api/user/updatePassword")
            .send({password :new_password, oldpassword: 'not the old password or temp password'})
            .set('Authorization', `Bearer ${token}`)
            .then( (res) => {
                expect(res.statusCode).toBe(401);
            })

        // update with correct temp password
        nodemailerMock.mock.reset();
        await request(app)
            .post("/api/user/updatePassword")
            .send({password :new_password, oldpassword: 'tpass'}) // start out with the temp password
            .set('Authorization', `Bearer ${token}`)
            .then( (res) => {
                expect(res.statusCode).toBe(200);
                let sentMail = nodemailerMock.mock.sentMail();
                expect(sentMail.length).toBe(1);
                expect(sentMail[0].to).toBe(user_accepted.email);
                expect(sentMail[0].from).toBe(config.emailFrom);
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

        // update with correct temp password
        var new_password_2 = randomString.generate();
        nodemailerMock.mock.reset();
        return await request(app)
            .post("/api/user/updatePassword")
            .send({password :new_password_2, oldpassword: new_password})
            .set('Authorization', `Bearer ${token}`)
            .then( (res) => {
                expect(res.statusCode).toBe(200);
                let sentMail = nodemailerMock.mock.sentMail();
                expect(sentMail.length).toBe(1);
                expect(sentMail[0].to).toBe(user_accepted.email);
                expect(sentMail[0].from).toBe(config.emailFrom);
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

    test('test getUserInfo', async () => {
        return request(app)
            .post('/api/user/getUserInfo')
            .set('Authorization', `Bearer ${token}`)
            .send({UserID : 1})
            .then( (response) => {
                expect(response.statusCode).toBe(200);
                expect(response.body.email).toMatch(/[a-zA-Z]+@[a-zA-Z]+\.[a-zA-Z]+/)
            });
    })

})