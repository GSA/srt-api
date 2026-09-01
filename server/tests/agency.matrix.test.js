/**
 * Phase 6 test matrix.
 *
 * The scenarios from the plan, written against the real resolution functions
 * rather than mocks, so these fail if the behaviour regresses regardless of how
 * it is implemented underneath.
 *
 * The regression group at the end is the important one. Before this work, an
 * unrecognised domain had its first label passed through as though it were an
 * agency name, so someone at @wv.gov became a user of an agency called "wv".
 * Those cases are listed explicitly because they are what the change was for.
 */

const auth = require('../routes/auth.routes')
const { getGovernmentEmail, grabAgencyFromEmail, isKnownAgencyKey, NEEDS_REVIEW } = auth

// ── 6.7 to 6.10: which address SRT uses ─────────────────────────────

describe('6.7 a personal primary with a government address on the account', () => {
  test('the government address is chosen, not the personal one', () => {
    const emails = ['someone@gmail.com', 'someone@gsa.gov']
    expect(getGovernmentEmail(emails)).toBe('someone@gsa.gov')
  })

  test('order does not matter', () => {
    expect(getGovernmentEmail(['a@gsa.gov', 'a@gmail.com'])).toBe('a@gsa.gov')
  })
})

describe('6.8 a personal address only', () => {
  test('no government address is found, so the caller falls back', () => {
    expect(getGovernmentEmail(['someone@gmail.com'])).toBeNull()
  })

  test('an empty list is handled', () => {
    expect(getGovernmentEmail([])).toBeNull()
  })
})

describe('6.9 military addresses', () => {
  test('a .mil address is treated as a government address', () => {
    expect(getGovernmentEmail(['someone@navy.mil'])).toBe('someone@navy.mil')
  })

  test('a .mil address wins over a personal one', () => {
    expect(getGovernmentEmail(['p@yahoo.com', 'o@deca.mil'])).toBe('o@deca.mil')
  })
})

describe('6.10 more than one government address', () => {
  test('selection is deterministic, not dependent on iteration luck', () => {
    const emails = ['a@gsa.gov', 'b@navy.mil', 'c@usda.gov']
    const first = getGovernmentEmail(emails)
    for (let i = 0; i < 25; i++) {
      expect(getGovernmentEmail(emails)).toBe(first)
    }
    expect(first).toBe('a@gsa.gov')
  })
})

// ── 6.11 and 6.12: unmapped domains do not become agencies ──────────

describe('6.11 a government-looking domain that is not mapped', () => {
  test('resolves to Needs Review rather than inventing an agency', () => {
    expect(grabAgencyFromEmail('someone@notarealagency.gov')).toBe(NEEDS_REVIEW)
  })

  test('a state .gov also lands in Needs Review rather than becoming an agency', () => {
    expect(grabAgencyFromEmail('Tuyet.Truong@ftb.ca.gov')).toBe(NEEDS_REVIEW)
  })
})

describe('6.12 regression: unmapped domains no longer become agency names', () => {
  // Each of these previously produced an agency named after the first label of
  // the domain, so a user at @wv.gov joined an agency called "wv".
  test.each([
    ['someone@wv.gov', 'wv'],
    ['someone@gmail.com', 'gmail'],
    ['someone@mit.edu', 'mit'],
    ['someone@deca.mil', 'deca'],
    ['someone@cfpb.gov', 'cfpb']
  ])('%s does not resolve to the bare label %s', (email, label) => {
    const result = grabAgencyFromEmail(email)
    expect(result).not.toBe(label)
    expect(result).not.toBe(label.toUpperCase())
  })

  test('an unmapped domain resolves to Needs Review, which is actionable', () => {
    expect(grabAgencyFromEmail('someone@wv.gov')).toBe(NEEDS_REVIEW)
    expect(grabAgencyFromEmail('someone@mit.edu')).toBe(NEEDS_REVIEW)
  })

  test('a domain in the config map still resolves to its real agency', () => {
    // usss.dhs.gov is one of the seven entries in UNIQUE_EMAIL_AGENCY_MAPPING,
    // so the config path must still answer for it.
    const result = grabAgencyFromEmail('someone@usss.dhs.gov')
    expect(result).not.toBe(NEEDS_REVIEW)
    expect(String(result).toLowerCase()).toContain('secret service')
  })

  test('cfpb.gov is NOT in config, which is why the domain table matters', () => {
    // Laura's spreadsheet maps this domain, but the config maps never did.
    // Resolving it is the job of resolveAgencyForEmail, not this function.
    expect(grabAgencyFromEmail('someone@cfpb.gov')).toBe(NEEDS_REVIEW)
  })

  test('malformed input does not produce an agency name', () => {
    for (const bad of [null, undefined, '', 'no-at-sign', '@nodomain']) {
      const r = grabAgencyFromEmail(bad)
      expect([NEEDS_REVIEW, 'No Agency Found']).toContain(r)
    }
  })
})

describe('isKnownAgencyKey guards the lookup', () => {
  test('a key that exists in the lookup is recognised', () => {
    // Membership, not a string comparison: 25 lookup entries map to themselves,
    // so comparing input to output would report a miss as a hit.
    expect(isKnownAgencyKey('gsa')).toBe(true)
  })

  test('an unknown key is not recognised', () => {
    expect(isKnownAgencyKey('definitelynotanagency')).toBe(false)
  })

  test('malformed keys are rejected rather than throwing', () => {
    for (const bad of [null, undefined, '', 42, {}]) {
      expect(isKnownAgencyKey(bad)).toBe(false)
    }
  })
})
