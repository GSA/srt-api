module.exports = function (wallaby) {
  return {
    files: [
      'server/**/*.js',
      { pattern: 'server/tests/**/*test.js', ignore: true },
      'server/config/*.json',
      'server/version.json'
    ],

    tests: [
      'server/tests/**/*test.js'
    ],

    workers: {
      recycle: true
    },

    env: {
      type: 'node',
      params: {
        env: 'JWT_SECRET=1234;NODE_ENV=development;MAIL_ENGINE=nodemailer-mock'
      }
    },
    testFramework: 'jest'
  };
};
