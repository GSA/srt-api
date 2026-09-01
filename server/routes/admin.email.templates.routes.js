/** @module AdminEmailTemplateRoutes */

/**
 * CRUD for the admin email templates.
 *
 * These lived as a hardcoded array in the Angular component, which meant an
 * administrator could edit one for a single send but could not save the change
 * or add a template of their own. Everything here is admin only: templates are
 * sent to real users.
 */

const EmailTemplate = require('../models').EmailTemplate
const logger = require('../config/winston')
const jwt = require('jsonwebtoken')

function getAdminEmail (req) {
  try {
    return jwt.decode(req.headers['authorization'].split(' ')[1]).user.email
  } catch (e) {
    return 'unknown'
  }
}

module.exports = function (pgPool) {

  async function auditLog (req, action, targetId, details) {
    try {
      await pgPool.query(
        `INSERT INTO admin_audit_log (admin_email, action, target_type, target_id, details, ip_address)
         VALUES ($1, $2, 'email_template', $3, $4, $5)`,
        [getAdminEmail(req), action, String(targetId), JSON.stringify(details || {}), req.ip]
      )
    } catch (err) {
      logger.log('error', 'Failed to write email template audit log', {
        error: err.message, tag: 'admin-email-templates'
      })
    }
  }

  return {

    /** GET /api/admin/email-templates */
    list: async function (req, res) {
      try {
        const rows = await EmailTemplate.findAll({ order: [['name', 'ASC']] })
        return res.status(200).json({ templates: rows })
      } catch (err) {
        logger.log('error', 'Failed to list email templates', {
          error: err.message, tag: 'admin-email-templates'
        })
        return res.status(500).json({ error: 'Failed to load email templates' })
      }
    },

    /** POST /api/admin/email-templates */
    create: async function (req, res) {
      try {
        const { name, subject, body, description } = req.body
        if (!name || !String(name).trim()) return res.status(400).json({ error: 'A name is required' })
        if (!subject || !String(subject).trim()) return res.status(400).json({ error: 'A subject is required' })
        if (!body || !String(body).trim()) return res.status(400).json({ error: 'A body is required' })

        const templateKey = EmailTemplate.keyFrom(name)
        if (!templateKey) return res.status(400).json({ error: 'That name cannot be turned into an identifier' })

        const clash = await EmailTemplate.findOne({ where: { templateKey } })
        if (clash) {
          return res.status(409).json({
            error: 'A template with a matching name already exists', existingId: clash.id
          })
        }

        const created = await EmailTemplate.create({
          templateKey,
          name: String(name).trim(),
          subject: String(subject).trim(),
          body,
          description: description ? String(description).trim() : null,
          isBuiltIn: false,
          active: true,
          updatedBy: getAdminEmail(req)
        })

        await auditLog(req, 'email_template_create', created.templateKey, { name: created.name })
        return res.status(201).json({ template: created })
      } catch (err) {
        logger.log('error', 'Failed to create email template', {
          error: err.message, tag: 'admin-email-templates'
        })
        return res.status(500).json({ error: 'Failed to create the template' })
      }
    },

    /** PUT /api/admin/email-templates/:id */
    update: async function (req, res) {
      try {
        const t = await EmailTemplate.findByPk(req.params.id)
        if (!t) return res.status(404).json({ error: 'Template not found' })

        const before = { name: t.name, subject: t.subject, description: t.description, active: t.active }
        const { name, subject, body, description, active } = req.body

        // templateKey is deliberately immutable. Audit rows reference it, and a
        // rename would orphan the history of what was sent.
        if (name !== undefined) t.name = String(name).trim()
        if (subject !== undefined) t.subject = String(subject).trim()
        if (body !== undefined) t.body = body
        if (description !== undefined) t.description = description ? String(description).trim() : null
        if (active !== undefined) t.active = active
        t.updatedBy = getAdminEmail(req)

        await t.save()
        await auditLog(req, 'email_template_update', t.templateKey, { before, after: req.body })
        return res.status(200).json({ template: t })
      } catch (err) {
        logger.log('error', 'Failed to update email template', {
          error: err.message, tag: 'admin-email-templates'
        })
        return res.status(500).json({ error: 'Failed to update the template' })
      }
    },

    /**
     * DELETE /api/admin/email-templates/:id
     *
     * A built-in is deactivated rather than removed, so the set SRT ships with
     * can always be restored without a deploy.
     */
    remove: async function (req, res) {
      try {
        const t = await EmailTemplate.findByPk(req.params.id)
        if (!t) return res.status(404).json({ error: 'Template not found' })

        if (t.isBuiltIn) {
          t.active = false
          t.updatedBy = getAdminEmail(req)
          await t.save()
          await auditLog(req, 'email_template_deactivate', t.templateKey, { name: t.name })
          return res.status(200).json({
            deactivated: true,
            message: 'Built-in templates are deactivated rather than deleted, so they can be restored.'
          })
        }

        const key = t.templateKey
        await t.destroy()
        await auditLog(req, 'email_template_delete', key, { name: t.name })
        return res.status(200).json({ deleted: true })
      } catch (err) {
        logger.log('error', 'Failed to delete email template', {
          error: err.message, tag: 'admin-email-templates'
        })
        return res.status(500).json({ error: 'Failed to delete the template' })
      }
    }
  }
}
