/**
 * Tests for auto-decline of personal email registrations.
 *
 * The rule that matters most here is the one that says a government address is
 * never declined. A false positive locks a legitimate reviewer out of the tool
 * and produces a support ticket, which is worse than the queue noise this
 * feature exists to remove.
 */

const configuration = require('../config/configuration')

let settings = {}
jest.spyOn(configuration, 'getConfig').mockImplementation((key, fallback) =>
  Object.prototype.hasOwnProperty.call(settings, key) ? settings[key] : fallback
)

const policy = require('../shared/email_policy')

beforeEach(() => { settings = { autoDeclinePersonalEmail: true } })

describe('when the policy is disabled', () => {
  test('nothing is declined, not even an obvious personal address', () => {
    settings = { autoDeclinePersonalEmail: false }
    expect(policy.evaluate('someone@gmail.com').decline).toBe(false)
  })
})

describe('government addresses are never declined', () => {
  test.each([
    'reviewer@gsa.gov',
    'someone@ios.doi.gov',
    'officer@navy.mil',
    'Tuyet.Truong@ftb.ca.gov'      // a state .gov, which must also pass
  ])('%s is allowed', (email) => {
    expect(policy.evaluate(email).decline).toBe(false)
  })

  test('a state address is allowed even if its domain is listed as personal', () => {
    // Guards against a misconfiguration locking out state government staff.
    settings = { autoDeclinePersonalEmail: true, personalEmailDomains: ['ftb.ca.gov'] }
    expect(policy.evaluate('Tuyet.Truong@ftb.ca.gov').decline).toBe(false)
  })
})

describe('consumer mail providers are declined', () => {
  test.each([
    'someone@gmail.com', 'someone@yahoo.com', 'someone@hotmail.com',
    'someone@outlook.com', 'someone@icloud.com', 'someone@aol.com'
  ])('%s is declined', (email) => {
    expect(policy.evaluate(email).decline).toBe(true)
  })

  test('the reason names the domain so the note is actionable', () => {
    expect(policy.evaluate('someone@gmail.com').reason).toContain('gmail.com')
  })

  test('case and surrounding whitespace do not defeat the check', () => {
    expect(policy.evaluate('  Someone@GMAIL.com  ').decline).toBe(true)
  })
})

describe('addresses that are neither government nor a known provider', () => {
  test('a contractor domain is left for a human to decide', () => {
    // bna-inc.com is a real SRT user. Declining unknown domains outright would
    // lock out contractors, so only known consumer providers are declined.
    expect(policy.evaluate('schreyerc@bna-inc.com').decline).toBe(false)
  })

  test('a university address is not declined', () => {
    expect(policy.evaluate('researcher@berkeley.edu').decline).toBe(false)
  })
})

describe('exemptions', () => {
  test('an exempt domain overrides the decline', () => {
    settings = { autoDeclinePersonalEmail: true, personalEmailExemptDomains: ['gmail.com'] }
    expect(policy.evaluate('someone@gmail.com').decline).toBe(false)
  })

  test('a single exempt address overrides the decline', () => {
    settings = {
      autoDeclinePersonalEmail: true,
      personalEmailExemptAddresses: ['tuyet.truong@gmail.com']
    }
    expect(policy.evaluate('Tuyet.Truong@gmail.com').decline).toBe(false)
    expect(policy.evaluate('someone.else@gmail.com').decline).toBe(true)
  })

  test('exemptions supplied as a comma separated string still work', () => {
    // Environment variables arrive as strings, not arrays.
    settings = { autoDeclinePersonalEmail: true, personalEmailExemptDomains: 'gmail.com, yahoo.com' }
    expect(policy.evaluate('a@gmail.com').decline).toBe(false)
    expect(policy.evaluate('b@yahoo.com').decline).toBe(false)
  })
})

describe('malformed input', () => {
  test.each([null, undefined, '', 'not-an-email', '@nodomain'])('%s is not declined', (email) => {
    expect(policy.evaluate(email).decline).toBe(false)
  })
})

describe('the decline notice', () => {
  test('addresses the recipient and reaches the right mailbox', async () => {
    const sent = []
    const ok = { sendMessage: async (m) => { sent.push(m); return { success: true } } }
    await policy.notifyDeclined('someone@gmail.com', ok, 'Tuyet')
    expect(sent).toHaveLength(1)
    expect(sent[0].to).toBe('someone@gmail.com')
    expect(sent[0].subject).toBe('Government Email Address Required')
    expect(sent[0].text).toContain('Tuyet')
  })

  test('leaves no placeholder behind when no name is known', async () => {
    // Greeting someone as "Hello {{first_name}}" is worse than no name at all.
    const sent = []
    const ok = { sendMessage: async (m) => { sent.push(m); return { success: true } } }
    await policy.notifyDeclined('someone@gmail.com', ok)
    expect(sent[0].text).not.toContain('{{')
    expect(sent[0].text).not.toContain('first_name')
  })

  test('a mail failure does not throw, because the decline still stands', async () => {
    const broken = { sendMessage: async () => { throw new Error('smtp down') } }
    await expect(policy.notifyDeclined('someone@gmail.com', broken)).resolves.toBe(false)
  })
})

describe('the enable flag survives environment variable stringification', () => {
  test('the string "false" does NOT enable the feature', () => {
    // Env vars arrive as strings and getConfig prefers them over config. Naive
    // truthiness would turn the feature on when someone set it to false.
    settings = { autoDeclinePersonalEmail: 'false' }
    expect(policy.evaluate('someone@gmail.com').decline).toBe(false)
  })

  test('the string "true" does enable it', () => {
    settings = { autoDeclinePersonalEmail: 'true' }
    expect(policy.evaluate('someone@gmail.com').decline).toBe(true)
  })

  test.each(['0', 'no', 'off', '', 'False'])('%s does not enable it', (v) => {
    settings = { autoDeclinePersonalEmail: v }
    expect(policy.evaluate('someone@gmail.com').decline).toBe(false)
  })
})
