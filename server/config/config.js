

// Below two lines are the AWS Dev/Demo environment (developement Envirnoment)
// TODO: add production to ENV configuration so we don't have to comment or uncomment lines
// productionURL
process.env.PORT = 3000;
// process.env.MONGODB_URI = 'srt:srt@localhost:27017/Section508Dash';

// localdev
process.env.MONGODB_URI = 'localhost:27017/Section508Dash';

// process.env.POSTGRES_UIR = 'postgres://utz6kah1zq8t2nyg:***REMOVED***@cg-aws-broker-prod-01fb6e1ed561.ci7nkegdizyy.us-gov-west-1.rds.amazonaws.com:5432/cgawsbrokerprodgq3wrvn8c8a772q';
process.env.POSTGRES_UIR = 'postgres://utz6kah1zq8t2nyg:***REMOVED***@192.168.1.171:5432/cgawsbrokerprodgq3wrvn8c8a772q';
process.env.POSTGRES_DB = 'cgawsbrokerprodgq3wrvn8c8a772q';
process.env.POSTGRES_PORT = '5432';
process.env.POSTGRES_HOST = '192.168.1.171';
process.env.POSTGRES_PASSWORD = '***REMOVED***';
process.env.POSTGRES_USER = 'utz6kah1zq8t2nyg';

// cloud.gov
// process.env.MONGODB_URI = ZJJ01kWhWX:***REMOVED***@xa2b82717666a4-master-client.service.kubernetes:31473/9rTP2N2npx

