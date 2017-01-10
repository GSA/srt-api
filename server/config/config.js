var env = process.env.NODE_ENV || 'development';

// if (env === 'development') {
//   process.env.PORT = 3000;
//   process.env.MONGODB_URI = 'mongodb://localhost:27017/Section508Dash'; //modified
// } else if (env === 'test') {
//   process.env.PORT = 3000;
//   process.env.MONGODB_URI = 'mongodb://localhost:27017/Section508DashTest'; //modified
// }
 process.env.PORT = 3000;
 process.env.MONGODB_URI = 'srt:srt@ec2-54-145-198-134.compute-1.amazonaws.com:27017/Section508Dash';
