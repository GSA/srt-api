const request = require('supertest');
let app = null; // require('../app');;
const mockToken = require("./mocktoken");
const User = require('../models').User;
const env = process.env.NODE_ENV || 'development';
const config = require(__dirname + '/../config/config.json')[env];
const db = require('../models/index');


const {user1, user_accepted, user3} = require ('./test.data');

var myuser = {};
myuser.firstName = "pred-beforeAllUser";
myuser.email = "crowley+pred@tcg.com";
delete myuser.id;
var token = {};

describe ('prediction tests', () => {
    beforeAll(  ()=>{

        process.env.MAIL_ENGINE = "nodemailer-mock";
        app = require('../app'); // don't load the app till the mock is configured

        myuser = Object.assign({}, user_accepted);
        delete myuser.id;
        return User.create({myuser})
            .then( (user) => {
                myuser.id = user.id;
                token = mockToken(myuser);
            });
    });

    afterAll( ()=>{
        return User.destroy({where:{firstName: "pred-beforeAllUser"}});
    });


    test ( 'Empty predictions filter ', () => {

        return request(app)
            .post('/api/predictions/filter')
            .set('Authorization', `Bearer ${token}`)
            .send()
            .then( (res) => {
               expect(res.statusCode).toBe(200);
               expect(res.body.length).toBeDefined();
               return expect(res.body[0].title).toBeDefined();
            });
    }, 60000);

    test ( 'Filter predictions to only return a certain office', () => {

        return request(app)
            .post('/api/predictions/filter')
            .set('Authorization', `Bearer ${token}`)
            .send({office: "u.s. army corps of engineers"})
            .then( (res) => {
                expect(res.statusCode).toBe(200);
                expect(res.body.length).toBeDefined();
                expect(res.body[0].title).toBeDefined();

                for(let i=0; i < res.body.length; i++) {
                    expect(res.body[i].office).toBe("u.s. army corps of engineers");
                }
            })
            .then( () => {
                return request(app)
                    .post('/api/predictions/filter')
                    .set('Authorization', `Bearer ${token}`)
                    .send({office: "not the u.s. army corps of engineers"})
                    .then( (res) => {
                        expect(res.statusCode).toBe(200);
                        expect(res.body.length).toBeDefined();
                        expect(res.body.length).toBe(0);

                    })
            })
    }, 60000);


    test ( 'Filter predictions on multiple dimensions', () => {

        return request(app)
            .post('/api/predictions/filter')
            .set('Authorization', `Bearer ${token}`)
            .send({
                eitLikelihood: "Yes",
                agency: "department of the army",
                numDocs: 2
            })
            .then( (res) => {
                expect(res.statusCode).toBe(200);
                expect(res.body.length).toBeDefined();
                expect(res.body[0].title).toBeDefined();

                for(let i=0; i < res.body.length; i++) {
                    expect(res.body[i].eitLikelihood.value).toBe("Yes");
                    expect(res.body[i].agency).toBe("department of the army");
                    expect(res.body[i].parseStatus.length).toBe(2);
                }
            })
    }, 60000);

    test ( 'Filter predictions on solication number', () => {

        return db.sequelize.query("select notice_number from notice order by id desc limit 1")
            .then( (rows) => {
                let notice_num = rows[0][0].notice_number;
                expect(notice_num).toBeDefined();
                return request(app)
                    .post('/api/predictions/filter')
                    .set('Authorization', `Bearer ${token}`)
                    .send({
                        solNum: notice_num,
                    })
                    .then( (res) => {
                        expect(res.statusCode).toBe(200);
                        expect(res.body.length).toBe(1);
                        expect(res.body[0].title).toBeDefined();
                        expect(res.body[0].solNum).toBe(notice_num);

                    })
            })

    }, 60000);

    test ( 'Test unsupported parameter for Filter predictions', () => {

        return request(app)
            .post('/api/predictions/filter')
            .set('Authorization', `Bearer ${token}`)
            .send({
                reviewStatus: "yes",
            })
            .then( (res) => {
                expect(res.statusCode).toBe(500);
                expect(res.body.message).toMatch("unsupported");
            })
            .then ( () => {
                return request(app)
                    .post('/api/predictions/filter')
                    .set('Authorization', `Bearer ${token}`)
                    .send({
                        contact: "",
                    })
                    .then( (res) => {
                        // if you send an empty unsupported filter, that's not an error.
                        expect(res.statusCode).toBe(200);
                    })
                    .then( () => {
                        return request(app)
                            .post('/api/predictions/filter')
                            .set('Authorization', `Bearer ${token}`)
                            .send({
                                contact: "joe",
                            })
                            .then( (res) => {
                                expect(res.statusCode).toBe(500);
                            })
                    })
            })
    }, 60000);

    test ( 'Test prediction date filters', () => {

        return request(app)
            .post('/api/predictions/filter')
            .set('Authorization', `Bearer ${token}`)
            .send({
                startDate: "12/20/2018",
                endDate: "12/23/2018"
            })
            .then( (res) => {
                expect(res.statusCode).toBe(200);
                expect(res.body.length).toBeGreaterThan(1);
                for(let i=0; i < res.body.length; i++) {
                    expect(new Date(res.body[i].date) > new Date(2018,11,19)).toBeTruthy(); // don't forget months are 0 indexed!
                    expect(new Date(res.body[i].date) < new Date(2018,11,25)).toBeTruthy();

                }

            })
    }, 60000);
});
