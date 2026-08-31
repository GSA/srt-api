'use strict'

/**
 * Phase 2 of the agency/domain mapping work: give SRT a real hierarchy.
 *
 * Extends the existing Agencies table rather than creating a parallel one, so
 * there is a single source of truth. Agencies and agency_alias already exist
 * and are already populated.
 *
 * Establishes four things the schema did not previously have:
 *
 *   1. A parent/component hierarchy        -> Agencies.parentId
 *   2. A classification for each entry     -> Agencies.agencyType
 *   3. Email domain to agency mapping      -> agency_domains
 *   4. Solicitation access scope, kept     -> agency_solicitation_scope
 *      deliberately separate from
 *      deviation inheritance               -> Agencies.deviationSourceId
 *
 * Point 4 is the architectural correction. Access scope answers "what
 * solicitations can this user see"; deviation source answers "whose deviation
 * applies to this user". They frequently differ: a Navy user sees Navy
 * solicitations but inherits the DOD deviation. Conflating them is what this
 * migration exists to prevent.
 *
 * Every step is guarded so the migration is safe to re-run. Nothing is dropped
 * and no existing column changes type, so it is backwards compatible with the
 * current exact-agency visibility check.
 */

const AGENCY_TYPES = [
  'federal_agency',
  'federal_component',
  'state_local',
  'education',
  'other',
  'needs_review'
]

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const agencies = await queryInterface.describeTable('Agencies')

    // --- 1. hierarchy -----------------------------------------------------
    if (!agencies.parentId) {
      await queryInterface.addColumn('Agencies', 'parentId', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'Agencies', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      })
    }

    // --- 2. classification ------------------------------------------------
    // Stored as a string with a check constraint rather than a native enum, so
    // adding a category later does not require an ALTER TYPE.
    if (!agencies.agencyType) {
      await queryInterface.addColumn('Agencies', 'agencyType', {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'needs_review'
      })
      await queryInterface.sequelize.query(
        `ALTER TABLE "Agencies" ADD CONSTRAINT agencies_agencytype_check
         CHECK ("agencyType" IN (${AGENCY_TYPES.map(t => `'${t}'`).join(',')}))`
      )
    }

    // --- 3. deviation source, separate from access ------------------------
    // NULL means "inherit from parent". A value means this agency overrides.
    if (!agencies.deviationSourceId) {
      await queryInterface.addColumn('Agencies', 'deviationSourceId', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'Agencies', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      })
    }

    if (!agencies.active) {
      await queryInterface.addColumn('Agencies', 'active', {
        type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true
      })
    }

    // Where this record came from: seed, spreadsheet import, admin, or review.
    if (!agencies.provenance) {
      await queryInterface.addColumn('Agencies', 'provenance', {
        type: Sequelize.STRING, allowNull: true
      })
    }

    // --- 4. email domain mapping -----------------------------------------
    const tables = await queryInterface.showAllTables()
    if (!tables.includes('agency_domains')) {
      await queryInterface.createTable('agency_domains', {
        id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
        // stored lowercase, without a leading '@'
        domain: { type: Sequelize.STRING, allowNull: false, unique: true },
        agencyId: {
          type: Sequelize.INTEGER, allowNull: true,
          references: { model: 'Agencies', key: 'id' },
          onUpdate: 'CASCADE', onDelete: 'SET NULL'
        },
        active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        source: { type: Sequelize.STRING, allowNull: true },
        // the value exactly as it arrived, for audit and debugging
        originalRawValue: { type: Sequelize.STRING, allowNull: true },
        createdAt: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('NOW') },
        updatedAt: { allowNull: true, type: Sequelize.DATE }
      })
      await queryInterface.addIndex('agency_domains', ['agencyId'])
    }

    // --- 5. solicitation access scope ------------------------------------
    // Explicit rather than derived from the hierarchy, because the rules are
    // not uniform: a Navy user sees only Navy, but a CMS user may be scoped to
    // both CMS and HHS. Deriving from parentId cannot express that.
    if (!tables.includes('agency_solicitation_scope')) {
      await queryInterface.createTable('agency_solicitation_scope', {
        id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
        // the agency the user belongs to
        agencyId: {
          type: Sequelize.INTEGER, allowNull: false,
          references: { model: 'Agencies', key: 'id' },
          onUpdate: 'CASCADE', onDelete: 'CASCADE'
        },
        // an agency whose solicitations that user may see
        visibleAgencyId: {
          type: Sequelize.INTEGER, allowNull: false,
          references: { model: 'Agencies', key: 'id' },
          onUpdate: 'CASCADE', onDelete: 'CASCADE'
        },
        createdAt: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('NOW') },
        updatedAt: { allowNull: true, type: Sequelize.DATE }
      })
      await queryInterface.addConstraint('agency_solicitation_scope', {
        fields: ['agencyId', 'visibleAgencyId'],
        type: 'unique',
        name: 'agency_solicitation_scope_unique'
      })
    }

    // --- 6. link users to the hierarchy ----------------------------------
    // Added alongside Users.agency, not replacing it. Five route files still
    // read the string; it is retired only after the new path has settled.
    const users = await queryInterface.describeTable('Users')
    if (!users.agencyId) {
      await queryInterface.addColumn('Users', 'agencyId', {
        type: Sequelize.INTEGER, allowNull: true,
        references: { model: 'Agencies', key: 'id' },
        onUpdate: 'CASCADE', onDelete: 'SET NULL'
      })
      await queryInterface.addIndex('Users', ['agencyId'])
    }
  },

  down: async (queryInterface) => {
    const tables = await queryInterface.showAllTables()
    const users = await queryInterface.describeTable('Users')
    if (users.agencyId) await queryInterface.removeColumn('Users', 'agencyId')
    if (tables.includes('agency_solicitation_scope')) await queryInterface.dropTable('agency_solicitation_scope')
    if (tables.includes('agency_domains')) await queryInterface.dropTable('agency_domains')

    const agencies = await queryInterface.describeTable('Agencies')
    await queryInterface.sequelize.query('ALTER TABLE "Agencies" DROP CONSTRAINT IF EXISTS agencies_agencytype_check')
    for (const col of ['provenance', 'active', 'deviationSourceId', 'agencyType', 'parentId']) {
      if (agencies[col]) await queryInterface.removeColumn('Agencies', col)
    }
  }
}
