const request = require('supertest')
let app = null // require('../app')();;
const mockToken = require('./mocktoken')
// noinspection JSUnresolvedVariable
const User = require('../models').User
const db = require('../models/index')
const {common, config_keys} = require('../config/config.js')
const configuration = require('../config/configuration')
const {getConfig} = require('../config/configuration')
let solicitationRoutes = null
const predictionRoutes = require('../routes/prediction.routes')

const cloneDeep = require('clone-deep')

const randomWords = require('random-words')

const { formatDateAsString } = require('../shared/time')
const { userAcceptedCASData } = require('./test.data')

let myUser = {}
myUser.firstName = 'sol-beforeAllUser'
myUser.email = 'crowley+sol@tcg.com'
delete myUser.id
let token = {}
let sample_sol_num = ''

describe('solicitation tests', () => {
  beforeAll( async () => {
    process.env.MAIL_ENGINE = 'nodemailer-mock'
    app = require('../app')() // don't load the app till the mock is configured

    solicitationRoutes = require('../routes/solicitation.routes')( db, { whoAmI: () => myUser.email })

    myUser = Object.assign({}, userAcceptedCASData)
    delete myUser.id
    let user = await User.create({ myUser: myUser })
    myUser.id = user.id
    token = await mockToken(myUser, common['jwtSecret'])

    let allowed_types = configuration.getConfig(config_keys.VISIBLE_NOTICE_TYPES).map( (x) => `'${x}'`).join(",")

    let sql = `select solicitation_number 
                from notice
                join notice_type on notice.notice_type_id = notice_type.id
                where notice_type.notice_type in (${allowed_types})
                order by notice.id desc
                limit 1`
    let rows = await db.sequelize.query(sql)
    sample_sol_num = rows[0][0].solicitation_number
  })

  afterAll(() => {
    return User.destroy({ where: { firstName: 'sol-beforeAllUser' } })
      .then( () => { app.db.close(); })
  })

  test('solicitation post', async () => {

    await predictionRoutes.updatePredictionTable()

    return db.sequelize.query('select count(*), solicitation_number from (select * from notice where history is not null) notice where history is not null group by solicitation_number having count(*) > 5 limit 1')
      .then( async (result) => {

        let rows = await db.sequelize.query(`select * from notice where history is not null and  solicitation_number = '${result[0][0].solicitation_number}' order by feedback `)
        let noticeNum = rows[0][0].solicitation_number
        expect(noticeNum).toBeDefined()

        let word2 = randomWords.wordList[Math.floor(Math.random() * randomWords.wordList.length)]
        let actionDate = new Date().toLocaleString()

        let history = cloneDeep(rows[0][0].history)
        while (history.length < 2) {
          history.push({ action: 'fake history' })
        }
        history.push ({
          'date': actionDate,
          'action': 'again reviewed solicitation action requested summary',
          'user': word2,
          'status': 'submitted'
        })
        let feedback = cloneDeep(rows[0][0].feedback)
        if ( (! Array.isArray(feedback)) ){
          feedback = []
        }
        feedback.push(    {
            'questionID': feedback.length + 1,
            'question': 'Is this an acceptable solicitation?',
            'answer': 'Yes'
          }
        )

        return request(app)
          .post('/api/solicitation')
          .set('Authorization', `Bearer ${token}`)
          .send(
            {
              'solNum': noticeNum,
              'actionStatus': 'reviewed solicitation action requested summary',
              'actionDate': actionDate,
              'history': history,
              'feedback': feedback
            }
          )
          .then((res) => {
            // noinspection JSUnresolvedVariable
            expect(res.statusCode).toBe(200)

            expect(res.body.feedback[ res.body.feedback.length - 1].questionID).toBe(res.body.feedback.length)
            expect (res.body.actionStatus).toBe(getConfig("constants:FEEDBACK_ACTION"))

            return expect(res.body.history[ res.body.history.length-1 ].user).toBe(word2)
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
                return expect(hist[ hist.length-1 ].action).toMatch(/again reviewed solicitation/)
              })
          })
      })
  })

  test('solicitation get', () => {

    return db.sequelize.query(`select id, solicitation_number from notice where  notice.solicitation_number = '${sample_sol_num}'`)
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

                      if (sql.match(/select.*where.*jsonb_array_length/i)) {
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

    let limit = configuration.getConfig('SolicitationCountLimit', '2000')
    let allowed_types = configuration.getConfig(config_keys.VISIBLE_NOTICE_TYPES).map( (x) => `'${x}'`).join(",") //?
    let sql = `select  n.solicitation_number, count(*) as c
               from ( 
                     select solicitation_number, attachment.* 
                     from attachment 
                     join notice on attachment.notice_id = notice.id 
                     join notice_type nt on notice.notice_type_id = nt.id 
                     where nt.notice_type in (${allowed_types})
                    ) attachment  
               join (select solicitation_number, min(date) as d from notice group by solicitation_number order by d desc limit ${limit}) n 
                     on attachment.solicitation_number = n.solicitation_number
               group by n.solicitation_number
               having count(*) > 2`


    return db.sequelize.query(sql)
      .then((rows) => {
        let solNum = rows[0][0].solicitation_number
        return db.sequelize.query(`select filename from attachment join notice n on attachment.notice_id = n.id where solicitation_number = '${solNum}'`)
          .then(files => {
            return db.sequelize.query(`select id from notice where solicitation_number = '${solNum}' limit 1`)
              .then(rows => {
                let noticeId = rows[0][0].id //?
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

  test('Solicitation audit', () => {
    let mock_notice = {
        "action": [{ "action": "fake action", "date": "2019-03-29T08:05:31.307Z", "status": "complete", "user": "" },
                   { "action": "fake action 2", "date": "2020-01-16T13:07:53.575Z", "status": "complete" },
                  ],
        "actionDate": "2020-01-16T18:12:34.000Z",
        "actionStatus": "Record updated",
        "agency": "Department of the Navy",
        "contactInfo": { "contact": "BERNIE CAGUIAT 8316566948", "email": "", "name": "Contact Name", "position": "Position" },
        "createdAt": "2020-01-16T18:13:41.875Z",
        "date": "2019-03-29T12:05:31.000Z",
        "eitLikelihood": { "value": "Yes" },
        "feedback": [],
        "history": [{
                      "action": "reviewed solicitation action requested summary",
                      "date": "1/14/2020",
                      "status": "",
                      "user": "MAX CAS Test User"
                    }, {
                      "action": "sent email to POC",
                      "date": "1/15/2020",
                      "status": "Email Sent to POC",
                       "user": "MAX CAS Test User"
                    }
         ],
        "id": 7057,
        "na_flag": true,
        "noticeType": "COMBINE",
        "numDocs": 0,
        "office": "Naval Education and Training Command",
        "parseStatus": [],
        "predictions": { "history": [{ "date": "2019-03-29T08:05:31.307Z", "value": "red" }], "value": "black" },
        "reviewRec": "Not Applicable",
        "searchText": "n6227119q1075 combine 70--ecp model 205 controls executive for windows 10 software license and maintenance fri mar 29 2019 04:05:31 gmt-0400 (edt) not applicable record updated 2020-01-16t13:12:34.360z department of the navy naval education and training command",
        "solNum": "N6227119Q1075",
        "title": "70--ECP Model 205 Controls Executive for Windows 10 Software License and Maintenance",
        "undetermined": false,
        "updatedAt": "2020-01-16T18:13:41.875Z",
        "url": "https://www.fbo.gov/notices/dc4237c5d3da6f60db3d5de14b8c14b8"
      }

    let updated_notice = cloneDeep(mock_notice, true)

    let actions = solicitationRoutes.auditSolicitationChange(mock_notice, updated_notice, null)
    expect(actions.length).toBe(2)

    updated_notice = cloneDeep(mock_notice, true)
    updated_notice.history.push(  {
      "action": getConfig('constants:EMAIL_ACTION'),
      "date": "1/16/2020",
      "status": "Email Sent to POC",
      "user": "MAX CAS Test User"
    })

    // test email
    actions = solicitationRoutes.auditSolicitationChange(mock_notice, updated_notice, null)
    let datestr = formatDateAsString(new Date())
    expect(actions.length).toBeGreaterThan(2)
    expect(actions[actions.length-1].action).toBe(getConfig("constants:EMAIL_ACTION"))
    expect(actions[actions.length-1].date).toBe(datestr)
    expect(actions[actions.length-1].user).toBe(myUser.email)


    // test feedback
    updated_notice = cloneDeep(mock_notice, true)
    updated_notice.feedback = [1,2,3]
    actions = solicitationRoutes.auditSolicitationChange(mock_notice, updated_notice, null)
    expect(actions.length).toBeGreaterThan(2)
    expect(actions[actions.length-1].action).toBe(getConfig("constants:FEEDBACK_ACTION"))
    expect(actions[actions.length-1].date).toBe(datestr)
    expect(actions[actions.length-1].user).toBe(myUser.email)

    // test NA
    let na_false = cloneDeep(mock_notice, true)
    na_false['na_flag'] = false
    let na_true = cloneDeep(mock_notice, true)
    na_true['na_flag'] = true
    actions = solicitationRoutes.auditSolicitationChange(na_false, na_true, null)
    expect(actions[actions.length-1].action).toBe(getConfig("constants:NA_ACTION"))
    expect(actions[actions.length-1].date).toBe(datestr)
    expect(actions[actions.length-1].user).toBe(myUser.email)

    // test undo NA
    actions = solicitationRoutes.auditSolicitationChange(na_true, na_false, null)
    expect(actions[actions.length-1].action).toBe(getConfig("constants:UNDO_NA_ACTION"))
    expect(actions[actions.length-1].date).toBe(datestr)
    expect(actions[actions.length-1].user).toBe(myUser.email)

  })

}) // end describe
