const expect = require('expect');
const request = require('supertest');
const {ObjectID} = require('mongodb');

const {app} = require('./../server');
const {Prediction} = require('./../models/prediction');

const predictions = [{
  _id: new ObjectID(),
  title: 'Solicitation 1',
  url: 'https://www.fbo.gov/spg',
  predictions: {
    Red: 0.93,
    Green: 0
  },
  agency: 'Defense Logistics Agency',
  date: new Date(),
  office: 'OGP',
  eitLikelihood: true,
  contact: 'Some guy',
  isReadable: true
}, {
  _id: new ObjectID(),
  title: 'Soliciation 2',
  url: 'https://www.fbo.gov/spg',
  predictions: {
    Red: 0.3,
    Yellow: 0.1,
    Green: 0.6
  },
  agency: 'Department of the Navy',
  date: new Date(),
  office: 'NAVAIR',
  eitLikelihood: true,
  contact: 'Lt guy',
  isReadable: true
}];

beforeEach((done) => {
  Prediction.remove({}).then(() => {
    return Prediction.insertMany(predictions);
  }).then(() => done());
});

describe('POST /predictions', () => {
  it('should create a new prediction', (done) => {
    var agency = 'Test Agency';
    var pred = {
        "url": "https://www.fbo.gov/spg/DLA/J3/DSCR-BSM/SPE4A517R0245/listing.html",
        "predictions": {
            "RED": 0.0,
            "YELLOW": 0.0,
            "GREEN": 1.0
        },
        "agency": agency
    };

    request(app)
      .post('/predictions')
      .send(pred)
      .expect(200)
      .expect((res) => {
        expect(res.body.agency).toBe('Test Agency');
      })
      .end((err, res) => {
        if (err) {
          return done(err);
        }

        Prediction.find({agency}).then((preds) => {
          expect(preds.length).toBe(1);
          expect(preds[0].agency).toBe(agency);
          done();
        }).catch((e) => done(e));
      });
  });

  it('should not create prediction with invalid body data', (done) => {
    request(app)
      .post('/predictions')
      .send({})
      .expect(400)
      .end((err, res) => {
        if (err) {
          return done(err);
        }

        Prediction.find().then((preds) => {
          expect(preds.length).toBe(2);
          done();
        }).catch((e) => done(e));
      });
  });
});

describe('GET /predictions', () => {
  it('should get all predictions', (done) => {
    request(app)
      .get('/predictions')
      .expect(200)
      .expect((res) => {
        expect(res.body.preds.length).toBe(2);
      })
      .end(done);
  });
});
