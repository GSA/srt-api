'use strict'

/**
 * Whether a self-registered account should be declined automatically.
 *
 * SRT is for government reviewers, and personal addresses are almost always
 * someone signing up with the wrong account rather than someone who belongs
 * here. Declining them on arrival saves an administrator from working through a
 * queue of obvious rejections.
 *
 * Two deliberate limits on that:
 *
 * A decline is never permanent. It sets isRejected, which an administrator can
 * clear from the Users screen, and the person is told how to ask for that.
 * This matters more than it looks: state and local users may have no way to
 * hold a government address, and a hard block would shut them out with no
 * recourse.
 *
 * The whole behaviour is off unless autoDeclinePersonalEmail is enabled in
 * config, and individual addresses or domains can be exempted without a deploy.
 */

const configuration = require('../config/configuration')
const getConfig = configuration.getConfig
const logger = require('../config/winston')

/**
 * Consumer mail providers. Not exhaustive by design: this list only has to
 * catch the common cases, because anything it misses simply reaches an
 * administrator the way it does today.
 */
const DEFAULT_PERSONAL_DOMAINS = [
  'gmail.com', 'googlemail.com', 'yahoo.com', 'ymail.com', 'rocketmail.com',
  'hotmail.com', 'outlook.com', 'live.com', 'msn.com', 'aol.com',
  'icloud.com', 'me.com', 'mac.com', 'protonmail.com', 'proton.me',
  'gmx.com', 'mail.com', 'zoho.com', 'yandex.com', 'comcast.net',
  'verizon.net', 'att.net', 'sbcglobal.net', 'cox.net', 'bellsouth.net'
]

function listFromConfig (key, fallback) {
  let v = getConfig(key, fallback)
  if (typeof v === 'string') {
    try { v = JSON.parse(v) } catch (e) { v = v.split(',') }
  }
  if (!Array.isArray(v)) return fallback
  return v.map(x => String(x).trim().toLowerCase()).filter(Boolean)
}

/** True only for a real boolean true or the string "true". */
function isEnabled (key) {
  const v = getConfig(key, false)
  if (typeof v === 'boolean') return v
  return String(v).trim().toLowerCase() === 'true'
}

function domainOf (email) {
  if (!email || typeof email !== 'string' || !email.includes('@')) return null
  return email.split('@').pop().trim().toLowerCase() || null
}

/**
 * Decide what to do with a newly registered address.
 *
 * @param {string} email
 * @returns {{decline: boolean, reason: string|null}}
 */
function evaluate (email) {
  const allow = { decline: false, reason: null }

  // Environment variables always arrive as strings, and getConfig prefers them
  // over the config file. Without coercion the string "false" is truthy, so
  // setting the flag to false to turn the feature OFF would switch it ON.
  if (!isEnabled('autoDeclinePersonalEmail')) return allow

  const domain = domainOf(email)
  if (!domain) return allow

  // A government address is never declined, whatever else is configured.
  if (domain.endsWith('.gov') || domain.endsWith('.mil')) return allow

  const exemptDomains = listFromConfig('personalEmailExemptDomains', [])
  if (exemptDomains.includes(domain)) return allow

  const exemptAddresses = listFromConfig('personalEmailExemptAddresses', [])
  if (exemptAddresses.includes(String(email).trim().toLowerCase())) return allow

  const personal = listFromConfig('personalEmailDomains', DEFAULT_PERSONAL_DOMAINS)
  if (!personal.includes(domain)) return allow

  return {
    decline: true,
    reason: `Registered with a personal email address (${domain}). SRT accounts are for government staff.`
  }
}

/**
 * Tell the person why, and how to get it overturned. A decline with no
 * explanation just produces an email to the help desk.
 */
async function notifyDeclined (email, emailRoutes) {
  const supportAddress = getConfig('srtSupportEmail', 'srt@gsa.gov')
  const subject = 'About your Solicitation Review Tool request'
  const body = [
    'Thank you for requesting access to the Solicitation Review Tool.',
    '',
    'Your request was not approved because it was submitted with a personal email',
    'address. SRT accounts are normally issued to government staff using a',
    'government address.',
    '',
    'If you work for a federal, state, local, or tribal government and cannot use a',
    'government address for this, please reply to ' + supportAddress + ' and tell us',
    'your agency and role. We can review the request and approve it manually.',
    '',
    'Solicitation Review Tool',
    'Government-wide IT Accessibility Program'
  ].join('\n')

  try {
    await emailRoutes.sendMessage({
      to: email,
      subject,
      text: body.replace(/\n/g, '<br/>')
    })
    logger.log('info', 'Sent auto-decline notice', { email, tag: 'auto-decline' })
    return true
  } catch (e) {
    // The decline still stands. Failing to send mail must not fail the login.
    logger.log('error', 'Could not send auto-decline notice', {
      email, error: e && e.message, tag: 'auto-decline'
    })
    return false
  }
}

module.exports = { evaluate, notifyDeclined, domainOf, isEnabled, DEFAULT_PERSONAL_DOMAINS }
