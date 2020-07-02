module.exports = {
  config_keys: {
    VISIBLE_NOTICE_TYPES: "VisibleNoticeTypes"
  },
  common: {
    "jwtSecret" : process.env.JWT_SECRET,
    "sessionLength" : "12h",  // 12 hours
    "tokenLife" : "30m",  // 30 minutes
    "renewTokenLife" : "30m", // 30 minutes
    "casDevModeData" :     {
      "last-name": "Test User",
      "agency-code": "023",
      "org-agency-code": "023",
      "maxsecuritylevel": "standard",
      "finalizedinterrupt": "true",
      "eauthloa": "http://idmanagement.gov/icam/2009/12/saml_2.0_profile/assurancelevel2",
      "agency-name": "General Services Administration",
      "grouplist": "AGY-GSA,EXECUTIVE_BRANCH,AGY-GSA-SRT-ADMINISTRATORS.ROLEMANAGEMENT,MAX-AUTHENTICATION-CUSTOMERS-CAS,MAX-AUTHENTICATION-CUSTOMERS-CAS-GSA-SRT,MAXINFO",
      "phone": "(609) 231-7251",
      "longtermauthenticationrequesttokenused": "false",
      "user-classification": "CONTRACTOR",
      "first-name": "MAX CAS",
      "isfromnewlogin": "true",
      "org-tag": "(GSA,Ctr)",
      "authenticationdate": "2019-05-02T15:17:53.418-04:00[America/New_York]",
      "max-id": "A1234567",
      "org-agency-name": "General Services Administration",
      "itweb-role": "no_itweb_role",
      "bureau-name": "General Services Administration",
      "successfulauthenticationhandlers": "UsernamePassword",
      "org-bureau-code": "00",
      "user-status": "A",
      "maxauthenticationgroups": "",
      "usercerts": "Piv-Client-Cert",
      "middle-name": "T",
      "credentialtype": "UsernamePasswordCredential",
      "samlauthenticationstatementauthmethod": "urn:max:fips-201-pivcard",
      "org-bureau-name": "General Services Administration",
      "bureau-code": "00",
      "authenticationmethod": "urn:max:fips-201-pivcard",
      "email-address": "albert.crowley@gsa.gov"
    },
    "casDevModeData-Navy" :     {
      "last-name": "Test User",
      "agency-code": "023",
      "org-agency-code": "023",
      "maxsecuritylevel": "standard",
      "finalizedinterrupt": "true",
      "eauthloa": "http://idmanagement.gov/icam/2009/12/saml_2.0_profile/assurancelevel2",
      "agency-name": "Department of the Navy",
      "grouplist": "AGY-GSA-SRT-508-COORDINATOR",
      "phone": "(609) 231-7251",
      "longtermauthenticationrequesttokenused": "false",
      "user-classification": "CONTRACTOR",
      "first-name": "MAX CAS",
      "isfromnewlogin": "true",
      "org-tag": "(GSA,Ctr)",
      "authenticationdate": "2019-05-02T15:17:53.418-04:00[America/New_York]",
      "max-id": "A1234567",
      "org-agency-name": "General Services Administration",
      "itweb-role": "no_itweb_role",
      "bureau-name": "General Services Administration",
      "successfulauthenticationhandlers": "UsernamePassword",
      "org-bureau-code": "00",
      "user-status": "A",
      "maxauthenticationgroups": "",
      "usercerts": "Piv-Client-Cert",
      "middle-name": "T",
      "credentialtype": "UsernamePasswordCredential",
      "samlauthenticationstatementauthmethod": "urn:max:fips-201-pivcard",
      "org-bureau-name": "Department of the Navy",
      "bureau-code": "00",
      "authenticationmethod": "urn:max:fips-201-pivcard",
      "email-address": "albert.crowley@gsa.gov"
    },

    "PIVLoginCheckRegex": "pivcard",
    "CORSWhitelist": [
      "http://localhost:4200",
      "https://srt.app.cloud.gov",
      "https://srt-client.app.cloud.gov",
      "https://srt-client-dev.app.cloud.gov",
      "https://srt-client-staging.app.cloud.gov",
      "https://srt-client-prod.app.cloud.gov",
    ],
    "constants": {
      "EMAIL_ACTION": "Sent email to POC",
      "FEEDBACK_ACTION": "Prediction feedback provided",
      "CREATED_ACTION": "Solicitation Posted",
      "NA_ACTION": "Solicitation marked not applicable",
      "UNDO_NA_ACTION": "Not applicable status removed"
    },
    // keys for agency look should be all lower case
    AGENCY_LOOKUP: {
      "department of test": "TEST, DEPARTMENT OF",
      "department of agriculture":"Department of Agriculture",
      "department of commerce":"Department of Commerce",
      "department of defense":"Department of Defense",
      "department of education":"Department of Education",
      "department of health and human services":"Department of Health and Human Services",
      "department of homeland security":"Department of Homeland Security",
      "department of housing and urban development":"Department of Housing and Urban Development",
      "department of justice":"Department of Justice",
      "department of labor":"Department of Labor",
      "department of state":"Department of State",
      "department of the interior":"Department of the Interior",
      "department of the treasury":"Department of the Treasury",
      "department of transportation":"Department of Transportation",
      "environmental protection agency":"Environmental Protection Agency",
      "executive office of the president":"Executive Office of the President",
      "general services administration":"General Services Administration",
      "agency for international development":"Agency for International Development",
      "national aeronautics and space administration":"National Aeronautics and Space Administration",
      "national science foundation":"National Science Foundation",
      "nuclear regulatory commission":"Nuclear Regulatory Commission",
      "office of personnel management":"Office of Personnel Management",
      "small business administration":"Small Business Administration",
      "social security administration":"Social Security Administration",
      "library of congress": "Library of Congress",
      "department of veterans affairs": "Department of Veterans Affairs",
      "national archives and records administration": "National Archives and Records Administration",
      "department of energy":"Department of Energy",
      "millennium challenge corporation":"Millennium Challenge Corporation"

    },
    AGENCY_MAP: {
      "AGRICULTURE, DEPARTMENT OF":"Department of Agriculture",
      "COMMERCE, DEPARTMENT OF":"Department of Commerce",
      "DEPT OF DEFENSE":"Department of Defense",
      "DEPARTMENT OF DEFENSE":"Department of Defense",
      "Defense Logistics Agency":"Department of Defense",
      "Other Defense Agencies":"Department of Defense",
      "Defense Information Systems Agency":"Department of Defense",
      "EDUCATION, DEPARTMENT OF":"Department of Education",
      "HEALTH AND HUMAN SERVICES, DEPARTMENT OF":"Department of Health and Human Services",
      "HOMELAND SECURITY, DEPARTMENT OF":"Department of Homeland Security",
      "HOUSING AND URBAN DEVELOPMENT, DEPARTMENT OF":"Department of Housing and Urban Development",
      "JUSTICE, DEPARTMENT OF":"Department of Justice",
      "LABOR, DEPARTMENT OF":"Department of Labor",
      "STATE, DEPARTMENT OF":"Department of State",
      "INTERIOR, DEPARTMENT OF THE":"Department of the Interior",
      "TREASURY, DEPARTMENT OF THE":"Department of the Treasury",
      "TRANSPORTATION, DEPARTMENT OF":"Department of Transportation",
      "ENVIRONMENTAL PROTECTION AGENCY":"Environmental Protection Agency",
      "EXECUTIVE OFFICE OF THE PRESIDENT":"Executive Office of the President",
      "GENERAL SERVICES ADMINISTRATION":"General Services Administration",
      "AGENCY FOR INTERNATIONAL DEVELOPMENT":"Agency for International Development",
      "NATIONAL AERONAUTICS AND SPACE ADMINISTRATION":"National Aeronautics and Space Administration",
      "NATIONAL SCIENCE FOUNDATION":"National Science Foundation",
      "NUCLEAR REGULATORY COMMISSION":"Nuclear Regulatory Commission",
      "OFFICE OF PERSONNEL MANAGEMENT":"Office of Personnel Management",
      "SMALL BUSINESS ADMINISTRATION":"Small Business Administration",
      "SOCIAL SECURITY ADMINISTRATION":"Social Security Administration",
      "LIBRARY OF CONGRESS": "Library of Congress",
      "VETERANS AFFAIRS, DEPARTMENT OF": "Department of Veterans Affairs",
      "NATIONAL ARCHIVES AND RECORDS ADMINISTRATION": "National Archives and Records Administration",
      "ENERGY, DEPARTMENT OF":"Department of Energy",
      "MILLENNIUM CHALLENGE CORPORATION":"Millennium Challenge Corporation"
    },
    VisibleNoticeTypes : ['Solicitation', 'Combined Synopsis/Solicitation'],
    "minPredictionCutoffDate" : "2020-02-01T00:00:00.000Z"
  },
  development: {
    "emailFrom": "crowley+srt@tcg.com",
    "emailServer" : {
      "host": "smtp.sendgrid.net",
      "port": 465,
      "secure": true,
      "auth": {
        "user": "apikey",
        "pass": "ENV variable SENDGRID_API_KEY"
      }
    },
    "emailLogOnly": false,
    "spamProtect" : true,
    "srt_server": {
      "port": 3000
    },
    "srtClientUrl": "http://localhost:4200",
    "logStdOut" : false,
    "maxCas" : {
      "cas_url" : "https://login.test.max.gov/cas/",
      "service_url" : "http://localhost:3000",
      "session_name" : "cas_user",
      "session_info" : "cas_userinfo",
      "is_dev_mode" : true,
      "dev_mode_user" : "dev_user",
      "renew" : true,
      "renew_query_parameter_name" : "bypassMaxsso",
      "password-whitelist": [ "samira.isber@gsa.gov", "albert.crowley@gsa.gov" ]
    },
    "sessionCookieSecure" : false,
    "SolicitationCountLimit" : 1000
  },
  "circle": {
    "emailFrom": "crowley+srt@tcg.com",
    "emailServer" : {
      "host": "smtp.sendgrid.net",
      "port": 465,
      "secure": true,
      "auth": {
        "user": "crowley",
        "pass": "ENV variable SENDGRID_API_KEY"
      }
    },
    "emailLogOnly": false,
    "spamProtect" : true,
    "srt_server": {
      "port": 3000
    },
    "srtClientUrl": "https://srt-client-dev.app.cloud.gov",
    "logStdOut" : true,
    "maxCas" : {
      "cas_url" : "https://login.test.max.gov/cas/",
      "service_url" : "http://localhost:3000",
      "session_name" : "cas_user",
      "session_info" : "cas_userinfo",
      "is_dev_mode" : true,
      "dev_mode_user" : "dev_user",
      "renew" : true,
      "renew_query_parameter_name" : "bypassMaxsso"
    }
  },
  "clouddev": {
    "emailFrom": "crowley+srt@tcg.com",
    "emailServer" : {
      "host": "smtp.sendgrid.net",
      "port": 465,
      "secure": true,
      "auth": {
        "user": "apikey",
        "pass": "ENV variable SENDGRID_API_KEY"
      }
    },
    "emailLogOnly": false,
    "spamProtect" : true,
    "srt_server": {
      "port": 8080
    },
    "srtClientUrl": "https://srt-client-dev.app.cloud.gov",
    "logStdOut" : true,
    "maxCas" : {
      "cas_url" : "https://login.test.max.gov/cas/",
      "service_url" : "https://srt-server-dev.app.cloud.gov",
      "session_name" : "cas_user",
      "session_info" : "cas_userinfo",
      "is_dev_mode" : false,
      "dev_mode_user" : "",
      "renew" : true,
      "renew_query_parameter_name" : "bypassMaxsso",
      "password-whitelist": [ "samira.isber@gsa.gov", "albert.crowley@gsa.gov" ]
    }
  },
  "cloudstaging": {
    "emailFrom": "crowley+srtstage@tcg.com",
    "emailServer" : {
      "host": "smtp.sendgrid.net",
      "port": 465,
      "secure": true,
      "auth": {
        "user": "apikey",
        "pass": "ENV variable SENDGRID_API_KEY"
      }
    },
    "emailLogOnly": false,
    "spamProtect" : true,
    "srt_server": {
      "port": 8080
    },
    "srtClientUrl": "https://srt-client-staging.app.cloud.gov",
    "logStdOut" : true,
    "maxCas" : {
      "cas_url" : "https://login.test.max.gov/cas/",
      "service_url" : "https://srt-server-staging.app.cloud.gov",
      "session_name" : "cas_user",
      "session_info" : "cas_userinfo",
      "is_dev_mode" : false,
      "dev_mode_user" : "dev_user",
      "renew" : true,
      "renew_query_parameter_name" : "bypassMaxsso",
      "password-whitelist": [ "samira.isber@gsa.gov", "albert.crowley@gsa.gov" ]
    }
    // "SolicitationCountLimit" : 10000
  },
  "test": {
    "emailFrom": "crowley+srt@tcg.com",
    "emailServer" : {
      "host": "smtp.sendgrid.net",
      "port": 465,
      "secure": true,
      "auth": {
        "user": "crowley",
        "pass": "ENV variable SENDGRID_API_KEY"
      }
    },
    "spamProtect" : true,
    "srt_server": {
      "port": 8080
    },
    "srtClientUrl": "https://srt-client-dev.app.cloud.gov",
    "logStdOut" : true,
    "maxCas" : {
      "cas_url" : "https://login.test.max.gov/cas/",
      "service_url" : "https://srt-server-test.app.cloud.gov",
      "session_name" : "cas_user",
      "session_info" : "cas_userinfo",
      "is_dev_mode" : false,
      "dev_mode_user" : "",
      "renew" : true,
      "renew_query_parameter_name" : "bypassMaxsso"
    }
  },
  "production": {
    "emailFrom": "crowley+srt@tcg.com",
    "emailServer" : {
      "host": "smtp.sendgrid.net",
      "port": 465,
      "secure": true,
      "auth": {
        "user": "crowley",
        "pass": "ENV variable SENDGRID_API_KEY"
      }
    },
    "emailLogOnly": false,
    "spamProtect" : true,
    "srt_server": {
      "port": 8080
    },
    "srtClientUrl": "https://srt.app.cloud.gov",
    "logStdOut" : true,
    "maxCas" : {
      "cas_url" : "https://login.max.gov/cas/",
      "service_url" : "https://srt-server.app.cloud.gov",
      "cas_version" : "2.0",
      "session_name" : "cas_user",
      "session_info" : "cas_userinfo",
      "is_dev_mode" : false,
      "dev_mode_user" : "",
      "renew" : true,
      "renew_query_parameter_name" : "bypassMaxsso"
    }
  }
}
