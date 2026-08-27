'use strict';

/**
 * Adds a unique constraint on Surveys.surveyTitle.
 *
 * GUARDED: production's Surveys table has no `surveyTitle` column — its schema
 * diverged from the codebase years before this migration was written — so an
 * unconditional addConstraint() throws there ("column surveyTitle named in key
 * does not exist"). Because sequelize halts the entire run at the first failure,
 * that single error silently blocked every later migration from being applied.
 *
 * The constraint is meaningless without the column, so skip instead of failing.
 * Also skips when the constraint already exists, making this safe to re-run in
 * any environment.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up (queryInterface, Sequelize) {
    const [cols] = await queryInterface.sequelize.query(
      `SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Surveys' AND column_name = 'surveyTitle' LIMIT 1`);
    if (!cols.length) {
      console.log('[migration] Surveys.surveyTitle not present — skipping unique constraint.');
      return;
    }

    const [existing] = await queryInterface.sequelize.query(
      `SELECT 1 FROM pg_constraint WHERE conname = 'unique_survey_title' LIMIT 1`);
    if (existing.length) {
      console.log('[migration] unique_survey_title already exists — nothing to do.');
      return;
    }

    await queryInterface.addConstraint('Surveys', {
      fields: ['surveyTitle'],
      type: 'unique',
      name: 'unique_survey_title'
    });
  },

  async down (queryInterface, Sequelize) {
    const [existing] = await queryInterface.sequelize.query(
      `SELECT 1 FROM pg_constraint WHERE conname = 'unique_survey_title' LIMIT 1`);
    if (!existing.length) { return; }
    await queryInterface.removeConstraint('Surveys', 'unique_survey_title');
  }
};
