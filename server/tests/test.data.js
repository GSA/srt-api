let user1 = {
  'first-name': 'Phineas',
  'last-name': 'Crowley',
  'email-address': 'crowley+Phineas@tcg.com',
  'password': 'pass',
  'org-agency-name': 'General Services Administration',
  'position': 'director',
  'userRole': 'Administrator',
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
  'userRole': 'Administrator',
  'isAccepted': true,
  'tempPassword': 'tpass',
  'creationDate': '01/02/2019',
  'max-id' : 'A0002',
  'grouplist' : "AGY-GSA,EXECUTIVE_BRANCH,AGY-GSA-SRT-ADMINISTRATORS.ROLEMANAGEMENT,MAX-AUTHENTICATION-CUSTOMERS-CAS,MAX-AUTHENTICATION-CUSTOMERS-CAS-GSA-SRT,MAXINFO"
}

let adminCASData = {
  'first-name': 'Accepted',
  'last-name': 'User',
  'email-address': 'crowley+casadmin@tcg.com',
  'password': 'pass',
  'org-agency-name': 'General Services Administration',
  'position': 'director',
  'userRole': 'Administrator',
  'isAccepted': true,
  'tempPassword': 'tpass',
  'creationDate': '01/02/2019',
  'max-id' : 'A0002',
  'grouplist' : "AGY-GSA,EXECUTIVE_BRANCH,AGY-GSA-SRT-ADMINISTRATORS.ROLEMANAGEMENT,MAX-AUTHENTICATION-CUSTOMERS-CAS,MAX-AUTHENTICATION-CUSTOMERS-CAS-GSA-SRT,MAXINFO"
}

let coordinatorCASData = {
  'first-name': 'Accepted',
  'last-name': 'User',
  'email-address': 'crowley+cascoordinator@tcg.com',
  'password': 'pass',
  'org-agency-name': 'Department of Health and Human Services',
  'position': 'director',
  'userRole': 'Section 508 Coordinator',
  'isAccepted': true,
  'tempPassword': 'tpass',
  'creationDate': '01/02/2019',
  'max-id' : 'A0002',
  'grouplist' : "AGY-GSA,EXECUTIVE_BRANCH,AGY-GSA-SRT-508-COORDINATOR,MAX-AUTHENTICATION-CUSTOMERS-CAS,MAX-AUTHENTICATION-CUSTOMERS-CAS-GSA-SRT,MAXINFO"
}

let userRejected = {
  'first-name': 'Rejected',
  'last-name': 'User',
  'email-address': 'crowley+rejected@tcg.com',
  'password': 'pass',
  'org-agency-name': 'General Services Administration',
  'position': 'director',
  'userRole': 'Administrator',
  'isRejected': true,
  'tempPassword': 'tpass',
  'creationDate': '01/03/2019',
  'max-id' : 'A0003'
}

let feedback = [
    {
      "questionID": 0,
      "question": "Did the tool correctly identify this solicitation as an Information and Communication Technology (ICT)?",
      "note": "",
      "answer": "Maybe"
    },
    {
      "questionID": 1,
      "question": "Did the tool correctly predict compliance with Section 508? ",
      "note": "",
      "answer": "No"
    },
    {
      "questionID": 2,
      "question": "Other comments such as recommendations to improve the tool or why the solicitation is NOT Section 508 compliant?",
      "note": "",
      "answer": "Yes"
    }
  ]


module.exports = {
  user1: user1,
  userAcceptedCASData: userAcceptedCASData,
  userRejected: userRejected,
  adminCASData: adminCASData,
  coordinatorCASData: coordinatorCASData,
  feedback: feedback
}
