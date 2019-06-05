let user1 = {
  'first-name': 'Phineas',
  'last-name': 'Crowley',
  'email-address': 'crowley+Phineas@tcg.com',
  'password': 'pass',
  'org-agency-name': 'General Services Administration',
  'position': 'director',
  'userRole': 'superuser',
  'isAccepted': true,
  'tempPassword': 'tpass',
  'creationDate': '01/01/2019',
  'max-id': 'A0001'
}

let userAcceptedCASData = {
  'first-name': 'Accepted',
  'last-name': 'User',
  'email-address': 'crowley+accepted@tcg.com',
  'password': 'pass',
  'org-agency-name': 'General Services Administration',
  'position': 'director',
  'userRole': 'superuser',
  'isAccepted': true,
  'tempPassword': 'tpass',
  'creationDate': '01/02/2019',
  'max-id' : 'A0002',
  'grouplist' : "AGY-GSA,EXECUTIVE_BRANCH,AGY-GSA-SRT-ADMINISTRATORS.ROLEMANAGEMENT,MAX-AUTHENTICATION-CUSTOMERS-CAS,MAX-AUTHENTICATION-CUSTOMERS-CAS-GSA-SRT,MAXINFO"
}

let userRejected = {
  'first-name': 'Rejected',
  'last-name': 'User',
  'email-address': 'crowley+rejected@tcg.com',
  'password': 'pass',
  'org-agency-name': 'General Services Administration',
  'position': 'director',
  'userRole': 'superuser',
  'isRejected': true,
  'tempPassword': 'tpass',
  'creationDate': '01/03/2019',
  'max-id' : 'A0003'
}

module.exports = { user1, userAcceptedCASData: userAcceptedCASData, userRejected: userRejected }
