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

    env: {
      type: 'node',
      params: {
        env: 'NODE_ENV=development;MAIL_ENGINE=nodemailer-mock'
      }
    },
    testFramework: 'jest'
  };
};
