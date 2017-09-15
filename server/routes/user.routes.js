
const _ = require('lodash');

var express = require('express');
var router = express.Router();
var bcrypt = require('bcryptjs');
var jwt = require('jsonwebtoken');

var User = require('../models/user.js');

// This is the route set up for registering a new SRT user.
// All of the fields listed here are required to set up the account
router.post('/', (req, res, next) => {
  var now = new Date().toLocaleDateString();
  // User is a mongoose schema used to enforce data being entered into Mongo

  var srt_user = new User({
    firstName: req.body.firstName,
    lastName: req.body.lastName,
    email: req.body.email,
    password: bcrypt.hashSync(req.body.password, 10), // bcrypt is used to encrypt the password
    agency: req.body.agency,
    position: req.body.position,
    isAccepted: false,
    isRejected: false,
    userRole: req.body.userRole, 
    rejectionNote: "",    
    creationDate: now
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
        return res.status(401).json({
          title: 'Login failed',
          error: {message: 'Invalid user Email Address or Password.'}
        });
      }
      if (!bcrypt.compareSync(req.body.password, user.password)) {
        return res.status(401).json({
          title: 'Login failed',
          error: {message: 'Invalid user Email Address or Password.'}
        });
      }

      if (!user.isAccepted) {
        return res.status(401).json({
          title: 'Login failed',
          error: {message: 'Your account has not been approved, please wait for Administrator Approval.'}
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
          position: user.position,
          userRole: user.userRole,
          id: user._id,
      });

    });
  });

  router.post('/tokenCheck', function(req, res) {    
    var token = req.body.token;    
    var isLogin = false;
    var isGSAAdmin = false;
    jwt.verify(token, 'innovation', function(err, decoded) {
      if (err) {
          isLogin = false;          
      }
      else 
      {
        var tokenInfo = jwt.decode(token);
        isLogin = true;
        if (tokenInfo.user)
        {          
          isGSAAdmin = (tokenInfo.user.userRole == "Administrator" || tokenInfo.user.userRole == "SRT Program Manager ") && tokenInfo.user.agency.indexOf("General Services Administration") > -1;         
        }       
      }
      res.status(200).json({
          isLogin: isLogin,
          isGSAAdmin: isGSAAdmin
      });
    });
  })
    

  // GetUsers()
  router.post('/filter', function (req, res)  {

      var filterParams = {};
      var isAccepted = req.body.isAccepted;
      var isRejected = req.body.isRejected;

      if (isAccepted != null) {
          _.merge(filterParams, {isAccepted: isAccepted});
      }
      if (isRejected != null) {
          _.merge(filterParams, {isRejected: isRejected});
      }
      
      User.find(filterParams).then((users) => {
          res.send(users);
      }, (e) => {
          res.status(400).send(e);
      });
  });

  // Update User
  router.post('/update', function (req, res)  {
      User.findById(req.body._id, function(err, user) {
            if (err)
                res.send(err);
                
            //user.firstName = req.body.firstName,
            //user.lastName = req.body.lastName,
            //user.email = req.body.email,
            //user.password = req.body.password, // bcrypt is used to encrypt the password
            //user.agency = req.body.agency,
            //user.position = req.body.position,
            user.isAccepted = req.body.isAccepted,
            user.isRejected = req.body.isRejected,
            //user.userRole = req.body.userRole,
            //user.rejectionNote = req.body.rejectionNote,
            //user.creationDate = req.body.creationDate,            

            // save the bear
            user.save(function(err) {
                if (err)
                    res.send(err);

                res.json({ message: 'user updated!' });
            });

        });
  });
  

module.exports = router;
