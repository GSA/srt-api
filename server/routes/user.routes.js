var express = require('express');
var router = express.Router();
var bcrypt = require('bcryptjs');
var jwt = require('jsonwebtoken');

var User = require('../models/user.js');

router.post('/', (req, res, next) => {
  var srt_user = new User({
    firstName: req.body.firstName,
    lastName: req.body.lastName,
    email: req.body.email,
    password: bcrypt.hashSync(req.body.password, 10),
    agency: req.body.agency
  });
  srt_user.save((err, result) => {
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

      var token = jwt.sign({user: user}, 'innovation', {expiresIn: 7200});
      res.status(200).json({
        message: 'Successfully logged in',
        token: token,
        firstName: user.firstName,
        agency: user.agency
      });

    });
  });

module.exports = router;
