var express = require('express');
var router = express.Router();
var bcrypt = require('bcryptjs');
var jwt = require('jsonwebtoken');

var User = require('../models/user.js');

// This is the route set up for registering a new SRT user.
// All of the fields listed here are required to set up the account
router.post('/', (req, res, next) => {
  // User is a mongoose schema used to enforce data being entered into Mongo
  var srt_user = new User({
    firstName: req.body.firstName,
    lastName: req.body.lastName,
    email: req.body.email,
    password: bcrypt.hashSync(req.body.password, 10), // bcrypt is used to encrypt the password
    agency: req.body.agency
  });
  srt_user.save((err, result) => { // saves user to Mongo
    if (err) {
      return res.status(500).json({
        title: 'An error occurred',
        error: err
      });
    }
    res.status(201).json({
      message: 'User created',
      obj: result
    });
  });
  });

  router.post('/login', (req, res, next) => {
    User.findOne({email: req.body.email}, (err, user) => {      
      if (err) {
        return res.status(500).json({
          title: 'An error occurred',
          error: err
        });
      }
      if (!user) {
        return res.status(401).json()({
          title: 'Login failed',
          error: {message: 'Invalid login credentials'}
        });
      }
      if (!bcrypt.compareSync(req.body.password, user.password)) {
        return res.status(401).json()({
          title: 'Login failed',
          error: {message: 'Invalid login credentials'}
        });
      }

      var token = jwt.sign({user: user}, 'innovation', {expiresIn: 7200}); // token is good for 2 hours
      res.status(200).json({
        message: 'Successfully logged in',
        token: token,
        firstName: user.firstName, // save name and agency to local browser storage
        lastName: user.lastName,
        email: user.email,
        agency: user.agency,
        position: user.position
      });

    });
  });

  // GetUsers()
  router.get('/', function (req, res)  {

      var filterParams = {};
      User.find().then((users) => {
          res.send(users);
      }, (e) => {
          res.status(400).send(e);
      });
  });

module.exports = router;
