'use strict';

/**
 * Adds Users.reviewStatus — an admin-set review state that overrides the status
 * derived from isAccepted/isRejected.
 *
 * WHY: status was only Active / Pending / Inactive (two booleans). Admins had no
 * way to record that a pending request had already been handled (e.g. emailed
 * the applicant, awaiting reply), so the same requests kept resurfacing as fresh
 * "pending" and got emailed twice. reviewStatus captures the richer states:
 * Awaiting Reply, On Hold, Declined (Personal Email), Declined (Generic Mailbox).
 *
 * Nullable and additive: when null, status derivation is exactly as before, so
 * every existing row keeps its current behavior.
 *
 * GUARDED to be safe to re-run and to no-op if the column already exists — the
 * prod migration history has drifted before, and this must not wedge the run.
 */
module.exports = {
  async up (queryInterface, Sequelize) {
    const [cols] = await queryInterface.sequelize.query(
      `SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Users' AND column_name = 'reviewStatus' LIMIT 1`);
    if (cols.length) {
      console.log('[migration] Users.reviewStatus already exists — skipping.');
      return;
    }
    await queryInterface.addColumn('Users', 'reviewStatus', {
      type: Sequelize.STRING,
      allowNull: true
    });
  },

  async down (queryInterface) {
    const [cols] = await queryInterface.sequelize.query(
      `SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Users' AND column_name = 'reviewStatus' LIMIT 1`);
    if (!cols.length) { return; }
    await queryInterface.removeColumn('Users', 'reviewStatus');
  }
};
