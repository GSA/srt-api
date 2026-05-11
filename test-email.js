/**
 * Test email script — sends a test email through GSA SMTP relay
 * 
 * Usage: node test-email.js
 * 
 * Per Ted Kruelski (GSA IT):
 * - Production: smtp.gsa.gov (A record, internal DNS only)
 * - Dev/Test: 159.142.160.13 or 159.142.166.247
 * - Port 25, no auth required on internal network
 * - New DNS lookup per email for best load balancing
 */

const nodemailer = require('nodemailer');

const env = process.env.NODE_ENV || 'development';

// Pick SMTP host based on environment
let smtpHost;
if (env === 'production' || env === 'clouddev' || env === 'cloudstaging') {
  smtpHost = 'smtp.gsa.gov';
} else {
  // Dev/test IPs provided by Ted
  smtpHost = '159.142.160.13';
}

console.log(`\n📧 SRT Email Test`);
console.log(`   Environment: ${env}`);
console.log(`   SMTP Host: ${smtpHost}`);
console.log(`   Port: 25`);
console.log(`   Auth: None (internal GSA relay)\n`);

const transporter = nodemailer.createTransport({
  host: smtpHost,
  port: 25,
  secure: false,
  tls: {
    rejectUnauthorized: false
  }
});

const mailOptions = {
  from: 'srt-noreply@gsa.gov',
  to: 'collin.schreyer@gsa.gov',
  subject: 'SRT 2.0 — SMTP Test Email',
  html: `
    <h2>SRT 2.0 Email Test</h2>
    <p>This is a test email sent through the GSA internal SMTP relay.</p>
    <table style="border-collapse: collapse; margin-top: 16px;">
      <tr><td style="padding: 4px 12px; font-weight: bold;">Environment:</td><td style="padding: 4px 12px;">${env}</td></tr>
      <tr><td style="padding: 4px 12px; font-weight: bold;">SMTP Host:</td><td style="padding: 4px 12px;">${smtpHost}</td></tr>
      <tr><td style="padding: 4px 12px; font-weight: bold;">Timestamp:</td><td style="padding: 4px 12px;">${new Date().toISOString()}</td></tr>
    </table>
    <p style="margin-top: 16px; color: #666;">If you received this, the GSA SMTP relay is working correctly for SRT.</p>
  `
};

console.log(`   Sending to: ${mailOptions.to}`);
console.log(`   From: ${mailOptions.from}\n`);

transporter.sendMail(mailOptions)
  .then(info => {
    console.log(`✅ Email sent successfully!`);
    console.log(`   Response: ${info.response}`);
    console.log(`   Message ID: ${info.messageId}\n`);
  })
  .catch(err => {
    console.error(`❌ Email failed:`);
    console.error(`   ${err.message}`);
    if (err.code === 'ECONNREFUSED') {
      console.error(`\n   This likely means you're not on the GSA internal network.`);
      console.error(`   smtp.gsa.gov is only accessible from within GSA's network.`);
      console.error(`   Dev/test IPs: 159.142.160.13 or 159.142.166.247`);
    }
    console.error('');
    process.exit(1);
  });
