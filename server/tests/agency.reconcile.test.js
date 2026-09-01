/**
 * Tests for the spreadsheet reconciliation helpers.
 *
 * The transposition detection matters most. It silently reinterprets 83 rows of
 * the source, so it has to be right in both directions: it must correct a
 * genuinely reversed row, and it must leave a correctly ordered row alone. A
 * false positive here would inject a department as a component of its own
 * bureau, which nothing downstream would catch.
 */

const {
  cleanText, normalizeDomain, canonicalKey, preferredSpelling,
  findTypos, classify, extractRows, parseCsv, DOMAIN_SHAPE
} = require('../scripts/reconcile_agency_spreadsheet')

const row = (line, domain, affiliation, association) => ({ line, domain, affiliation, association })

describe('column transposition', () => {

  test('corrects a reversed row, department in the affiliation column', () => {
    const [r] = extractRows([row(137, '', 'Department of War', 'Defense Advanced Research Projects Agency')])
    expect(r.transposed).toBe(true)
    expect(r.entity).toBe('Defense Advanced Research Projects Agency')
    expect(r.parent).toBe('Department of War')
  })

  test('leaves a correctly ordered row alone', () => {
    const [r] = extractRows([row(3, '', 'Agricultural Marketing Service', 'Department of Agriculture')])
    expect(r.transposed).toBe(false)
    expect(r.entity).toBe('Agricultural Marketing Service')
    expect(r.parent).toBe('Department of Agriculture')
  })

  test('does not transpose when both columns name a department', () => {
    // Ambiguous, so the sheet's own order is respected rather than guessed at.
    const [r] = extractRows([row(50, '', 'Department of the Navy', 'Department of Defense')])
    expect(r.transposed).toBe(false)
    expect(r.entity).toBe('Department of the Navy')
    expect(r.parent).toBe('Department of Defense')
  })

  test('does not transpose when neither column names a department', () => {
    const [r] = extractRows([row(60, '', 'US Secret Service', 'Homeland Security')])
    expect(r.transposed).toBe(false)
    expect(r.entity).toBe('US Secret Service')
  })

  test('a row naming the same body twice is top level, not its own child', () => {
    const [r] = extractRows([row(27, '', 'Department of Commerce', 'Department of Commerce')])
    expect(r.entity).toBe('Department of Commerce')
    expect(r.parent).toBe('')
  })

  test('the US prefix does not defeat the same-name check', () => {
    const [r] = extractRows([row(28, '', 'Department of Commerce', 'US Department of Commerce')])
    expect(r.parent).toBe('')
  })

  test('blank rows are dropped', () => {
    expect(extractRows([row(131, '', '', '')])).toHaveLength(0)
  })
})

describe('normalisation', () => {

  test('strips a leading at sign and lowercases', () => {
    expect(normalizeDomain('  @CFPB.GOV ')).toBe('cfpb.gov')
  })

  test('returns null for an empty cell', () => {
    expect(normalizeDomain('   ')).toBeNull()
  })

  test('removes a non-breaking space that would create a duplicate agency', () => {
    expect(cleanText('Board of Governors of the Federal Reserve '))
      .toBe('Board of Governors of the Federal Reserve')
  })

  test('removes zero-width characters', () => {
    expect(cleanText('Foo​Bar')).toBe('FooBar')
  })

  test('the US prefix collapses to the same canonical key', () => {
    expect(canonicalKey('U.S. Department of Commerce')).toBe(canonicalKey('Department of Commerce'))
    expect(canonicalKey('US Department of Commerce')).toBe(canonicalKey('Department of Commerce'))
  })

  test('different agencies do not collide', () => {
    expect(canonicalKey('Department of Commerce')).not.toBe(canonicalKey('Department of Labor'))
  })

  test('the unprefixed spelling wins', () => {
    expect(preferredSpelling(['US Department of Commerce', 'Department of Commerce']))
      .toBe('Department of Commerce')
    expect(preferredSpelling(['U.S. Department of Agriculture', 'Department of Agriculture', 'US Department of Agriculture']))
      .toBe('Department of Agriculture')
  })

  test('real domains pass the shape check and malformed ones do not', () => {
    expect(DOMAIN_SHAPE.test('associates.usss.dhs.gov')).toBe(true)
    expect(DOMAIN_SHAPE.test('dodea.edu')).toBe(true)
    expect(DOMAIN_SHAPE.test('not a domain')).toBe(false)
    expect(DOMAIN_SHAPE.test('trailing.')).toBe(false)
  })
})

describe('typo detection', () => {

  test('flags the known misspelling in the source', () => {
    expect(findTypos('Defense Commisary Agency'))
      .toEqual([{ wrong: 'commisary', suggestion: 'commissary' }])
  })

  test('does not flag the correct spelling', () => {
    expect(findTypos('Defense Commissary Agency')).toEqual([])
  })

  test('does not flag ordinary agency names', () => {
    expect(findTypos('Department of Health and Human Services')).toEqual([])
    expect(findTypos('Bureau of Land Management')).toEqual([])
  })
})

describe('classification', () => {

  test('a gov domain with a parent is a federal component', () => {
    expect(classify({ entity: 'Agricultural Marketing Service', parent: 'Department of Agriculture', domain: 'ams.usda.gov' }))
      .toBe('federal_component')
  })

  test('a gov domain with no parent is a federal agency', () => {
    expect(classify({ entity: 'Small Business Administration', parent: '', domain: 'sba.gov' }))
      .toBe('federal_agency')
  })

  test('a mil domain classifies like a gov domain', () => {
    expect(classify({ entity: 'Space Force', parent: '', domain: 'spaceforce.mil' })).toBe('federal_agency')
  })

  test('an edu domain is education', () => {
    expect(classify({ entity: 'DoD Education Activity', parent: 'Department of War', domain: 'dodea.edu' }))
      .toBe('education')
  })

  test('a name naming state or local government is state_local', () => {
    expect(classify({ entity: 'Local, County, State Government', parent: '', domain: 'txdot.gov' }))
      .toBe('state_local')
  })

  test('an unclear .us domain becomes needs_review rather than a guess', () => {
    expect(classify({ entity: 'Missions Support', parent: '', domain: 'missionsupport.us' }))
      .toBe('needs_review')
  })
})

describe('csv parsing', () => {

  test('handles quoted fields containing commas', () => {
    const rows = parseCsv('a,b\n"Bureau of Alcohol, Tobacco, Firearms",Department of Justice\n')
    expect(rows[1][0]).toBe('Bureau of Alcohol, Tobacco, Firearms')
    expect(rows[1][1]).toBe('Department of Justice')
  })

  test('handles escaped quotes and CRLF', () => {
    const rows = parseCsv('a,b\r\n"He said ""hi""",x\r\n')
    expect(rows[1][0]).toBe('He said "hi"')
  })
})
