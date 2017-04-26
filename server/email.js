const email = require('emailjs');

var server = email.server.connect({
  user: 'solicitationreview@gmail.com',
  password: 'thisisadummy',
  host: 'smtp.gmail.com',
  ssl: true
});

server.send({
  text: 'Hey howdy',
  from: 'Solicitation Review',
  to: 'srttestuser@gmail.com>',
  cc: '',
  subject: 'Greetings'
}, function (err, message) {
  console.log(err || message);
});
