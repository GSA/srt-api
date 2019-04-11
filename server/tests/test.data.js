let user1 = {
  'firstName': 'Phineas',
  'lastName': 'Crowley',
  'email': 'crowley+Phineas@tcg.com',
  'password': 'pass',
  'agency': 'General Services Administration',
  'position': 'director',
  'userRole': 'superuser',
  'isAccepted': true,
  'tempPassword': 'tpass',
  'creationDate': '01/01/2019'
}

let userAccepted = {
  'firstName': 'Accepted',
  'lastName': 'User',
  'email': 'crowley+accepted@tcg.com',
  'password': 'pass',
  'agency': 'General Services Administration',
  'position': 'director',
  'userRole': 'superuser',
  'isAccepted': true,
  'tempPassword': 'tpass',
  'creationDate': '01/02/2019'
}

let userRejected = {
  'firstName': 'Rejected',
  'lastName': 'User',
  'email': 'crowley+rejected@tcg.com',
  'password': 'pass',
  'agency': 'General Services Administration',
  'position': 'director',
  'userRole': 'superuser',
  'isRejected': true,
  'tempPassword': 'tpass',
  'creationDate': '01/03/2019'
}

module.exports = { user1, userAccepted: userAccepted, userRejected: userRejected }
