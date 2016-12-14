var env = process.env.NODE_ENV || 'development';

if (env === 'development') {
  process.env.PORT = 3000;
  process.env.MONGODB_URI = 'mongodb://localhost:27017/Section508Dash'; //modified
} else if (env === 'test') {
  process.env.PORT = 3000;
  process.env.MONGODB_URI = 'mongodb://localhost:27017/Section508DashTest'; //modified
}
  // process.env.PORT = 3000;
  // process.env.MONGODB_URI = 'SRT:SRT@ec2-54-210-59-149.compute-1.amazonaws.com:27017/Section508Dash';
