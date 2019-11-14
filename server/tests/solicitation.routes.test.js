const request = require('supertest')
let app = null // require('../app')();;
const mockToken = require('./mocktoken')
// noinspection JSUnresolvedVariable
const User = require('../models').User
const db = require('../models/index')
const {common} = require('../config/config.js')
const configuration = require('../config/configuration')

const randomWords = require('random-words')

const { userAcceptedCASData } = require('./test.data')

let myUser = {}
myUser.firstName = 'sol-beforeAllUser'
myUser.email = 'crowley+sol@tcg.com'
delete myUser.id
let token = {}

describe('solicitation tests', () => {
  beforeAll(() => {
    process.env.MAIL_ENGINE = 'nodemailer-mock'
    app = require('../app')() // don't load the app till the mock is configured

    myUser = Object.assign({}, userAcceptedCASData)
    delete myUser.id
    return User.create({ myUser: myUser })
      .then(async (user) => {
        myUser.id = user.id
        token = await mockToken(myUser, common['jwtSecret'])
      })
  })

  afterAll(() => {
    return User.destroy({ where: { firstName: 'sol-beforeAllUser' } })
      .then( () => { app.db.close(); })
  })

  test('solicitation post', () => {
    return db.sequelize.query('select count(*), solicitation_number from notice group by solicitation_number having count(*) > 5 limit 1')
      .then((rows) => {
        let noticeNum = rows[0][0].solicitation_number
        expect(noticeNum).toBeDefined()

        let word1 = randomWords.wordList[Math.floor(Math.random() * randomWords.wordList.length)]
        let word2 = randomWords.wordList[Math.floor(Math.random() * randomWords.wordList.length)]
        let actionDate = (new Date()).toLocaleString()

        return request(app)
          .post('/api/solicitation')
          .set('Authorization', `Bearer ${token}`)
          .send(
            {
              'solNum': noticeNum,
              'actionStatus': 'reviewed solicitation action requested summary',
              'actionDate': actionDate,
              'history': [
                {
                  'date': '03/03/2018',
                  'action': 'sending',
                  'user': word1,
                  'status': 'submitted'
                },
                {
                  'date': actionDate,
                  'action': 'reviewed solicitation action requested summary',
                  'user': word2,
                  'status': 'submitted'
                },
                {
                  'date': '2/1/2019',
                  'action': 'again reviewed solicitation action requested summary',
                  'user': word1,
                  'status': ''
                }

              ],
              'feedback': [
                {
                  'questionID': '1',
                  'question': 'Is this a good solicitation?',
                  'answer': 'Yes'
                }
              ]
            }
          )
          .then((res) => {
            // noinspection JSUnresolvedVariable
            expect(res.statusCode).toBe(200)
            expect(res.body.feedback[0].questionID).toBe('1')
            expect(res.body.action.actionDate).toBe(actionDate)
            expect(res.body.history[0].user).toBe(word1)
            return expect(res.body.history[1].user).toBe(word2)
          })
          .then(() => {
            // make sure that we actually updated the correct one. Should be the latest
            let sql = ` select a.history from notice a
                                    left outer join notice b on (a.solicitation_number = b.solicitation_number and a.date < b.date)
                                    where b.id is null and a.solicitation_number = '${noticeNum}'`
            return db.sequelize.query(sql)
              .then((rows) => {
                let hist = rows[0][0].history
                expect(hist.length).toBeGreaterThan(2)
                return expect(hist[2].action).toMatch(/again reviewed solicitation/)
              })
          })
      })
  })

  test('solicitation get', () => {
    return db.sequelize.query('select id, solicitation_number from notice order by date desc, solicitation_number desc limit 1')
      .then((rows) => {
        let id = rows[0][0].id
        let solNum = rows[0][0].solicitation_number
        expect(id).toBeDefined()

        return request(app)
          .get('/api/solicitation/' + id)
          .set('Authorization', `Bearer ${token}`)
          .send({})
          .then((res) => {
            // noinspection JSUnresolvedVariable
            expect(res.statusCode).toBe(200)
            expect(res.body.solNum).toBeDefined()
            res.body
            res.body.solNum
            expect(res.body.solNum).toBe(solNum)
            return expect(res.body.agency).toBeDefined()
          })
      })
  })

  test('sending an non-existing ID to get solicitation', () => {
    return db.sequelize.query('select id from notice order by id desc limit 1')
      .then((rows) => {
        let id = rows[0][0].id + 9999
        expect(id).toBeDefined()
        return request(app)
          .get('/api/solicitation/' + id)
          .set('Authorization', `Bearer ${token}`)
          .send({})
          .then((res) => {
            // noinspection JSUnresolvedVariable
            return expect(res.statusCode).toBe(404)
          })
      })
  })

  test('sending a too large/invalid ID to get solicitation', () => {
    let url = '/api/solicitation/' + Number.MAX_SAFE_INTEGER
    return request(app)
      .get(url)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .then((res) => {
        // noinspection JSUnresolvedVariable
        return expect(res.statusCode).toBe(500)
      })
  })

  // TODO: Had to disable this test because the current implementation does not support paging and generates out of memory errors when we don't artificially limit counts
  test.skip('Test document count', () => {
    return db.sequelize.query('select solicitation_number , count(*) as c from attachment join notice n on attachment.notice_id = n.id group by solicitation_number order by count(*) desc;')
      .then((rows) => {
        let solNum = rows[0][0].solicitation_number
        let count = rows[0][0].c
        return db.sequelize.query(`select id from notice where solicitation_number = '${solNum}' limit 1`)
          .then(rows => {
            let noticeId = rows[0][0].id
            return request(app)
              .get('/api/solicitation/' + noticeId)
              .set('Authorization', `Bearer ${token}`)
              .send({})
              .then((res) => {
                // noinspection JSUnresolvedVariable
                expect(res.statusCode).toBe(200)
                expect(res.body.solNum).toBe(solNum)
                expect(res.body.numDocs).toBe(parseInt(count))
                return expect(res.body.agency).toBeDefined()
              })
          })
      })
  })

  test('get solicitation feedback (using POST of all things because that is how the UI is coded', () => {
    let mockDB =
            { sequelize:
                    { query: (sql) => {
                      let set = [
                        { feedback: [{ question: 'q1', answer: 'a1' }, { question: 'q1', answer: 'a1' }] },
                        {},
                        { feedback: [{ question: 'q1', answer: 'a1' }, { question: 'q1', answer: 'a1' }] },
                        { solicitation_number: 'sprra1-19-r-0069', feedback: [{ question: 'q1', answer: 'a1' }, { question: 'q1', answer: 'a1' }] },
                        { feedback: [] },
                        { feedback: [{ question: 'q1', answer: 'a1' }, { question: 'q1', answer: 'a1' }] }
                      ]

                      if (sql.match(/select.*where.*jsonb_array_length\(feedback\).?>.?0/i)) {
                        set = set.filter(x => { return (x.feedback && x.feedback.length && x.feedback.length > 0) })
                      }

                      if (sql.match(/select.*where.*solicitation_number.?=.*sprra1-19-r-0069/i)) {
                        set = set.filter(x => { return (x.solicitation_number && x.solicitation_number === 'sprra1-19-r-0069') })
                      }
                      return new Promise(function (resolve) {
                        resolve(set)
                      })
                    },
                    QueryTypes: { SELECT: 7 }
                    }

            }

    let app = require('../app')(mockDB)

    return request(app)
      .post('/api/feedback')
      .set('Authorization', `Bearer ${token}`)
      .send({ $where: '{this.feedback.length > 0}'
      })
      .then((res) => {
        // noinspection JSUnresolvedVariable
        expect(res.statusCode).toBe(200)

        expect(res.body.length).toBeGreaterThan(1)
        for (let i = 0; i < res.body.length; i++) {
          expect(res.body[i].feedback.length).toBeGreaterThan(0)
          expect(res.body[i].feedback[0].question).toBeDefined()
        }
      })
      .then(() => {
        return request(app)
          .post('/api/feedback')
          .set('Authorization', `Bearer ${token}`)
          .send({ solNum: 'sprra1-19-r-0069' })
      })
      .then((res) => {
        // noinspection JSUnresolvedVariable
        expect(res.statusCode).toBe(200)

        expect(res.body.length).toBe(1)
        expect(res.body[0].solNum).toBe('sprra1-19-r-0069')
      })
  })

  test('Test attachment filenames', () => {

    let limit = configuration.getConfig('SolicitationCountLimit', '2000000000')
    let sql = `select  n.solicitation_number, count(*) as c                                                                        \n` +
      `from (select solicitation_number, attachment.* from attachment join notice on attachment.notice_id = notice.id) attachment  \n` +
      `join (select solicitation_number, min(date) as d from notice group by solicitation_number order by d desc limit ${limit}) n     \n` +
      `            on attachment.solicitation_number = n.solicitation_number                                                       \n` +
      `group by n.solicitation_number                                                                                              \n` +
      `having count(*) > 2`

    return db.sequelize.query(sql)
      .then((rows) => {
        let solNum = rows[0][0].solicitation_number
        return db.sequelize.query(`select filename from attachment join notice n on attachment.notice_id = n.id where solicitation_number = '${solNum}'`)
          .then(files => {
            return db.sequelize.query(`select id from notice where solicitation_number = '${solNum}' limit 1`)
              .then(rows => {
                let noticeId = rows[0][0].id
                return request(app)
                  .get('/api/solicitation/' + noticeId)
                  .set('Authorization', `Bearer ${token}`)
                  .send({})
                  .then((res) => {
                    // noinspection JSUnresolvedVariable
                    expect(res.statusCode).toBe(200)

                    let found = false
                    for (let fileRow of files[0]) {
                      if (res.body.parseStatus[0].name === fileRow.filename) {
                        found = true
                        break
                      }
                    }
                    return expect(found).toBeTruthy()
                  })
              })
          })
      })
  })

}) // end describe
