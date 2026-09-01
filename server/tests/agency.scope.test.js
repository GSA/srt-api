/**
 * Differential and independence tests for agency scope resolution.
 *
 * The safety claim this file exists to prove:
 *
 *   Deploying the scope-aware visibility filter does not change what any
 *   existing user can see.
 *
 * That holds if solicitationScopeFor returns exactly [user.agency] in all three
 * states real users are currently in: no agencyId, an agency with no scope
 * rows, and an agency with only the self-scope row Phase 2 seeded. Those are the
 * first three tests. Everything after them covers the new behaviour and the
 * separation of visibility from deviation inheritance.
 */

const { solicitationScopeFor, deviationSourceFor } = require('../shared/agency_scope')

// Minimal stand-in for the sequelize models. Visibility resolution must not
// depend on anything but these two tables, so a mock that only implements them
// is also an assertion about coupling.
function mockDb ({ agencies = [], scopes = [], aliases = [], throwOn = null } = {}) {
  return {
    Agency: {
      findAll: async ({ where }) => {
        if (throwOn === 'Agency.findAll') throw new Error('db down')
        const ids = Array.isArray(where.id) ? where.id : [where.id]
        return agencies.filter(a => ids.includes(a.id))
      },
      findByPk: async (id) => {
        if (throwOn === 'Agency.findByPk') throw new Error('db down')
        return agencies.find(a => a.id === id) || null
      }
    },
    AgencySolicitationScope: {
      findAll: async ({ where }) => {
        if (throwOn === 'Scope.findAll') throw new Error('db down')
        return scopes.filter(s => s.agencyId === where.agencyId)
      }
    },
    AgencyAlias: {
      findAll: async ({ where }) => {
        if (throwOn === 'Alias.findAll') throw new Error('db down')
        const ids = Array.isArray(where.agency_id) ? where.agency_id : [where.agency_id]
        return aliases.filter(a => ids.includes(a.agency_id))
      }
    }
  }
}

const GSA  = { id: 1, agency: 'General Services Administration', active: true, parentId: null }
const DOD  = { id: 2, agency: 'Department of Defense', active: true, parentId: null }
const NAVY = { id: 3, agency: 'Department of the Navy', active: true, parentId: 2 }
const HHS  = { id: 4, agency: 'Department of Health and Human Services', active: true, parentId: null }
const CMS  = { id: 5, agency: 'Centers for Medicare and Medicaid Services', active: true, parentId: 4 }

describe('solicitationScopeFor — behaviour is unchanged for existing users', () => {

  test('user with no agencyId sees exactly their own agency', async () => {
    const user = { id: 10, agency: 'Department of Defense' }   // agencyId absent
    const scope = await solicitationScopeFor(user, mockDb())
    expect(scope).toEqual(['Department of Defense'])
  })

  test('agency with no scope rows sees exactly its own agency', async () => {
    const user = { id: 11, agency: 'Department of Defense', agencyId: 2 }
    const scope = await solicitationScopeFor(user, mockDb({ agencies: [DOD], scopes: [] }))
    expect(scope).toEqual(['Department of Defense'])
  })

  test('self-scope row alone reproduces the old filter exactly', async () => {
    // This is the state Phase 2 seeding leaves every agency in.
    const user = { id: 12, agency: 'Department of Defense', agencyId: 2 }
    const db = mockDb({ agencies: [DOD], scopes: [{ agencyId: 2, visibleAgencyId: 2 }] })
    const scope = await solicitationScopeFor(user, db)
    expect(scope).toEqual(['Department of Defense'])
  })

  test('a database failure falls back to the old filter and never throws', async () => {
    const user = { id: 13, agency: 'Department of Defense', agencyId: 2 }
    const db = mockDb({ agencies: [DOD], scopes: [{ agencyId: 2, visibleAgencyId: 2 }], throwOn: 'Scope.findAll' })
    const scope = await solicitationScopeFor(user, db)
    expect(scope).toEqual(['Department of Defense'])   // narrower-or-equal, never wider
  })
})

describe('solicitationScopeFor — new capability', () => {

  test('a component can be scoped to see its parent department too', async () => {
    const user = { id: 14, agency: 'Centers for Medicare and Medicaid Services', agencyId: 5 }
    const db = mockDb({
      agencies: [HHS, CMS],
      scopes: [{ agencyId: 5, visibleAgencyId: 5 }, { agencyId: 5, visibleAgencyId: 4 }]
    })
    const scope = await solicitationScopeFor(user, db)
    expect(scope).toContain('Centers for Medicare and Medicaid Services')
    expect(scope).toContain('Department of Health and Human Services')
    expect(scope).toHaveLength(2)
  })

  test('an inactive agency contributes nothing to scope', async () => {
    const user = { id: 15, agency: 'Department of the Navy', agencyId: 3 }
    const db = mockDb({
      agencies: [{ ...NAVY }, { ...DOD, active: false }],
      scopes: [{ agencyId: 3, visibleAgencyId: 3 }, { agencyId: 3, visibleAgencyId: 2 }]
    })
    const scope = await solicitationScopeFor(user, db)
    expect(scope).toEqual(['Department of the Navy'])
  })

  test("a user always retains their own agency even if scope rows point elsewhere", async () => {
    // Guards against an admin misconfiguration or a rename silently removing a
    // user's access to their own agency's solicitations.
    const user = { id: 16, agency: 'Department of the Navy', agencyId: 3 }
    const db = mockDb({ agencies: [DOD], scopes: [{ agencyId: 3, visibleAgencyId: 2 }] })
    const scope = await solicitationScopeFor(user, db)
    expect(scope).toContain('Department of the Navy')
  })
})

