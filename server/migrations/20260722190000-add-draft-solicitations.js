'use strict'

/**
 * Draft solicitations: per-user, auto-saved manual-upload analyses with
 * append-only version history (results only — the uploaded files themselves
 * are NOT stored). content_hash (sha256 of the uploaded bytes / pasted text)
 * powers the per-user result cache: re-running an identical document on the
 * same pipeline version returns the stored result instantly.
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('draft_solicitations', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      user_email: { type: Sequelize.STRING, allowNull: false },
      title: { type: Sequelize.STRING, allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') }
    })
    await queryInterface.addIndex('draft_solicitations', ['user_email'])
    await queryInterface.addConstraint('draft_solicitations', {
      fields: ['user_email', 'title'],
      type: 'unique',
      name: 'draft_solicitations_user_title_unique'
    })

    await queryInterface.createTable('draft_versions', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      draft_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'draft_solicitations', key: 'id' },
        onDelete: 'CASCADE'
      },
      version_number: { type: Sequelize.INTEGER, allowNull: false },
      file_name: { type: Sequelize.STRING },
      content_hash: { type: Sequelize.STRING(64), allowNull: false },
      source: { type: Sequelize.STRING(10), allowNull: false, defaultValue: 'file' },
      pipeline_version: { type: Sequelize.STRING(20), allowNull: false },
      verdict: { type: Sequelize.STRING(40) },
      result: { type: Sequelize.JSONB, allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') }
    })
    await queryInterface.addIndex('draft_versions', ['draft_id'])
    // Cache lookup path: user's identical content on the same pipeline version.
    await queryInterface.addIndex('draft_versions', ['content_hash', 'pipeline_version'])
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('draft_versions')
    await queryInterface.dropTable('draft_solicitations')
  }
}
