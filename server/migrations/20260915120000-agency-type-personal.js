'use strict'

/**
 * Add a "personal" agency category.
 *
 * Sign-ups arrive from gmail.com, outlook.com, icloud.com and the like. There
 * was nowhere to file them, so they sat in needs_review indefinitely next to
 * genuine agencies waiting to be classified, and there was no way to select
 * them as a group.
 *
 * agencyType is a string with a check constraint rather than a native enum
 * precisely so a category could be added without an ALTER TYPE. This drops and
 * recreates that constraint with the new value. No rows change.
 */

const AGENCY_TYPES = [
  'federal_agency',
  'federal_component',
  'state_local',
  'education',
  'personal',
  'other',
  'needs_review'
]

const PREVIOUS_TYPES = AGENCY_TYPES.filter(t => t !== 'personal')

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(
      'ALTER TABLE "Agencies" DROP CONSTRAINT IF EXISTS agencies_agencytype_check'
    )
    await queryInterface.sequelize.query(
      `ALTER TABLE "Agencies" ADD CONSTRAINT agencies_agencytype_check
       CHECK ("agencyType" IN (${AGENCY_TYPES.map(t => `'${t}'`).join(',')}))`
    )
  },

  down: async (queryInterface) => {
    // Anything already filed as personal has to go somewhere the old constraint
    // accepts, or re-adding it fails. needs_review is where these rows sat
    // before the category existed.
    await queryInterface.sequelize.query(
      `UPDATE "Agencies" SET "agencyType" = 'needs_review' WHERE "agencyType" = 'personal'`
    )
    await queryInterface.sequelize.query(
      'ALTER TABLE "Agencies" DROP CONSTRAINT IF EXISTS agencies_agencytype_check'
    )
    await queryInterface.sequelize.query(
      `ALTER TABLE "Agencies" ADD CONSTRAINT agencies_agencytype_check
       CHECK ("agencyType" IN (${PREVIOUS_TYPES.map(t => `'${t}'`).join(',')}))`
    )
  }
}
