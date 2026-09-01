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
const { solicitationScopeFor, deviationSourceFor } = require('../shared/agency_scope')

// ── Fixtures for the access and deviation scenarios ─────────────────
//
// A small but real hierarchy: two departments, their components, and a state
// body that sits outside the federal structure entirely.

const DOD  = { id: 1, agency: 'Department of Defense', active: true, parentId: null }
const NAVY = { id: 2, agency: 'Department of the Navy', active: true, parentId: 1 }
const DHS  = { id: 3, agency: 'Department of Homeland Security', active: true, parentId: null }
const FEMA = { id: 4, agency: 'Federal Emergency Management Agency', active: true, parentId: 3 }
const HHS  = { id: 5, agency: 'Department of Health and Human Services', active: true, parentId: null }
const CMS  = { id: 6, agency: 'Centers for Medicare and Medicaid Services', active: true, parentId: 5 }
const STATE = { id: 7, agency: 'Local, County, State Government', active: true, parentId: null }

function mockDb ({ agencies = [], scopes = [], aliases = [] } = {}) {
  return {
    Agency: {
      findAll: async ({ where }) => {
        const ids = Array.isArray(where.id) ? where.id : [where.id]
        return agencies.filter(a => ids.includes(a.id))
      },
      findByPk: async (id) => agencies.find(a => a.id === Number(id)) || null
    },
    AgencySolicitationScope: {
      findAll: async ({ where }) => scopes.filter(x => x.agencyId === where.agencyId)
    },
    AgencyAlias: {
      findAll: async ({ where }) => {
        const ids = Array.isArray(where.agency_id) ? where.agency_id : [where.agency_id]
        return aliases.filter(a => ids.includes(a.agency_id))
      }
    }
  }
}

/** Every agency sees its own solicitations, which is how the data is seeded. */
const selfScope = (...ids) => ids.map(id => ({ agencyId: id, visibleAgencyId: id }))

// ── 6.1 to 6.6: access and deviation ────────────────────────────────

describe('6.1 Navy', () => {
  const db = mockDb({ agencies: [DOD, NAVY], scopes: selfScope(1, 2) })

  test('a Navy user sees Navy solicitations and not DOD-wide ones', async () => {
    const scope = await solicitationScopeFor({ id: 1, agency: NAVY.agency, agencyId: 2 }, db)
    expect(scope).toEqual([NAVY.agency])
    expect(scope).not.toContain(DOD.agency)
  })

  test("deviation falls back to DOD, because Navy sets none of its own", async () => {
    const src = await deviationSourceFor({ id: 1, agency: NAVY.agency, agencyId: 2 }, db)
    expect(src.agency).toBe(DOD.agency)
  })
})

describe('6.2 CMS', () => {
  // CMS is deliberately scoped to see HHS as well, which Navy is not. The rules
  // are not uniform, which is why access is stored rather than derived.
  const db = mockDb({
    agencies: [HHS, CMS],
    scopes: [...selfScope(5, 6), { agencyId: 6, visibleAgencyId: 5 }]
  })

  test('a CMS user sees both CMS and HHS solicitations', async () => {
    const scope = await solicitationScopeFor({ id: 2, agency: CMS.agency, agencyId: 6 }, db)
    expect(scope).toContain(CMS.agency)
    expect(scope).toContain(HHS.agency)
  })

  test('deviation still falls back to HHS', async () => {
    const src = await deviationSourceFor({ id: 2, agency: CMS.agency, agencyId: 6 }, db)
    expect(src.agency).toBe(HHS.agency)
  })
})

describe('6.3 FEMA', () => {
  const db = mockDb({ agencies: [DHS, FEMA], scopes: selfScope(3, 4) })

  test('a FEMA user sees FEMA solicitations only', async () => {
    const scope = await solicitationScopeFor({ id: 3, agency: FEMA.agency, agencyId: 4 }, db)
    expect(scope).toEqual([FEMA.agency])
    expect(scope).not.toContain(DHS.agency)
  })

  test('deviation falls back to DHS', async () => {
    const src = await deviationSourceFor({ id: 3, agency: FEMA.agency, agencyId: 4 }, db)
    expect(src.agency).toBe(DHS.agency)
  })
})

describe('6.4 state and local', () => {
  const db = mockDb({ agencies: [STATE, DOD], scopes: selfScope(7, 1) })

  test('a state user sees no federal solicitations', async () => {
    const scope = await solicitationScopeFor({ id: 4, agency: STATE.agency, agencyId: 7 }, db)
    expect(scope).toEqual([STATE.agency])
    expect(scope).not.toContain(DOD.agency)
  })

  test('a state body inherits no federal deviation', async () => {
    // Top of its own chain, so it owns its deviation rather than borrowing one.
    const src = await deviationSourceFor({ id: 4, agency: STATE.agency, agencyId: 7 }, db)
    expect(src.agency).toBe(STATE.agency)
  })

  test('a state user with no agency record still sees only their own agency', async () => {
    // The realistic case today: resolved to Needs Review, so no agencyId at all.
    const scope = await solicitationScopeFor({ id: 5, agency: NEEDS_REVIEW }, mockDb())
    expect(scope).toEqual([NEEDS_REVIEW])
  })
})

describe('6.5 a component with its own deviation', () => {
  test('an explicit source overrides the parent chain', async () => {
    const navyOwn = { ...NAVY, deviationSourceId: 2 }
    const db = mockDb({ agencies: [DOD, navyOwn], scopes: selfScope(1, 2) })
    const src = await deviationSourceFor({ id: 6, agency: NAVY.agency, agencyId: 2 }, db)
    expect(src.agency).toBe(NAVY.agency)
    expect(src.agency).not.toBe(DOD.agency)
  })
})

describe('6.6 access and deviation are independent', () => {
  test('inheriting a deviation upward grants no sight of the parent', async () => {
    const db = mockDb({ agencies: [DOD, NAVY], scopes: selfScope(1, 2) })
    const user = { id: 7, agency: NAVY.agency, agencyId: 2 }
    const [scope, dev] = [await solicitationScopeFor(user, db), await deviationSourceFor(user, db)]
    expect(dev.agency).toBe(DOD.agency)
    expect(scope).not.toContain(DOD.agency)
  })

  test('being scoped to another agency does not change whose deviation applies', async () => {
    const cmsOwn = { ...CMS, deviationSourceId: 6 }
    const db = mockDb({
      agencies: [HHS, cmsOwn],
      scopes: [...selfScope(6), { agencyId: 6, visibleAgencyId: 5 }]
    })
    const user = { id: 8, agency: CMS.agency, agencyId: 6 }
    const [scope, dev] = [await solicitationScopeFor(user, db), await deviationSourceFor(user, db)]
    expect(scope).toContain(HHS.agency)
    expect(dev.agency).toBe(CMS.agency)
  })
})

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
