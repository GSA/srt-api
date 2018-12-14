var user1 = {
    "firstName": "Phineas",
    "lastName": "Crowley",
    "email": "crowley+Phineas@tcg.com",
    "password": "pass",
    "agency": "GSA",
    "position": "director",
    "userRole": "superuser"
};

var user_accepted = {
    "firstName": "Accepted",
    "lastName": "User",
    "email": "crowley+accepted@tcg.com",
    "password": "pass",
    "agency": "GSA",
    "position": "director",
    "userRole": "superuser",
    "isAccepted": true
};

var user_rejected = {
    "firstName": "Rejected",
    "lastName": "User",
    "email": "crowley+rejected@tcg.com",
    "password": "pass",
    "agency": "GSA",
    "position": "director",
    "userRole": "superuser",
    "isRejected": true
};


module.exports = {user1, user_accepted, user_rejected};