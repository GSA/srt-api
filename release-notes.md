## Sprint 10 Release Notes - January 2022
### Bug Fixes
* Send the solicitiaton ID number in the return result of the feedback report
* Remove unnecessary notice type adjustment
* Fix test case to use proper solNum as the sample
### Security Updates
* snyk package updates

## Sprint 9 Release Notes - September 2021
### Features
* Converting database tables to reflect SAM.gov changes
* Now use the Solicitation table as the source of truth for Solicititations
* Improved data processing/formatting

### Security Updates
* SNYK flagged package updates

## Sprint 8 Release Notes - April 2021
### Features
* Added Sequelize model relationship between survey_results and the Prediction table
* Performance improvement for the Prediction model creation
* Modified the system analytics to include both the new and updated solicitations for the Scanned Solicitations chart
* Extracted the Scanned Solicitations data from the main analytics and into its own API route
* Added ability to download a CSV of the Scanned Solicitations data
* Added Predictions Metrics by Date and Agency report
* Added Notice Type Change Metrics report.
### Security updates
* Reduced production memory usage for the API from 2 Gb to 1GB
* Bug fix - Updated the default max predictions returned by the API
* Bug fix - add missing 'active' parameter for the Solicitation constructor
* Bug fix - Fixed issue causing crash on the Analytics page when an agency without a documented abbreviation is used

## Sprint 7 Release Notes 

### Features
* Added user login reports API call
* Added user feedback report API call
* Added unit tests for admin reports
* Agency names are now normalized between SAM.gov data, FedBizOps data, and MAX login data
* Reorganized menu items: removed user management and added an admin menu and sub-menu
* Retain full log information locally in the Postgres database
* Reformatted log output for better integration with cloud.gov log aggregator
* Continuous Integration / Continuous Deployment Changes
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

## Sprint 6 Release Notes - June 2020


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



