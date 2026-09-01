/**
 * Tests for the guardrails in the agency admin routes.
 *
 * Two things here are load-bearing and worth testing directly rather than
 * through HTTP:
 *
 *   wouldCreateCycle  stops an admin writing a loop into parentId or
 *                     deviationSourceId. Phase 3 caps the read path at depth 10
 *                     so a loop cannot hang a request, but that cap is a
 *                     backstop. This is the check that keeps the data sane.
 *
 *   TOP_LEVEL_TYPES   encodes the rule that a component cannot float free at the
 *                     top of the hierarchy, which is what stops unrecognised
 *                     login traffic accreting permanent top-level agencies.
 */

const NODES = new Map()

jest.mock('../models', () => ({
  Agency: {
    findByPk: async (id) => (global.__NODES__.get(Number(id)) || null)
  },
  AgencyDomain: {}, AgencySolicitationScope: {}, User: {},
  sequelize: { transaction: async () => ({ commit: async () => {}, rollback: async () => {} }) }
}))

global.__NODES__ = NODES

const { wouldCreateCycle, AGENCY_TYPES, TOP_LEVEL_TYPES } = require('../routes/admin.agency.routes')

function setHierarchy (nodes) {
  NODES.clear()
  for (const n of nodes) NODES.set(n.id, n)
}

describe('wouldCreateCycle — parent reassignment', () => {

  beforeEach(() => {
    //  1 DOD  <-  2 Navy  <-  3 NAVSEA          4 HHS (unrelated)
    setHierarchy([
      { id: 1, agency: 'DOD',    parentId: null },
      { id: 2, agency: 'Navy',   parentId: 1 },
      { id: 3, agency: 'NAVSEA', parentId: 2 },
      { id: 4, agency: 'HHS',    parentId: null }
    ])
  })

  test('an agency cannot be its own parent', async () => {
    expect(await wouldCreateCycle(2, 2, 'parentId')).toBe(true)
  })

  test('a parent cannot be reparented under its own child', async () => {
    // DOD under Navy would close the loop DOD -> Navy -> DOD
    expect(await wouldCreateCycle(1, 2, 'parentId')).toBe(true)
  })

  test('a grandparent cannot be reparented under its grandchild', async () => {
    // DOD under NAVSEA: the walk has to climb two levels to catch this
    expect(await wouldCreateCycle(1, 3, 'parentId')).toBe(true)
  })

  test('an unrelated parent is allowed', async () => {
    expect(await wouldCreateCycle(3, 4, 'parentId')).toBe(false)
  })

  test('moving a component up to a top-level agency is allowed', async () => {
    expect(await wouldCreateCycle(3, 1, 'parentId')).toBe(false)
  })

  test('clearing the parent is never a cycle', async () => {
    expect(await wouldCreateCycle(3, null, 'parentId')).toBe(false)
  })

  test('a missing target is not reported as a cycle', async () => {
    expect(await wouldCreateCycle(3, 999, 'parentId')).toBe(false)
  })
})

describe('wouldCreateCycle — deviation source', () => {

  test('the same walk protects deviationSourceId', async () => {
    setHierarchy([
      { id: 1, agency: 'A', deviationSourceId: 2 },
      { id: 2, agency: 'B', deviationSourceId: null }
    ])
    // Pointing B's deviation at A closes A -> B -> A
    expect(await wouldCreateCycle(2, 1, 'deviationSourceId')).toBe(true)
  })

  test('a deviation source that resolves cleanly is allowed', async () => {
    setHierarchy([
      { id: 1, agency: 'A', deviationSourceId: null },
      { id: 2, agency: 'B', deviationSourceId: null }
    ])
    expect(await wouldCreateCycle(2, 1, 'deviationSourceId')).toBe(false)
  })

  test('an edit is refused when a cycle already exists upstream', async () => {
    // Pre-existing loop that predates this edit. Refuse rather than extend it.
    setHierarchy([
      { id: 1, agency: 'A', parentId: 2 },
      { id: 2, agency: 'B', parentId: 1 },
      { id: 3, agency: 'C', parentId: null }
    ])
    expect(await wouldCreateCycle(3, 1, 'parentId')).toBe(true)
  })
})

describe('top-level guardrail', () => {

  test('a component may never sit at the top of the hierarchy', () => {
    expect(TOP_LEVEL_TYPES).not.toContain('federal_component')
  })

  test('an unresolved agency may never sit at the top of the hierarchy', () => {
    // This is the rule that stops unrecognised login domains accreting
    // permanent top-level agencies.
    expect(TOP_LEVEL_TYPES).not.toContain('needs_review')
  })

  test('real top-level types are permitted', () => {
    expect(TOP_LEVEL_TYPES).toEqual(
      expect.arrayContaining(['federal_agency', 'state_local', 'education', 'other'])
    )
  })

  test('every top-level type is a valid agency type', () => {
    for (const t of TOP_LEVEL_TYPES) expect(AGENCY_TYPES).toContain(t)
  })
})
