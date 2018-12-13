var bcrypt = require('bcryptjs');
var jwt = require('jsonwebtoken');

var User = require('../schemas/user.js');
var Role = require('../schemas/role.js')
var app = require('../app');


async function authRegister (req, res, next) {
    var now = new Date().toLocaleDateString();
    var srt_user = {
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
    };


    console.log ("user save");

    await (app);
    await (app.connection);
    console.log (app.connection);
    console.log (app.isConnected);
    await (app.isConnected);

    console.log(app.connection);

    var userRepository = app.connection.getRepository("User")

    console.log("now have repo");

    try {
        userRepository.save(srt_user);
    } catch (error) {
        console.log ("got an error saving!")
    }
    console.log("done save");


    //
    // srt_user.save((err, result) => { // saves user to Mongo
    //     console.log ("done the save");
    //     if (err) {
    //         return res.status(500).json({
    //             title: 'An error occurred',
    //             error: err
    //         });
    //     }
    //     res.status(201).json({
    //         message: 'User created',
    //         obj: result
    //     });
    // });
}

module.exports = {authRegister};
