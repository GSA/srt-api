'use strict';

/**
 * Persist admin email templates.
 *
 * The three templates SRT ships with were hardcoded in the Angular component,
 * so an administrator could edit one for a single send but could not save a
 * change or add a new template without a developer and a deploy. This moves
 * them into the database.
 *
 * Guarded and idempotent, like the other migrations in this series, because
 * umzug runs on every boot and the same migration may be replayed against a
 * database that already has the table.
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables()
    const names = tables.map(t => (typeof t === 'string' ? t : t.tableName))

    if (!names.includes('email_templates')) {
      await queryInterface.createTable('email_templates', {
        id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
        // Stable string key so existing audit rows referencing templateId keep meaning.
        templateKey: { type: Sequelize.STRING, allowNull: false, unique: true },
        name: { type: Sequelize.STRING, allowNull: false },
        subject: { type: Sequelize.STRING, allowNull: false },
        body: { type: Sequelize.TEXT, allowNull: false },
        description: { type: Sequelize.STRING },
        // Built-ins may be edited but not deleted, so a reset is always possible.
        isBuiltIn: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        updatedBy: { type: Sequelize.STRING },
        createdAt: { allowNull: false, type: Sequelize.DATE, defaultValue: Sequelize.fn('NOW') },
        updatedAt: { type: Sequelize.DATE, defaultValue: Sequelize.fn('NOW') }
      })
      await queryInterface.addIndex('email_templates', ['templateKey'])
    }

    // Seed the three templates that were previously hardcoded in the UI, so
    // nothing an administrator relies on disappears when the UI switches to
    // reading from the database.
    const seeds = [
      {
        templateKey: 'inactivity_warning',
        name: 'Inactivity Warning',
        subject: 'SRT Account Inactivity Notice',
        description: 'Sent to users who have not logged in within the configured inactivity period.',
        body: '<p>Hello,</p>\n<p>Your SRT account has been inactive for {{days_inactive}} days. Per GSA policy, accounts that remain inactive for more than 90 days will be deactivated.</p>\n<p>Please log in to SRT within the next 30 days to keep your account active:</p>\n<p><a href="https://srt.app.cloud.gov">Log in to SRT</a></p>\n<p>If your account is deactivated, you will need to request access again through the normal process.</p>\n<p>Thank you,<br>SRT Team</p>'
      },
      {
        templateKey: 'deactivation_notice',
        name: 'Account Deactivated',
        subject: 'SRT Account Deactivated',
        description: 'Sent when a user account is deactivated due to prolonged inactivity.',
        body: '<p>Hello,</p>\n<p>Your SRT account has been deactivated due to inactivity (no login for over 90 days).</p>\n<p>If you need access to SRT again, please contact your Section 508 coordinator or submit a new access request.</p>\n<p>Thank you,<br>SRT Team</p>'
      },
      {
        templateKey: 'update_announcement',
        name: 'Platform Update',
        subject: 'SRT Platform Update',
        description: 'Sent to announce new features or changes to the platform.',
        body: '<p>Hello,</p>\n<p>We have released updates to the Solicitation Review Tool. Here is what is new:</p>\n{{update_notes}}\n<p>Log in to check it out: <a href="https://srt.app.cloud.gov">SRT</a></p>\n<p>Thank you,<br>SRT Team</p>'
      }
    ]

    for (const s of seeds) {
      const [existing] = await queryInterface.sequelize.query(
        'SELECT id FROM email_templates WHERE "templateKey" = :k',
        { replacements: { k: s.templateKey } }
      )
      if (existing.length) continue          // never overwrite an edited template
      await queryInterface.sequelize.query(
        `INSERT INTO email_templates
           ("templateKey", name, subject, body, description, "isBuiltIn", active, "createdAt", "updatedAt")
         VALUES (:templateKey, :name, :subject, :body, :description, true, true, NOW(), NOW())`,
        { replacements: s }
      )
    }
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('email_templates')
  }
};
