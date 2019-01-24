const supertest = require('supertest');
const request = require('supertest');
let app = null; // require('../app');;
const nodemailerMock = require('nodemailer-mock');
const mockToken = require("./mocktoken");
const User = require('../models').User;
const env = process.env.NODE_ENV || 'development';
const config = require(__dirname + '/../config/config.json')[env];

const {user1, user_accepted, user3} = require ('./test.data');

var myuser = {};
myuser.firstName = "email-beforeAllUser";
myuser.email = "crowley+email@tcg.com";
var token = {};

describe ('/api/email', () => {
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
        return User.destroy({where:{firstName: "email-beforeAllUser"}});
    });


    test ( '/api/email', () => {

        // text: req.body.text,
        //     from: "Solicitation Review Tool <solicitationreview@gmail.com>",
        //     to: req.body.emailTo,//req.body.email,
        //     cc: req.body.emailCC,
        //     subject: req.body.subject

        let email = {
            text: "This is the message body text sent by a unit test.",
            emailTo: "crowley@tcg.com",
            emailCC: "c@example.com",
            subject: "srt unit test at " + (new Date()).toLocaleString()
        }


        nodemailerMock.mock.reset();
        return request(app)
            .post ("/api/email")
            .set('Authorization', `Bearer ${token}`)
            .send ({body: "this is the body text"})
            .then( (res) => {
                expect(nodemailerMock.mock.sentMail.length).toBe(0);
                expect(res.statusCode).toBe(400);
            })
            .then ( () => {
                nodemailerMock.mock.reset();
                return request(app)
                   .post("/api/email")
                   .set('Authorization', `Bearer ${token}`)
                   .send (email)
                   .then( (res) => {
                       var sentMail = nodemailerMock.mock.sentMail();
                       expect(res.statusCode).toBe(200);
                       expect(sentMail.length).toBe(1);
                       expect(sentMail[0].to).toBe("crowley@tcg.com");
                       expect(sentMail[0].from).toBe(config.emailFrom);
                   })
            });
    }, 15000);

    test ( '/api/email/updatePassword', () => {
        nodemailerMock.mock.reset();
        return request(app)
            .post ("/api/email/updatePassword")
            .set('Authorization', `Bearer ${token}`)
            .send ({})
            .then( (res) => {
                var sentMail = nodemailerMock.mock.sentMail();
                expect(res.statusCode).toBe(200);
                expect(sentMail.length).toBe(1);
                expect(sentMail[0].to).toBe(myuser.email);
                expect(sentMail[0].from).toBe(config.emailFrom);
            })
    }, 15000);


});

