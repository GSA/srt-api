

module.exports = {
  common: {
    "jwtSecret" : process.env.JWT_SECRET,
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
    "PIVLoginCheckRegex": "p"
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
    "logStdOut" : true,
    "maxCas" : {
      "cas_url" : "https://login.test.max.gov/cas/",
      "service_url" : "http://localhost:3000",
      "session_name" : "cas_user",
      "session_info" : "cas_userinfo",
      "is_dev_mode" : false,
      "dev_mode_user" : "dev_user",
      "renew" : true,
      "renew_query_parameter_name" : "bypassMaxsso"
    }
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
      "service_url" : "http://srt-server-dev.app.cloud.gov",
      "session_name" : "cas_user",
      "session_info" : "cas_userinfo",
      "is_dev_mode" : false,
      "dev_mode_user" : "",
      "renew" : true,
      "renew_query_parameter_name" : "bypassMaxsso"
    }
  },
  "cloudstage": {
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
      "service_url" : "http://srt-server-staging.app.cloud.gov",
      "session_name" : "cas_user",
      "session_info" : "cas_userinfo",
      "is_dev_mode" : false,
      "dev_mode_user" : "dev_user",
      "renew" : true,
      "renew_query_parameter_name" : "bypassMaxsso"
    }
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
      "service_url" : "http://srt-server-test.app.cloud.gov",
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
      "cas_url" : "https://login.test.max.gov/cas/",
      "service_url" : "http://srt-server.app.cloud.gov",
      "session_name" : "cas_user",
      "session_info" : "cas_userinfo",
      "is_dev_mode" : false,
      "dev_mode_user" : "",
      "renew" : true,
      "renew_query_parameter_name" : "bypassMaxsso"
    }
  }

}
