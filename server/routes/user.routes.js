var express = require('express');

const User = require('../models').User;




module.exports = {
    filter: function(req, res) {
        var filterParams = {};
        var isAccepted = req.body.isAccepted;
        var isRejected = req.body.isRejected;
        var filter = {};

        if (isAccepted != null) {
            filter['isAccepted'] = isAccepted;
        }
        if (isRejected != null) {
            filter['isRejected'] = isRejected;
        }
        return User.findAll({where: filter})
            .then( users => {
                res.status(200).send(users);
            })
            .catch( e => {
                res.status(400).send(e);
            })
    },

    update: function(req,res) {

        return {};
    },

    getUserInfo: function(req, res) {
        return User.findByPk(req.body.UserId)
            .then( user => {
                return res.status(200).send(user);
            })
            .catch ( e => {
                return res.status(400).send(e);
            })
    }


};


// /**
//  * Find user info from database
//  */
// router.post('/getUserInfo', function(req, res){
//     var currentId = req.body.UserID;
//     UserSchemas.findOne({_id : currentId}, function(err, user){
//         if(err){
//             res.send(err);
//         }else{
//             res.json(user);
//         }
//     })
// })


//
//
// /**
//  * update user
//  */
// router.post('/update', function (req, res) {
//     User.findById(req.body._id, function (err, user) {
//         if (err)
//             res.send(err);
//         user.isAccepted = req.body.isAccepted,
//             user.isRejected = req.body.isRejected,
//             // save the bear
//             user.save(function (err) {
//                 if (err)
//                     res.send(err);
//                 res.json({ message: 'user updated!' });
//             });
//
//     });
// });
//
//
// /**
//  * Update password.
//  */
// router.post('/updatePassword', function (req, res) {
//   var password = req.body.password;
//   var token = req.headers['authorization'].split(' ')[1];
//   if(token != 'null' && password != ''){
//     var current = jwt.decode(token).user;;
//
//     UserSchemas.findOne({_id : current._id}, function (err, user){
//         console.log(req.body.oldpassword);
//         console.log(user)
//         if(!bcrypt.compareSync(req.body.oldpassword, user.password) && req.body.oldpassword != user.tempPassword ){
//
//             res.json({message: 'current password is not correct!'})
//         }else{
//
//         user.password =  bcrypt.hashSync(req.body.password, 10);
//
//         if(err){
//            res.send(err);
//         }
//
//         user.tempPassword = "";
//         user.save(function(err){
//             if(err)
//             res.send(err);
//
//             res.json({message: ' password updated!'})
//         })
//     }
//
//     })
//
//   }
//
// })
//
// /**
//  * Check password.
//  */
// router.post('/checkPassword', function(req, res){
//     var password = req.body.password;
//     console.log(password);
// })
//
// /**
//  * Get the create Date.
//  */
// router.post('/getCurrentUser', function(req, res){
//     var token = req.headers['authorization'].split(' ')[1];
//     var current = jwt.decode(token).user;;
//     UserSchemas.findOne({_id : current._id}, function (err, user){
//         if(err){
//             res.send(err);
//         }else{
//             console.log(user)
//             res.json(user.creationDate)
//         }
//     })
//
// })
//
// /**
//  * Find user info from database
//  */
// router.post('/getUserInfo', function(req, res){
//     var currentId = req.body.UserID;
//     UserSchemas.findOne({_id : currentId}, function(err, user){
//         if(err){
//             res.send(err);
//         }else{
//             res.json(user);
//         }
//     })
// })
//
// /**
//  * Update user info from database
//  */
// router.post('/updateUserInfo', function(req, res){
//     var userId =req.body.UserID;
//     var email = req.body.NewEmail;
//     UserSchemas.findOne({_id : userId}, function(err, user){
//         if(err){
//             res.send(err);
//
//         }else{
//             user.email = email;
//             user.save(function(err){
//                 if(err)
//                 res.send(err);
//
//                 res.json({message: ' email updated!',
//                          email: user.email })
//             })
//
//         }
//     })
// })
//
//
// module.exports = router;
//