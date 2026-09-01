'use strict'

/**
 * Seeds the new hierarchy from the config maps that previously drove agency
 * resolution, so the database starts from the institutional knowledge already
 * encoded in SRT rather than from nothing.
 *
 * Sources:
 *   AGENCY_LOOKUP               165 entries, alias/abbreviation -> agency name
 *   UNIQUE_EMAIL_AGENCY_MAPPING   7 entries, full domain -> agency name
 *
 * Existing Agencies rows are matched by name and updated in place, never
 * duplicated. Agencies referenced by the config but absent from the table are
 * created. Everything seeded is marked provenance='config_seed' so an
 * administrator can tell it apart from spreadsheet imports and hand edits.
 *
 * Deliberately does NOT infer parent relationships. The config has no reliable
 * parent data, and guessing would produce a hierarchy that looks authoritative
 * but is not. Parents come from the spreadsheet reconciliation in Phase 5, or
 * from Laura through admin.
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const config = require('../config/config.js')
    const common = config.common || {}
    const lookup = common.AGENCY_LOOKUP || {}
    const domainMap = common.UNIQUE_EMAIL_AGENCY_MAPPING || {}
    const now = new Date()

    // distinct canonical agency names referenced by either config map
    const names = new Set()
    Object.values(lookup).forEach(v => { if (v && typeof v === 'string') names.add(v.trim()) })
    Object.values(domainMap).forEach(v => { if (v && typeof v === 'string') names.add(v.trim()) })

    const [existing] = await queryInterface.sequelize.query('SELECT id, agency FROM "Agencies"')
    const byName = new Map(existing.map(r => [String(r.agency).trim().toLowerCase(), r.id]))

    // --- agencies ---------------------------------------------------------
    let created = 0
    for (const name of names) {
      if (!name) continue
      if (byName.has(name.toLowerCase())) continue
      const [rows] = await queryInterface.sequelize.query(
        `INSERT INTO "Agencies" (agency, "agencyType", active, provenance, "createdAt", "updatedAt")
         VALUES (:name, 'needs_review', true, 'config_seed', :now, :now) RETURNING id`,
        { replacements: { name, now } }
      )
      byName.set(name.toLowerCase(), rows[0].id)
      created++
    }

    // Rows that were already in the table are marked 'pre_existing', not
    // 'config_seed'. Provenance exists so an administrator can tell where a
    // record came from; labelling 629 pre-existing agencies as seeded would
    // defeat that. Their agencyType is defaulted but not overwritten.
    await queryInterface.sequelize.query(
      `UPDATE "Agencies" SET provenance = 'pre_existing',
                             "agencyType" = COALESCE(NULLIF("agencyType", ''), 'needs_review')
       WHERE provenance IS NULL`
    )

    // --- domains ----------------------------------------------------------
    let domainsAdded = 0
    for (const [rawDomain, agencyName] of Object.entries(domainMap)) {
      const domain = String(rawDomain).trim().toLowerCase().replace(/^@/, '')
      const agencyId = byName.get(String(agencyName).trim().toLowerCase())
      if (!domain || !agencyId) continue
      const [dup] = await queryInterface.sequelize.query(
        'SELECT id FROM agency_domains WHERE domain = :domain', { replacements: { domain } }
      )
      if (dup.length) continue
      await queryInterface.sequelize.query(
        `INSERT INTO agency_domains (domain, "agencyId", active, source, "originalRawValue", "createdAt", "updatedAt")
         VALUES (:domain, :agencyId, true, 'config_seed', :raw, :now, :now)`,
        { replacements: { domain, agencyId, raw: rawDomain, now } }
      )
      domainsAdded++
    }

    // --- default access scope --------------------------------------------
    // Each agency sees its own solicitations, which reproduces today's exact
    // match behaviour. Broader scopes are configured in admin, not guessed.
    await queryInterface.sequelize.query(
      `INSERT INTO agency_solicitation_scope ("agencyId", "visibleAgencyId", "createdAt", "updatedAt")
       SELECT a.id, a.id, :now, :now FROM "Agencies" a
       WHERE NOT EXISTS (
         SELECT 1 FROM agency_solicitation_scope s
         WHERE s."agencyId" = a.id AND s."visibleAgencyId" = a.id
       )`,
      { replacements: { now } }
    )

    // --- link existing users ---------------------------------------------
    // Only where the user's agency string matches an agency name exactly.
    // Anything ambiguous is left for admin rather than guessed.
    await queryInterface.sequelize.query(
      `UPDATE "Users" u SET "agencyId" = a.id
       FROM "Agencies" a
       WHERE u."agencyId" IS NULL
         AND u.agency IS NOT NULL
         AND LOWER(TRIM(u.agency)) = LOWER(TRIM(a.agency))`
    )

    console.log(`  seed: ${created} agencies created, ${domainsAdded} domains mapped`)
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query(`UPDATE "Users" SET "agencyId" = NULL`)
    await queryInterface.sequelize.query(`DELETE FROM agency_solicitation_scope`)
    await queryInterface.sequelize.query(`DELETE FROM agency_domains WHERE source = 'config_seed'`)
    await queryInterface.sequelize.query(`DELETE FROM "Agencies" WHERE provenance = 'config_seed'`)
  }
}
