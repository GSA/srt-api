const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models').User;
const logger = require('../config/winston');




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
                logger.error(e);
                res.status(400).send(e);
            })
    },

    update: function(req,res) {
        var id = (req.params.userId) ? req.params.userId : req.body.id;
        return User.findByPk(id).then( (user) => {
            if (user == null) {
                logger.log("error", "Unable to find User " + id, {tag: "user update"});
                return res.status(404).send("Unable to find user " + id);
            }
            user.isAccepted = req.body.isAccepted;
            user.isRejected = req.body.isRejected;
            return user.save().then( () => {
                return res.status(200).send(user);
            })
        }).catch ( e => {
            logger.log("error", e, {tag: "user.routes.update", id: id});
            return res.status(500).send(e);
        })
    },

    updatePassword: function (req, res) {
        var newPassword = req.body.password;
        var oldPassword = req.body.oldpassword;
        var token = req.headers['authorization'].split(' ')[1];
        var me = jwt.decode(token).user;

        logger.log ("info", "Updating password for user " + me.email, {tag : "updatePassword"});

        return User.findByPk(me.id).then((user) => {
            if (oldPassword == user.tempPassword || bcrypt.compareSync(oldPassword, user.password)) {
                user.password = bcrypt.hashSync(newPassword, 10);
                user.tempPassword = "";
                return user.save().then(() => {
                    return res.status(200).send({message: "Password changed."})
                })
            } else {

                logger.log("info", "Failed attempt to change password by " + me.email);
                return res.status(401).send({message: 'current password is not correct!'});
            }
        }).catch(e => {
            logger.error(e);
            res.status(500).send({message: 'Update failed - ' + e.stack});
        })

    },

    getUserInfo: function(req, res) {
        return User.findByPk(req.body.UserId)
            .then( user => {
                return res.status(200).send(user);
            })
            .catch ( e => {
                return res.status(400).send(e);
            })
    },


     /**
     * Get the create Date.   (this was the orig. comment. No idea what is going on here!)
     */
     getCurrentUser: function (req, res) {
         if ( ! req.headers['authorization']) {
             return res.status(404).send("No authorization token provided");
         }

         var token = req.headers['authorization'].split(' ')[1];
         var current = jwt.decode(token).user;
         return User.findByPk(current.id)
             .then(user => {
                 return res.status(200).send({ creationDate : user.creationDate});
             })
             .catch(e => {
                 logger.error(e);
                 return res.status(500).send(e);
             });
     }






};


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