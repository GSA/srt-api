const request = require('supertest');
let app = null; // require('../app');;
const mockToken = require("./mocktoken");
const User = require('../models').User;
const env = process.env.NODE_ENV || 'development';
const config = require(__dirname + '/../config/config.json')[env];

const {user1, user_accepted, user3} = require ('./test.data');

var myuser = {};
myuser.firstName = "pred-beforeAllUser";
myuser.email = "crowley+pred@tcg.com";
delete myuser.id;
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
        return User.destroy({where:{firstName: "pred-beforeAllUser"}});
    });


    test ( '/api/predictions/filter', () => {

        return request(app)
            .post('/api/predictions/filter')
            .set('Authorization', `Bearer ${token}`)
            .send()
            .then( (res) => {
               expect(res.statusCode).toBe(200);
               expect(res.body.length).toBeDefined();
               return expect(res.body[0].title).toBeDefined();
            });
    }, 10000);
});
