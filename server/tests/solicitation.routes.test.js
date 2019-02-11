const request = require('supertest');
let app = null; // require('../app')();;
const mockToken = require("./mocktoken");
const User = require('../models').User;
const env = process.env.NODE_ENV || 'development';
const config = require(__dirname + '/../config/config.json')[env];
const db = require('../models/index');


const randomWords = require('random-words');

const {user1, user_accepted, user3} = require('./test.data');

var myuser = {};
myuser.firstName = "sol-beforeAllUser";
myuser.email = "crowley+sol@tcg.com";
delete myuser.id;
var token = {};

describe('prediction tests', () => {
    beforeAll(() => {

        process.env.MAIL_ENGINE = "nodemailer-mock";
        app = require('../app')(); // don't load the app till the mock is configured

        myuser = Object.assign({}, user_accepted);
        delete myuser.id;
        return User.create({myuser})
            .then((user) => {
                myuser.id = user.id;
                token = mockToken(myuser);
            });
    });

    afterAll(() => {
        return User.destroy({where: {firstName: "sol-beforeAllUser"}});
    });


    test('solicitation post', () => {

        return db.sequelize.query("select notice_number from notice order by id desc limit 1")
            .then( (rows) => {
                let notice_num = rows[0][0].notice_number;
                expect(notice_num).toBeDefined();



                let word1 = randomWords.wordList[Math.floor(Math.random() * randomWords.wordList.length)];
                let word2 = randomWords.wordList[Math.floor(Math.random() * randomWords.wordList.length)];
                let actionDate = (new Date()).toLocaleString();

                return request(app)
                    .post("/api/solicitation")
                    .set('Authorization', `Bearer ${token}`)
                    .send(
                        {
                            "solNum": notice_num,
                            "actionStatus": "reviewed solicitation action requested summary",
                            "actionDate": actionDate,
                            "history": [
                                {
                                    "date": "03/03/2018",
                                    "action": "sending",
                                    "user": word1,
                                    "status": "submitted"
                                },
                                {
                                    "date": actionDate,
                                    "action": "reviewed solicitation action requested summary",
                                    "user": word2,
                                    "status": "submitted"
                                },
                                {
                                    "date": "2/1/2019",
                                    "action": "again reviewed solicitation action requested summary",
                                    "user": word1,
                                    "status": ""
                                }

                            ],
                            "feedback": [
                                {
                                    "questionID": "1",
                                    "question": "Is this a good solicitation?",
                                    "answer": "Yes"
                                }
                            ]
                        }
                    )
                    .then((res) => {
                        expect(res.statusCode).toBe(200);
                        expect(res.body.feedback[0].questionID).toBe("1");
                        expect(res.body.action.actionDate).toBe(actionDate);
                        expect(res.body.history[0].user).toBe(word1)
                        return expect(res.body.history[1].user).toBe(word2)

                    });
            })

    });

    test('solicitation get', () => {
        return db.sequelize.query("select id from notice order by notice_number desc limit 1")
            .then( (rows) => {
                let id = rows[0][0].id;
                expect(id).toBeDefined();

                return request(app)
                    .get("/api/solicitation/" + id)
                    .set('Authorization', `Bearer ${token}`)
                    .send( {} )
                    .then((res) => {
                        expect(res.statusCode).toBe(200);
                        expect(res.body.solNum).toBeDefined();
                        expect(res.body.id).toBe(id);
                        return expect(res.body.agency).toBeDefined();
                    });
            });
    });

    test.skip('solicitation feedback', () => {
        return request(app)
            .post("/api/feedback")
            .set('Authorization', `Bearer ${token}`)
            // TODO: fix send parameters
            .send(
                {
                    "solNum": 5790550,
                    "title": "undefined undefined",
                    "url": "http://www.tcg.com/",
                    "predictions": {
                        "value": "GREEN"
                    },
                    "reviewRec": "Non-compliant (Action Required)",
                    "date": "2019-12-26T00:00:00.000Z",
                    "numDocs": 1,
                    "eitLikelihood": {
                        "naics": 85936,
                        "value": "Yes"
                    },
                    "agency": "Operations Office",
                    "office": "undefined undefined undefined",
                    "contactInfo": {
                        "contact": "contact str",
                        "name": "Joe Smith",
                        "position": "Manager",
                        "email": "joe@example.com"
                    },
                    "position": "pos string",
                    "reviewStatus": "on time",
                    "noticeType": "Special Notice",
                    "actionStatus": "reviewed solicitation action requested summary",
                    "actionDate": "2019-11-23T00:00:00.000Z",
                    "parseStatus": [
                        {
                            "name": "doc 1",
                            "status": "successfully parsed"
                        },
                        {
                            "name": "doc 1",
                            "status": "successfully parsed"
                        }
                    ],
                    "history": [
                        {
                            "date": "03/03/2018",
                            "action": "sending",
                            "user": "crowley",
                            "status": "submitted"
                        },
                        {
                            "date": "2/1/2019",
                            "action": "reviewed solicitation action requested summary",
                            "user": "Al Crowley",
                            "status": ""
                        }
                    ],
                    "feedback": [
                        {
                            "questionID": "1",
                            "question": "Is this a good solicitation?",
                            "answer": "Yes"
                        }
                    ],
                    "undetermined": true
                }
            )
            .then((res) => {
                expect(res.statusCode).toBe(200);
                expect(res.body.TopSRTActionChart).toBeDefined()
                expect(res.body.TopSRTActionChart.determinedICT).toBeDefined()
                expect(res.body.TopSRTActionChart.determinedICT).toBeGreaterThan(2);
                return expect(res.body.TopAgenciesChart).toBeDefined();
            });

    });

    test ( 'get solicitation feedback (using POST of all things because that is how the UI is coded', () => {


        let mock_db =
            { sequelize:
                    {   query: () => {
                        return new Promise(function (resolve, reject) {

                            resolve([
                                {feedback: [{question: "q1", answer: "a1"}, {question: "q1", answer: "a1"}]},
                                {feedback: [{question: "q1", answer: "a1"}, {question: "q1", answer: "a1"}]},
                                {feedback: [{question: "q1", answer: "a1"}, {question: "q1", answer: "a1"}]},
                            ])

                        })
                        },
                        QueryTypes: {SELECT:7}
                    }

            };


        let app = require('../app')(mock_db);

        return request(app)
            .post('/api/solicitation/feedback')
            .set('Authorization', `Bearer ${token}`)
            .send({$where: "{this.feedback.length > 0}"
            })
            .then( (res) => {
                expect(res.statusCode).toBe(200);
                expect(res.body.length).toBeGreaterThan(1);
                for(let i=0; i < res.body.length; i++) {
                    expect(res.body[i].feedback.length).toBeGreaterThan(0);
                    expect(res.body[i].feedback[0].question).toBeDefined();
                }

            })
    });

}); // end describe