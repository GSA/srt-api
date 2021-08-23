'use strict'
const migrationUtils = require('../migrationUtil')

// This migration is to force a rebuild of the Predictions table to update
// the auto generated Record Created action status to be Solicitation Posted

let upSql = [
  `drop table if exists agency_alias`,
  `create table agency_alias
   (
       id serial not null
           constraint agency_alias_pk
               primary key,
       agency_id int not null,
       alias varchar,
       "createdAt" timestamp,
       "updatedAt" timestamp
   )`,
  `alter table solicitations add column agency_id int`,
  `insert into agency_alias (agency_id, alias)  select id, 'AGRICULTURE, DEPARTMENT OF' from "Agencies" where agency = 'Department of Agriculture';`,
  `insert into agency_alias (agency_id, alias)  select id, 'COMMERCE, DEPARTMENT OF' from "Agencies" where agency = 'Department of Commerce';`,
  `insert into agency_alias (agency_id, alias)  select id, 'DEPT OF DEFENSE' from "Agencies" where agency = 'Department of Defense';`,
  `insert into agency_alias (agency_id, alias)  select id, 'DEPARTMENT OF DEFENSE' from "Agencies" where agency = 'Department of Defense';`,
  `insert into agency_alias (agency_id, alias)  select id, 'Defense Logistics Agency' from "Agencies" where agency = 'Department of Defense';`,
  `insert into agency_alias (agency_id, alias)  select id, 'Other Defense Agencies' from "Agencies" where agency = 'Department of Defense';`,
  `insert into agency_alias (agency_id, alias)  select id, 'Defense Information Systems Agency' from "Agencies" where agency = 'Department of Defense';`,
  `insert into agency_alias (agency_id, alias)  select id, 'EDUCATION, DEPARTMENT OF' from "Agencies" where agency = 'Department of Education';`,
  `insert into agency_alias (agency_id, alias)  select id, 'HEALTH AND HUMAN SERVICES, DEPARTMENT OF' from "Agencies" where agency = 'Department of Health and Human Services';`,
  `insert into agency_alias (agency_id, alias)  select id, 'HOMELAND SECURITY, DEPARTMENT OF' from "Agencies" where agency = 'Department of Homeland Security';`,
  `insert into agency_alias (agency_id, alias)  select id, 'HOUSING AND URBAN DEVELOPMENT, DEPARTMENT OF' from "Agencies" where agency = 'Department of Housing and Urban Development';`,
  `insert into agency_alias (agency_id, alias)  select id, 'JUSTICE, DEPARTMENT OF' from "Agencies" where agency = 'Department of Justice';`,
  `insert into agency_alias (agency_id, alias)  select id, 'LABOR, DEPARTMENT OF' from "Agencies" where agency = 'Department of Labor';`,
  `insert into agency_alias (agency_id, alias)  select id, 'STATE, DEPARTMENT OF' from "Agencies" where agency = 'Department of State';`,
  `insert into agency_alias (agency_id, alias)  select id, 'INTERIOR, DEPARTMENT OF THE' from "Agencies" where agency = 'Department of the Interior';`,
  `insert into agency_alias (agency_id, alias)  select id, 'TREASURY, DEPARTMENT OF THE' from "Agencies" where agency = 'Department of the Treasury';`,
  `insert into agency_alias (agency_id, alias)  select id, 'TRANSPORTATION, DEPARTMENT OF' from "Agencies" where agency = 'Department of Transportation';`,
  `insert into agency_alias (agency_id, alias)  select id, 'ENVIRONMENTAL PROTECTION AGENCY' from "Agencies" where agency = 'Environmental Protection Agency';`,
  `insert into agency_alias (agency_id, alias)  select id, 'EXECUTIVE OFFICE OF THE PRESIDENT' from "Agencies" where agency = 'Executive Office of the President';`,
  `insert into agency_alias (agency_id, alias)  select id, 'GENERAL SERVICES ADMINISTRATION' from "Agencies" where agency = 'General Services Administration';`,
  `insert into agency_alias (agency_id, alias)  select id, 'AGENCY FOR INTERNATIONAL DEVELOPMENT' from "Agencies" where agency = 'Agency for International Development';`,
  `insert into agency_alias (agency_id, alias)  select id, 'NATIONAL AERONAUTICS AND SPACE ADMINISTRATION' from "Agencies" where agency = 'National Aeronautics and Space Administration';`,
  `insert into agency_alias (agency_id, alias)  select id, 'NATIONAL SCIENCE FOUNDATION' from "Agencies" where agency = 'National Science Foundation';`,
  `insert into agency_alias (agency_id, alias)  select id, 'NUCLEAR REGULATORY COMMISSION' from "Agencies" where agency = 'Nuclear Regulatory Commission';`,
  `insert into agency_alias (agency_id, alias)  select id, 'OFFICE OF PERSONNEL MANAGEMENT' from "Agencies" where agency = 'Office of Personnel Management';`,
  `insert into agency_alias (agency_id, alias)  select id, 'SMALL BUSINESS ADMINISTRATION' from "Agencies" where agency = 'Small Business Administration';`,
  `insert into agency_alias (agency_id, alias)  select id, 'SOCIAL SECURITY ADMINISTRATION' from "Agencies" where agency = 'Social Security Administration';`,
  `insert into agency_alias (agency_id, alias)  select id, 'LIBRARY OF CONGRESS' from "Agencies" where agency =  'Library of Congress';`,
  `insert into agency_alias (agency_id, alias)  select id, 'VETERANS AFFAIRS, DEPARTMENT OF' from "Agencies" where agency =  'Department of Veterans Affairs';`,
  `insert into agency_alias (agency_id, alias)  select id, 'NATIONAL ARCHIVES AND RECORDS ADMINISTRATION' from "Agencies" where agency =  'National Archives and Records Administration';`,
  `insert into agency_alias (agency_id, alias)  select id, 'ENERGY, DEPARTMENT OF' from "Agencies" where agency = 'Department of Energy';`,
  `insert into agency_alias (agency_id, alias)  select id, 'MILLENNIUM CHALLENGE CORPORATION' from "Agencies" where agency = 'Millennium Challenge Corporation'`
]

let downSql = [
  `drop table agency_alias`,
  `alter table solicitations drop column agency_id`,

]


module.exports = migrationUtils.migrateUpDown(upSql, downSql)





