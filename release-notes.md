# SRT Server API Release Notes

## Sprint 5 Release Notes - June 2020

### Features
* Added user login reports API call
* Added user feedback report API call
* Added unit tests for admin reports
* Agency names are now normalized between SAM.gov data, FedBizOps data, and MAX login data
* Reorganized menu items: removed user management and added an admin menu and sub-menu
* Retain full log information locally in the Postgres database   
* Reformatted log output for better integration with cloud.gov log aggrigator

### Continuous Integration / Continuous Deployment Changes
* Added Continuous Deployment to CircleCI configuration
* Added separate workflows for GSA and non-GSA github repoositories
* Added support to deploy any non dev/staging/prod branch to dev when requested
* Postgres version changed to 9.5.15 to match cloud.gov
* Updated test dataset with additional solicitation data
* Run CI tests in parallel
* Use cloud.gov service accounts specific to each environemnt for build/deploy

### Security
* Removed unused NPM modules 
* Moved some NPM modules into the to development only category 

### Fixes
* Changed the loadPredictions script to not invalidate cached predictions by default
* Modified unit tests to be more stable on different test data or re-runs on a single dataset
* Removed unicode characters from solicitation history  
* Replaced toLocaleString() function calls with the moment NPM module
* Fixed SQL bug that was preventing the update of some Prediction entries
* Updted node version to match latest supported cloud.gov  
* Added SNYK supplied patches for NPM module security issues
* IE fixes for solicitation pages
* Updated Masquerade feature to support the normalized agency names



