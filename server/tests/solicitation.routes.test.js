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

describe('solicitation tests', () => {
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


    // TODO: add mocking to make this test work
    test('solicitation post', () => {

        return db.sequelize.query("select count(*), solicitation_number from notice group by solicitation_number having count(*) > 5 limit 1")
            .then( (rows) => {
                let notice_num = rows[0][0].solicitation_number;
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

                    })
                    .then( () => {
                        // make sure that we actually updated the correct one. Should be the latest
                        let sql = ` select a.history from notice a
                                    left outer join notice b on (a.solicitation_number = b.solicitation_number and a.date < b.date)
                                    where b.id is null and a.solicitation_number = '${notice_num}'`;
                        return db.sequelize.query(sql)
                            .then( (rows) => {
                                let hist = rows[0][0].history;
                                expect(hist.length).toBeGreaterThan(2);
                                return expect(hist[2].action).toMatch(/again reviewed solicitation/)
//                                return console.log ("history is: ", rows[0][0]);
                            })
                    })
            })

    });

    test('solicitation get', () => {
        return db.sequelize.query("select id from notice order by solicitation_number desc limit 1")
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

    test ( 'Test document count', () => {
        return db.sequelize.query("select solicitation_number , count(*) as c from attachment join notice n on attachment.notice_id = n.id group by solicitation_number order by count(*) desc;")
            .then((rows) => {
                let solNum = rows[0][0].solicitation_number;
                let count = rows[0][0].c
                return db.sequelize.query(`select id from notice where solicitation_number = '${solNum}' limit 1`)
                    .then( rows => {
                        let notice_id = rows[0][0].id;
                        return request(app)
                            .get("/api/solicitation/" + notice_id)
                            .set('Authorization', `Bearer ${token}`)
                            .send({})
                            .then((res) => {
                                expect(res.statusCode).toBe(200);
                                expect(res.body.solNum).toBe(solNum);
                                expect(res.body.numDocs).toBe(parseInt(count));
                                return expect(res.body.agency).toBeDefined();
                            });
                    })
            })
    })


    test ( 'get solicitation feedback (using POST of all things because that is how the UI is coded', () => {
        let mock_db =
            { sequelize:
                    {   query: (sql) => {

                        let set = [
                            {feedback: [{question: "q1", answer: "a1"}, {question: "q1", answer: "a1"}]},
                            {},
                            {feedback: [{question: "q1", answer: "a1"}, {question: "q1", answer: "a1"}]},
                            {solicitation_number: "sprra1-19-r-0069", feedback: [{question: "q1", answer: "a1"}, {question: "q1", answer: "a1"}]},
                            {feedback: []},
                            {feedback: [{question: "q1", answer: "a1"}, {question: "q1", answer: "a1"}]},
                        ];

                        if (sql.match(/select.*where.*jsonb_array_length\(feedback\).?>.?0/i)) {
                            set = set.filter( x => {return (x.feedback && x.feedback.length && x.feedback.length > 0) });
                        }

                        if (sql.match(/select.*where.*solicitation_number.?=.*sprra1-19-r-0069/i)) {
                            set = set.filter( x => {return (x.solicitation_number && x.solicitation_number == "sprra1-19-r-0069")});
                        }
                        return new Promise(function (resolve, reject) {
                            resolve(set)
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
            .then ( () => {
                return request(app)
                    .post('/api/solicitation/feedback')
                    .set('Authorization', `Bearer ${token}`)
                    .send({solNum: "sprra1-19-r-0069"})
            })
            .then ( (res) => {
                expect(res.statusCode).toBe(200);
                expect(res.body.length).toBe(1);
                expect(res.body[0].solNum).toBe("sprra1-19-r-0069");

            })
    });

}); // end describe
