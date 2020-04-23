#!/bin/bash

# User table
sequelize model:generate --force --name User --attributes firstName:string,lastName:string,agency:string,email:string,password:string,position:string,isAccepted:BOOLEAN,isRejected:BOOLEAN,userRole:string,rejectionNote:string,creationDate:string,tempPassword:string

# Agency table
sequelize model:generate --force --name Agency --attributes agency:string,acronym:string

sequelize model:generate --force --name Survey --attributes id:integer,question:string,choices:jsonb,section:string,type:string,answer:string,Note:string,choicesNote:jsonb

# other table
npm install sequelize-auto-v2
npm install pg@6.4.2
sequelize-auto -s public -e postgres -h 192.168.1.126 -d cgawsbrokerprodgq3wrvn8c8a772q -u utz6kah1zq8t2nyg -x ***REMOVED***
***REMOVED***  -o .\server\models -t attachment
