# srt-server

[![CircleCI](https://circleci.com/gh/albertcrowley/srt-api.svg?style=svg)](https://circleci.com/gh/albertcrowley/srt-api)
[![Maintainability](https://api.codeclimate.com/v1/badges/69b675319203911584f6/maintainability)](https://codeclimate.com/github/albertcrowley/srt-api/maintainability)
[![Test Coverage](https://api.codeclimate.com/v1/badges/69b675319203911584f6/test_coverage)](https://codeclimate.com/github/albertcrowley/srt-api/test_coverage)

The srt-server application is an expressjs Node application that provides a 
REST API for the srt-client. Together the client/server provide a web portal
to view reports from and provide feedback to the Solicitation Review Tool (SRT).

Release notes are available in the [release-notes.md](release-notes.md) file.

## Deployment
This web application is intended for deployment to cloud.gov. Deployment is 
most easily performed using the deploy.sh script which will baseline, build, 
deploy, and configure the SRT application. In the most simple case of deploying 
a __previously baselined__ version of the application to the staging space on 
cloud.gov:

    deploy.sh staging v1.4.0
    
The full list of options available during deployment are:

    usage: deploy.sh [OPTIONS] <SPACE> <TAG>

        -d --dry-run : do everything but push to cloud.gov
        -s --serverrepo : URI for srt-server repository
        -c --clientrepo : URI for srt-client repository
        -t --tempdir : defaults to /tmp
        -y --yes : delete existing git repo in temp directory
        -n --no : do not delete any existing git repo in temp directory
        -b --create-tag-from-branch : Create TAG at head of this branch
                
## Running / Configuration
The `npm run start` command will start the server. Database configuration options are
read from server/dbConfig/dbConfig.js and general configuration from 
server/config/config.js file. dbConfig.json holds the configuration 
for every environment the app my be run in and the specific configuration for
this run is chosen based on the NODE_ENV environment variable.

Database connection information is stored in the dbConfig.js file but will be
overridden by any settings in the VCAP_SERVICES environment variable. This feature
allows cloud.gov to inject the proper database connection information upon
startup.

There are a few environment variables that control the configuration or set security
sensitive keys. The deployment script may will prompt you for some of these if they
are not already configured in the target cloud.gov environment. On cloud.gov any
variables you would like to configure manually can be changed using the cloud.gov control 
panel or CLI.

**Environment Variables**  
* **SENDGRID_API_KEY** - _This feature is no longer used but is included here should it be needed in the future._
  If using Sendgrid as an email server, set this variable to an appropriate API key. 
If this is not set in a cloud.gov environment, the deployment script will give the option to set it.
* **NODE_ENV** - This should be set based on the environment. It is used to choose between the 
available configuration settings. Examples include production, cloudstage, clouddev, circle, development.
The definitive list can be found by reading config.js.
* **VCAP_SERVICES** - cloud.gov will automatically set this environment variable. It contains connection information 
for the configured postgres database for that environment - and also any other cloud.gov services or connections 
that may be configured int the future. 
* **VCAP_APPLICAION** - While not currently used, this environment variable is automatically set by cloud.gov
and contains information about the running application such as memory/disk limits, space and instance IDs,
and DNS info.
* **MAIL_ENGINE** - Used in development. If this is set it will over-ride the usual 'nodemailer' mail engine. It is 
used for testing when sending actual email is not desirable.
* **JWT_SECRET** - _Not currently implemented_ - will be used to set the encryption secret used to sign JSON Web Tokens.   
  

## Documentation
Documentation for the srt-server is created from JSDoc tags embeded in the
source code. You can find a pre-build copy in the the [/docs](docs/index.html) 
directory of this repository. The documentaiton can be rebuilt from 
source when updats are necessary using `npm run doc`


## Testing and Continuous Integration / Continuous Deployment
The srt-server application has a set of unit test in the server/tests directory.
These can be run from the command line with `npm run test`  Database connection
are not mocked for the unit tests to ensure that data flows properly through 
the system and into the database. This means that you will want to have a running
database before starting the tests.

A test database file can be found in srt-database-export.sql.gz. This database export is saved
as an encrypted file to prevent bug-bounty hunters from flagging the test users in the file
as security issues. The NPM package cryptify is used to encrypt/decrypt the file.   There is a database
load process scripted in the `npm run restore-db` command that includes the encryption key. 
The package.json file has connection information coded directly into that command. When running 
this for the first time, that file will need to be updated to your local settings.

__Many unit tests depend on having solicitation data updated in the last 30-90 days. If you are using 
a database snapshot older than that, you will likely get numerous test failures.__  The simplest 
solution is to run the srt-fbo-scraper to pull in new solicitation data. After that, you may want to 
the test database export.  

Continuous integration and Deployment is configured in the .circleci/config.yml file 
in the CircleCI format. The CI server will start a Postgres database and load it with test data before 
automatically running the unit tests.

A very brief Selenium IDE integration test can be found in the srt-client repository
under test/SRT.side. The integration test is not run automatically by the CI server.