describe('deviationSourceFor — inheritance', () => {

  test('an explicit deviation source wins over the parent chain', async () => {
    const navyOverride = { ...NAVY, deviationSourceId: 3 }
    const user = { id: 17, agency: 'Department of the Navy', agencyId: 3 }
    const src = await deviationSourceFor(user, mockDb({ agencies: [DOD, navyOverride] }))
    expect(src.agency).toBe('Department of the Navy')
  })

  test('a component with no deviation of its own inherits its parent', async () => {
    const user = { id: 18, agency: 'Department of the Navy', agencyId: 3 }
    const src = await deviationSourceFor(user, mockDb({ agencies: [DOD, NAVY] }))
    expect(src.agency).toBe('Department of Defense')
  })

  test('a cycle in the hierarchy terminates instead of hanging', async () => {
    const a = { id: 20, agency: 'A', active: true, parentId: 21 }
    const b = { id: 21, agency: 'B', active: true, parentId: 20 }
    const user = { id: 19, agency: 'A', agencyId: 20 }
    const src = await deviationSourceFor(user, mockDb({ agencies: [a, b] }))
    expect(src).toBeNull()          // depth cap reached, no infinite loop
  })
})

describe('visibility and deviation are independent', () => {

  test('inheriting a deviation from the parent does not grant sight of it', async () => {
    // The whole point of Phase 2. Navy inherits DOD's deviation but is scoped
    // only to Navy solicitations. If these two ever collapse into one lookup,
    // this test fails.
    const user = { id: 30, agency: 'Department of the Navy', agencyId: 3 }
    const db = mockDb({
      agencies: [DOD, NAVY],
      scopes: [{ agencyId: 3, visibleAgencyId: 3 }]   // self only
    })

    const deviation = await deviationSourceFor(user, db)
    const scope     = await solicitationScopeFor(user, db)

    expect(deviation.agency).toBe('Department of Defense')       // inherits upward
    expect(scope).toEqual(['Department of the Navy'])            // sees only itself
    expect(scope).not.toContain('Department of Defense')
  })

  test('being scoped to another agency does not change whose deviation applies', async () => {
    // The converse. CMS can see HHS solicitations but still owns its deviation.
    const cmsOwn = { ...CMS, deviationSourceId: 5 }
    const user = { id: 31, agency: 'Centers for Medicare and Medicaid Services', agencyId: 5 }
    const db = mockDb({
      agencies: [HHS, cmsOwn],
      scopes: [{ agencyId: 5, visibleAgencyId: 5 }, { agencyId: 5, visibleAgencyId: 4 }]
    })

    const scope     = await solicitationScopeFor(user, db)
    const deviation = await deviationSourceFor(user, db)

    expect(scope).toContain('Department of Health and Human Services')  // widened sight
    expect(deviation.agency).toBe('Centers for Medicare and Medicaid Services')  // unchanged
  })
})

describe('alternate agency spellings', () => {

  test('an alias makes differently-spelled solicitations visible', () => {
    // The real case: SAM.gov posts Navy work as "DEPT OF THE NAVY" while the
    // user is recorded as "Department of the Navy".
    const user = { id: 40, agency: 'Department of the Navy', agencyId: 3 }
    const db = mockDb({
      agencies: [NAVY],
      scopes: [{ agencyId: 3, visibleAgencyId: 3 }],
      aliases: [{ agency_id: 3, alias: 'DEPT OF THE NAVY' }]
    })
    return solicitationScopeFor(user, db).then(scope => {
      expect(scope).toContain('Department of the Navy')
      expect(scope).toContain('DEPT OF THE NAVY')
    })
  })

  test('an agency with no aliases is completely unaffected', () => {
    const user = { id: 41, agency: 'Department of the Navy', agencyId: 3 }
    const db = mockDb({
      agencies: [NAVY], scopes: [{ agencyId: 3, visibleAgencyId: 3 }], aliases: []
    })
    return solicitationScopeFor(user, db).then(scope => {
      expect(scope).toEqual(['Department of the Navy'])
    })
  })

  test('aliases of another agency do not leak in', () => {
    const user = { id: 42, agency: 'Department of the Navy', agencyId: 3 }
    const db = mockDb({
      agencies: [NAVY],
      scopes: [{ agencyId: 3, visibleAgencyId: 3 }],
      aliases: [{ agency_id: 999, alias: 'SOMEONE ELSE' }]
    })
    return solicitationScopeFor(user, db).then(scope => {
      expect(scope).not.toContain('SOMEONE ELSE')
    })
  })

  test('an alias lookup failure narrows rather than fails', () => {
    const user = { id: 43, agency: 'Department of the Navy', agencyId: 3 }
    const db = mockDb({
      agencies: [NAVY],
      scopes: [{ agencyId: 3, visibleAgencyId: 3 }],
      aliases: [{ agency_id: 3, alias: 'DEPT OF THE NAVY' }],
      throwOn: 'Alias.findAll'
    })
    return solicitationScopeFor(user, db).then(scope => {
      expect(scope).toEqual(['Department of the Navy'])
    })
  })
})
