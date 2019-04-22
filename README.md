# srt-server

[![CircleCI](https://circleci.com/gh/albertcrowley/srt-api.svg?style=svg)](https://circleci.com/gh/albertcrowley/srt-api)

The srt-server application is an expressjs Node application that provides a 
REST API for the srt-client. Together the client/server provide a web portal
to view reports from and provide feedback to the Solicitation Review Tool (SRT).

## Deployment
This web application is intended for deployment to cloud.gov. Deployment is 
most easily performed using the deploy.sh script which will baseline, build, 
deploy, and configure the SRT application. In the most simple case of deploying 
a previously baselined version of the application to the staging space on 
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
        
        
## Documentation
Documentation for the srt-server is created from JSDoc tags embeded in the
source code. You can find a pre-build copy in the the [/docs](docs/index.html) 
directory of this repository. The documentaiton can be rebuilt from 
source when updats are necessary using `npm run doc`

## Running / Configuration
The `npm run start` command will start the server. Database configuration options are
read from server/dbConfig/dbConfigig.js and general configuration from server/dbConfig/dbConfig.json file. dbConfig.json holds the configuration 
for every environment the app amy be run in and the specific configuration for
this run is chosen based on the NODE_ENV environment variable.

Database connection information is stored in the dbConfig.jsjs file but will be
overridden by any settings in the VCAP_SERVICES environment variable. This feature
allows cloud.gov to inject the proper database connection information upon
startup.

## Testing and Continuous Integration
The srt-server application has a set of unit test in the server/tests directory.
These can be run from the command line with `npm run test`  Database connection
are not mocked for the unit tests to ensure that data flows properly through 
the system and into the database. 

A test database file can be found in srt-database-export.sql.gz. There is a database
load process scripted in the `npm run restore-db` command. The package.json file has 
connection information coded directly into that command. When running this for
the first time, that file will need to be updated to your local settings. 

Continuous integration is configured in the .gilab-ci.yml file in the Gitlab format.
The CI server will start a Postgres database and load it with test data before 
automatically running the unit tests.

A very brief Selenium IDE integration test can be found in the srt-client repository
under test/SRT.side. The integration test is not run automatically by the CI server.

