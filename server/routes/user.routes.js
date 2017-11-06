const _ = require('lodash');
var express = require('express');
var router = express.Router();
var bcrypt = require('bcryptjs');
var jwt = require('jsonwebtoken');
var token = require('../security/token');

var UserSchemas = require('../schemas/user.js');

/**
 * Check token, if token is not pass, system will stop here.
 */
router.use(token());

/**
 * Get users based on filter
 */
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
      
      UserSchemas.find(filterParams).then((users) => {
          res.send(users);
      }, (e) => {
          res.status(400).send(e);
      });
  });
  
/**
 * update user
 */
router.post('/update', function (req, res) {
    UserSchemas.findById(req.body._id, function (err, user) {
        if (err)
            res.send(err);
        user.isAccepted = req.body.isAccepted,
            user.isRejected = req.body.isRejected,
            // save the bear
            user.save(function (err) {
                if (err)
                    res.send(err);
                res.json({ message: 'user updated!' });
            });

    });
});

    
/**
 * Update password.
 */
router.post('/updatePassword', function (req, res) {
  var password = req.body.password;
  console.log(req.body);
  var token = req.headers['authorization'].split(' ')[1];
  if(token != 'null' && password != ''){
    var current = jwt.decode(token).user;;
    
    UserSchemas.findOne({_id : current._id}, function (err, user){
     
        
        console.log(user.password)
        if(!bcrypt.compareSync(req.body.oldpassword, user.password)){
            res.json({message: 'current password is not correct!'})
        }else{


        user.password =  bcrypt.hashSync(req.body.password, 10);

        if(err){
           res.send(err);
        }

        user.save(function(err){
            if(err)
            res.send(err);
        
            res.json({message: ' password updated!'})
        })
    }

    })
    
  }

})

/**
 * Check password.
 */
router.post('/checkPassword', function(req, res){    
    var password = req.body.password;
    console.log(password);
})


module.exports = router;
    