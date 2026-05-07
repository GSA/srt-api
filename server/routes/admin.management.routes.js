/** @module AdminManagementRoutes */
const User = require('../models').User
const logger = require('../config/winston')
const jwt = require('jsonwebtoken')

/**
 * Extract the admin email from the JWT for audit logging.
 */
function getAdminEmail(req) {
  try {
    const token = req.headers['authorization'].split(' ')[1]
    return jwt.decode(token).user.email
  } catch (e) {
    return 'unknown'
  }
}

module.exports = function (pgPool) {

  // ── Ensure audit_log table exists ──────────────────────────────────
  pgPool.query(`
    CREATE TABLE IF NOT EXISTS admin_audit_log (
      id SERIAL PRIMARY KEY,
      admin_email VARCHAR(255) NOT NULL,
      action VARCHAR(100) NOT NULL,
      target_type VARCHAR(50) NOT NULL,
      target_id VARCHAR(255),
      target_email VARCHAR(255),
      details JSONB,
      ip_address VARCHAR(50),
      created_at TIMESTAMP DEFAULT NOW()
    )
  `).catch(err => logger.log('warn', 'Could not create admin_audit_log table', { error: err.message }))

  // ── Ensure user_activity table exists ──────────────────────────────
  pgPool.query(`
    CREATE TABLE IF NOT EXISTS user_activity (
      id SERIAL PRIMARY KEY,
      user_email VARCHAR(255),
      session_id VARCHAR(100),
      event_type VARCHAR(50) NOT NULL,
      event_name VARCHAR(200),
      page_url VARCHAR(500),
      page_title VARCHAR(200),
      metadata JSONB,
      duration_ms INTEGER,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `).catch(err => logger.log('warn', 'Could not create user_activity table', { error: err.message }))

  // ── Helper: log an admin action ────────────────────────────────────
  async function auditLog(req, action, targetType, targetId, targetEmail, details) {
    const adminEmail = getAdminEmail(req)
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || ''
    try {
      await pgPool.query(
        `INSERT INTO admin_audit_log (admin_email, action, target_type, target_id, target_email, details, ip_address)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [adminEmail, action, targetType, String(targetId), targetEmail, JSON.stringify(details), ip]
      )
      logger.log('info', `AUDIT: ${adminEmail} performed ${action} on ${targetType} ${targetId}`, {
        tag: 'admin-audit', admin: adminEmail, action, targetType, targetId, targetEmail, details
      })
    } catch (err) {
      logger.log('error', 'Failed to write audit log', { error: err.message, tag: 'admin-audit' })
    }
  }

  return {

    // ═════════════════════════════════════════════════════════════════
    // USER MANAGEMENT ENDPOINTS
    // ═════════════════════════════════════════════════════════════════

    /**
     * GET /api/admin/users
     * List all users with optional filters.
     */
    listUsers: async function (req, res) {
      try {
        const { status, agency, search } = req.query
        let where = {}

        if (status === 'active') {
          where.isAccepted = true
          where.isRejected = false
        } else if (status === 'inactive') {
          where.isRejected = true
        } else if (status === 'pending') {
          where.isAccepted = false
          where.isRejected = false
        }

        if (agency) {
          where.agency = agency
        }

        let users = await User.findAll({ where, order: [['createdAt', 'DESC']] })

        // Apply search filter in JS (Sequelize ILIKE varies by dialect)
        if (search) {
          const s = search.toLowerCase()
          users = users.filter(u =>
            (u.firstName || '').toLowerCase().includes(s) ||
            (u.lastName || '').toLowerCase().includes(s) ||
            (u.email || '').toLowerCase().includes(s)
          )
        }

        // Mask sensitive fields
        const sanitized = users.map(u => {
          const json = u.toJSON()
          delete json.password
          delete json.tempPassword
          return json
        })

        logger.log('info', `Admin listed ${sanitized.length} users`, {
          tag: 'admin-users', admin: getAdminEmail(req), filters: { status, agency, search }
        })

        return res.status(200).json({ users: sanitized, totalCount: sanitized.length })
      } catch (err) {
        logger.log('error', 'Error listing users', { error: err.message, tag: 'admin-users' })
        return res.status(500).json({ error: 'Failed to list users' })
      }
    },

    /**
     * PUT /api/admin/users/:id
     * Update a user's agency, role, or active status.
     */
    updateUser: async function (req, res) {
      try {
        const userId = req.params.id
        const { agency, userRole, isAccepted, isRejected, rejectionNote } = req.body

        const user = await User.findOne({ where: { id: userId } })
        if (!user) {
          logger.log('warn', `Admin update: user ${userId} not found`, { tag: 'admin-users' })
          return res.status(404).json({ error: 'User not found' })
        }

        const changes = {}
        const before = { agency: user.agency, userRole: user.userRole, isAccepted: user.isAccepted, isRejected: user.isRejected }

        if (agency !== undefined) { user.agency = agency; changes.agency = agency }
        if (userRole !== undefined) { user.userRole = userRole; changes.userRole = userRole }
        if (isAccepted !== undefined) { user.isAccepted = isAccepted; changes.isAccepted = isAccepted }
        if (isRejected !== undefined) { user.isRejected = isRejected; changes.isRejected = isRejected }
        if (rejectionNote !== undefined) { user.rejectionNote = rejectionNote; changes.rejectionNote = rejectionNote }

        await user.save()

        await auditLog(req, 'user_update', 'user', userId, user.email, { before, after: changes })

        logger.log('info', `Admin updated user ${userId} (${user.email})`, {
          tag: 'admin-users', admin: getAdminEmail(req), userId, changes
        })

        const json = user.toJSON()
        delete json.password
        delete json.tempPassword
        return res.status(200).json(json)
      } catch (err) {
        logger.log('error', 'Error updating user', { error: err.message, tag: 'admin-users', userId: req.params.id })
        return res.status(500).json({ error: 'Failed to update user' })
      }
    },

    /**
     * PUT /api/admin/users/:id/toggle-status
     * Quick toggle: activate or deactivate a user.
     */
    toggleUserStatus: async function (req, res) {
      try {
        const userId = req.params.id
        const user = await User.findOne({ where: { id: userId } })
        if (!user) {
          return res.status(404).json({ error: 'User not found' })
        }

        const wasActive = user.isAccepted && !user.isRejected
        user.isAccepted = !wasActive
        user.isRejected = wasActive
        await user.save()

        const newStatus = wasActive ? 'deactivated' : 'activated'
        await auditLog(req, `user_${newStatus}`, 'user', userId, user.email, { newStatus })

        logger.log('info', `Admin ${newStatus} user ${userId} (${user.email})`, {
          tag: 'admin-users', admin: getAdminEmail(req), userId, newStatus
        })

        const json = user.toJSON()
        delete json.password
        delete json.tempPassword
        return res.status(200).json(json)
      } catch (err) {
        logger.log('error', 'Error toggling user status', { error: err.message, tag: 'admin-users' })
        return res.status(500).json({ error: 'Failed to toggle user status' })
      }
    },

    /**
     * PUT /api/admin/users/bulk-deactivate
     * Deactivate multiple users at once.
     */
    bulkDeactivate: async function (req, res) {
      try {
        const { userIds } = req.body
        if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
          return res.status(400).json({ error: 'userIds array required' })
        }

        const users = await User.findAll({ where: { id: userIds } })
        const results = []

        for (const user of users) {
          user.isAccepted = false
          user.isRejected = true
          await user.save()
          results.push({ id: user.id, email: user.email, status: 'deactivated' })
        }

        await auditLog(req, 'bulk_deactivate', 'users', userIds.join(','), null, { count: results.length, userIds })

        logger.log('info', `Admin bulk deactivated ${results.length} users`, {
          tag: 'admin-users', admin: getAdminEmail(req), count: results.length, userIds
        })

        return res.status(200).json({ updated: results })
      } catch (err) {
        logger.log('error', 'Error in bulk deactivate', { error: err.message, tag: 'admin-users' })
        return res.status(500).json({ error: 'Failed to bulk deactivate' })
      }
    },

    // ═════════════════════════════════════════════════════════════════
    // AUDIT LOG
    // ═════════════════════════════════════════════════════════════════

    /**
     * GET /api/admin/audit-log
     * Retrieve admin action audit trail.
     */
    getAuditLog: async function (req, res) {
      try {
        const limit = parseInt(req.query.limit) || 100
        const offset = parseInt(req.query.offset) || 0

        const result = await pgPool.query(
          `SELECT * FROM admin_audit_log ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
          [limit, offset]
        )
        const countResult = await pgPool.query(`SELECT COUNT(*) as total FROM admin_audit_log`)

        logger.log('info', 'Admin viewed audit log', { tag: 'admin-audit', admin: getAdminEmail(req) })

        return res.status(200).json({
          entries: result.rows,
          totalCount: parseInt(countResult.rows[0].total),
          limit,
          offset
        })
      } catch (err) {
        logger.log('error', 'Error fetching audit log', { error: err.message, tag: 'admin-audit' })
        return res.status(500).json({ error: 'Failed to fetch audit log' })
      }
    },

    // ═════════════════════════════════════════════════════════════════
    // WEBSITE ANALYTICS — TRACKING ENDPOINT
    // ═════════════════════════════════════════════════════════════════

    /**
     * POST /api/analytics/track
     * Record a user activity event (page view, click, upload, etc.)
     */
    trackEvent: async function (req, res) {
      try {
        const { eventType, eventName, pageUrl, pageTitle, metadata, durationMs, sessionId } = req.body
        const userEmail = getAdminEmail(req) // works for any authenticated user

        if (!eventType) {
          return res.status(400).json({ error: 'eventType required' })
        }

        await pgPool.query(
          `INSERT INTO user_activity (user_email, session_id, event_type, event_name, page_url, page_title, metadata, duration_ms)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [userEmail, sessionId || null, eventType, eventName || null, pageUrl || null, pageTitle || null,
           metadata ? JSON.stringify(metadata) : null, durationMs || null]
        )

        logger.log('debug', `Activity tracked: ${eventType} ${eventName || ''}`, {
          tag: 'user-activity', userEmail, eventType, eventName, pageUrl
        })

        return res.status(200).json({ status: 'ok' })
      } catch (err) {
        logger.log('error', 'Error tracking event', { error: err.message, tag: 'user-activity' })
        return res.status(500).json({ error: 'Failed to track event' })
      }
    },

    /**
     * POST /api/analytics/track-batch
     * Record multiple events at once (for buffered client-side tracking).
     */
    trackBatch: async function (req, res) {
      try {
        const { events } = req.body
        if (!events || !Array.isArray(events)) {
          return res.status(400).json({ error: 'events array required' })
        }

        const userEmail = getAdminEmail(req)
        let inserted = 0

        for (const evt of events) {
          await pgPool.query(
            `INSERT INTO user_activity (user_email, session_id, event_type, event_name, page_url, page_title, metadata, duration_ms)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [userEmail, evt.sessionId || null, evt.eventType, evt.eventName || null,
             evt.pageUrl || null, evt.pageTitle || null,
             evt.metadata ? JSON.stringify(evt.metadata) : null, evt.durationMs || null]
          )
          inserted++
        }

        logger.log('debug', `Batch tracked ${inserted} events`, { tag: 'user-activity', userEmail, count: inserted })
        return res.status(200).json({ status: 'ok', inserted })
      } catch (err) {
        logger.log('error', 'Error in batch track', { error: err.message, tag: 'user-activity' })
        return res.status(500).json({ error: 'Failed to batch track' })
      }
    },

    // ═════════════════════════════════════════════════════════════════
    // WEBSITE ANALYTICS — DASHBOARD QUERIES
    // ═════════════════════════════════════════════════════════════════

    /**
     * GET /api/admin/analytics/overview
     * High-level website usage stats.
     */
    getAnalyticsOverview: async function (req, res) {
      try {
        const days = parseInt(req.query.days) || 30

        // Traffic overview
        const traffic = await pgPool.query(`
          SELECT
            COUNT(*) as total_events,
            COUNT(DISTINCT user_email) as unique_users,
            COUNT(DISTINCT session_id) as total_sessions,
            COUNT(*) FILTER (WHERE event_type = 'page_view') as page_views,
            COUNT(*) FILTER (WHERE event_type = 'click') as total_clicks,
            COUNT(*) FILTER (WHERE event_type = 'upload') as total_uploads,
            AVG(duration_ms) FILTER (WHERE event_type = 'page_view' AND duration_ms > 0) as avg_time_on_page_ms
          FROM user_activity
          WHERE created_at >= NOW() - INTERVAL '1 day' * $1
        `, [days])

        // Daily breakdown
        const daily = await pgPool.query(`
          SELECT
            DATE(created_at) as date,
            COUNT(*) FILTER (WHERE event_type = 'page_view') as page_views,
            COUNT(DISTINCT user_email) as unique_users,
            COUNT(*) FILTER (WHERE event_type = 'click') as clicks,
            COUNT(*) FILTER (WHERE event_type = 'upload') as uploads
          FROM user_activity
          WHERE created_at >= NOW() - INTERVAL '1 day' * $1
          GROUP BY DATE(created_at)
          ORDER BY date DESC
        `, [days])

        // Top pages
        const topPages = await pgPool.query(`
          SELECT
            page_url,
            page_title,
            COUNT(*) as views,
            COUNT(DISTINCT user_email) as unique_visitors,
            AVG(duration_ms) FILTER (WHERE duration_ms > 0) as avg_duration_ms
          FROM user_activity
          WHERE event_type = 'page_view' AND created_at >= NOW() - INTERVAL '1 day' * $1
          GROUP BY page_url, page_title
          ORDER BY views DESC
          LIMIT 20
        `, [days])

        // Top clicks
        const topClicks = await pgPool.query(`
          SELECT
            event_name,
            page_url,
            COUNT(*) as click_count
          FROM user_activity
          WHERE event_type = 'click' AND created_at >= NOW() - INTERVAL '1 day' * $1
          GROUP BY event_name, page_url
          ORDER BY click_count DESC
          LIMIT 20
        `, [days])

        // Active users (daily/weekly/monthly)
        const activeUsers = await pgPool.query(`
          SELECT
            COUNT(DISTINCT user_email) FILTER (WHERE created_at >= NOW() - INTERVAL '1 day') as dau,
            COUNT(DISTINCT user_email) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') as wau,
            COUNT(DISTINCT user_email) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') as mau
          FROM user_activity
        `)

        // Manual upload stats (from adhoc_analysis_log)
        const uploads = await pgPool.query(`
          SELECT
            COUNT(*) as total_uploads,
            COUNT(DISTINCT file_name) as unique_files,
            SUM(CASE WHEN ml_prediction = 'compliant' THEN 1 ELSE 0 END) as compliant,
            SUM(CASE WHEN ml_prediction = 'non_compliant' THEN 1 ELSE 0 END) as non_compliant,
            MAX(created_at) as last_upload
          FROM adhoc_analysis_log
          WHERE created_at >= NOW() - INTERVAL '1 day' * $1
        `, [days])

        logger.log('info', 'Admin viewed analytics overview', {
          tag: 'admin-analytics', admin: getAdminEmail(req), days
        })

        return res.status(200).json({
          period_days: days,
          summary: traffic.rows[0],
          daily: daily.rows,
          top_pages: topPages.rows,
          top_clicks: topClicks.rows,
          active_users: activeUsers.rows[0],
          upload_stats: uploads.rows[0]
        })
      } catch (err) {
        logger.log('error', 'Error fetching analytics overview', { error: err.message, tag: 'admin-analytics' })
        return res.status(500).json({ error: 'Failed to fetch analytics' })
      }
    },

    /**
     * GET /api/admin/analytics/feature-usage
     * Track which features are being used.
     */
    getFeatureUsage: async function (req, res) {
      try {
        const days = parseInt(req.query.days) || 30

        const features = await pgPool.query(`
          SELECT
            event_name as feature,
            COUNT(*) as usage_count,
            COUNT(DISTINCT user_email) as unique_users,
            MAX(created_at) as last_used
          FROM user_activity
          WHERE event_type = 'feature' AND created_at >= NOW() - INTERVAL '1 day' * $1
          GROUP BY event_name
          ORDER BY usage_count DESC
        `, [days])

        // Session duration distribution
        const sessions = await pgPool.query(`
          SELECT
            session_id,
            user_email,
            MIN(created_at) as session_start,
            MAX(created_at) as session_end,
            EXTRACT(EPOCH FROM (MAX(created_at) - MIN(created_at))) as duration_seconds,
            COUNT(*) as event_count
          FROM user_activity
          WHERE session_id IS NOT NULL AND created_at >= NOW() - INTERVAL '1 day' * $1
          GROUP BY session_id, user_email
          HAVING COUNT(*) > 1
          ORDER BY session_start DESC
          LIMIT 100
        `, [days])

        logger.log('info', 'Admin viewed feature usage', { tag: 'admin-analytics', admin: getAdminEmail(req) })

        return res.status(200).json({
          features: features.rows,
          recent_sessions: sessions.rows
        })
      } catch (err) {
        logger.log('error', 'Error fetching feature usage', { error: err.message, tag: 'admin-analytics' })
        return res.status(500).json({ error: 'Failed to fetch feature usage' })
      }
    },

    // ═════════════════════════════════════════════════════════════════
    // SYSTEM HEALTH
    // ═════════════════════════════════════════════════════════════════

    /**
     * GET /api/admin/system-health
     * Quick system status check.
     */
    getSystemHealth: async function (req, res) {
      try {
        const checks = {}

        // Database connectivity
        try {
          const dbResult = await pgPool.query('SELECT NOW() as db_time')
          checks.database = { status: 'healthy', connected: true }
        } catch (e) {
          checks.database = { status: 'unhealthy', connected: false, error: e.message }
        }

        // User counts
        try {
          const activeUsers = await User.count({ where: { isAccepted: true, isRejected: false } })
          const totalUsers = await User.count()
          checks.users = { active: activeUsers, total: totalUsers }
        } catch (e) {
          checks.users = { error: e.message }
        }

        // Recent manual upload activity (adhoc_analysis_log)
        try {
          const recentAnalysis = await pgPool.query(`
            SELECT COUNT(*) as count, MAX(created_at) as last_run
            FROM adhoc_analysis_log
            WHERE created_at >= NOW() - INTERVAL '24 hours'
          `)
          checks.manual_upload = {
            analyses_last_24h: parseInt(recentAnalysis.rows[0].count),
            last_run: recentAnalysis.rows[0].last_run
          }
        } catch (e) {
          checks.manual_upload = { error: e.message }
        }

        // USAI API status
        try {
          const usaiKey = process.env.USAI_API
          checks.usai_api = {
            configured: !!usaiKey,
            base_url: process.env.USAI_BASE_URL || 'https://api.gsa.usai.gov/api/v1'
          }
        } catch (e) {
          checks.usai_api = { error: e.message }
        }

        // Uptime
        checks.uptime = {
          seconds: Math.floor(process.uptime()),
          node_version: process.version,
          memory_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
        }

        logger.log('info', 'Admin checked system health', { tag: 'admin-health', admin: getAdminEmail(req) })

        return res.status(200).json(checks)
      } catch (err) {
        logger.log('error', 'Error checking system health', { error: err.message, tag: 'admin-health' })
        return res.status(500).json({ error: 'Failed to check system health' })
      }
    },

    /**
     * GET /api/admin/scheduled-pipeline-stats
     * Daily breakdown of the scheduled SAM.gov pipeline:
     *  - solicitations scanned per day
     *  - total unique packages (solNums)
     *  - total documents & breakdown by file type (pdf, docx, txt, other)
     *  - unreadable documents (machine_readable = false)
     */
    getScheduledPipelineStats: async function (req, res) {
      try {
        const days = parseInt(req.query.days) || 30

        // ── Daily solicitation & document breakdown ──────────────────
        const dailyResult = await pgPool.query(`
          SELECT
            DATE(s."createdAt") AS scan_date,
            COUNT(DISTINCT s."solNum") AS unique_solicitations,
            COUNT(a.id) AS total_documents,
            COUNT(a.id) FILTER (WHERE LOWER(a.filename) LIKE '%.pdf') AS pdf_count,
            COUNT(a.id) FILTER (WHERE LOWER(a.filename) LIKE '%.docx' OR LOWER(a.filename) LIKE '%.doc') AS docx_count,
            COUNT(a.id) FILTER (WHERE LOWER(a.filename) LIKE '%.txt') AS txt_count,
            COUNT(a.id) FILTER (WHERE LOWER(a.filename) LIKE '%.xlsx' OR LOWER(a.filename) LIKE '%.xls' OR LOWER(a.filename) LIKE '%.csv') AS spreadsheet_count,
            COUNT(a.id) FILTER (WHERE LOWER(a.filename) LIKE '%.htm' OR LOWER(a.filename) LIKE '%.html') AS html_count,
            COUNT(a.id) FILTER (
              WHERE LOWER(a.filename) NOT LIKE '%.pdf'
                AND LOWER(a.filename) NOT LIKE '%.docx'
                AND LOWER(a.filename) NOT LIKE '%.doc'
                AND LOWER(a.filename) NOT LIKE '%.txt'
                AND LOWER(a.filename) NOT LIKE '%.xlsx'
                AND LOWER(a.filename) NOT LIKE '%.xls'
                AND LOWER(a.filename) NOT LIKE '%.csv'
                AND LOWER(a.filename) NOT LIKE '%.htm'
                AND LOWER(a.filename) NOT LIKE '%.html'
            ) AS other_count,
            COUNT(a.id) FILTER (WHERE a.machine_readable = false) AS unreadable_count,
            COUNT(a.id) FILTER (WHERE a.machine_readable = true) AS readable_count
          FROM solicitations s
          LEFT JOIN attachment a ON a.solicitation_id = s.id
          WHERE s."createdAt" >= NOW() - INTERVAL '1 day' * $1
          GROUP BY DATE(s."createdAt")
          ORDER BY scan_date DESC
        `, [days])

        // ── Totals across the period ─────────────────────────────────
        const totalsResult = await pgPool.query(`
          SELECT
            COUNT(DISTINCT s."solNum") AS total_solicitations,
            COUNT(a.id) AS total_documents,
            COUNT(a.id) FILTER (WHERE LOWER(a.filename) LIKE '%.pdf') AS pdf_count,
            COUNT(a.id) FILTER (WHERE LOWER(a.filename) LIKE '%.docx' OR LOWER(a.filename) LIKE '%.doc') AS docx_count,
            COUNT(a.id) FILTER (WHERE LOWER(a.filename) LIKE '%.txt') AS txt_count,
            COUNT(a.id) FILTER (WHERE LOWER(a.filename) LIKE '%.xlsx' OR LOWER(a.filename) LIKE '%.xls' OR LOWER(a.filename) LIKE '%.csv') AS spreadsheet_count,
            COUNT(a.id) FILTER (WHERE LOWER(a.filename) LIKE '%.htm' OR LOWER(a.filename) LIKE '%.html') AS html_count,
            COUNT(a.id) FILTER (
              WHERE LOWER(a.filename) NOT LIKE '%.pdf'
                AND LOWER(a.filename) NOT LIKE '%.docx'
                AND LOWER(a.filename) NOT LIKE '%.doc'
                AND LOWER(a.filename) NOT LIKE '%.txt'
                AND LOWER(a.filename) NOT LIKE '%.xlsx'
                AND LOWER(a.filename) NOT LIKE '%.xls'
                AND LOWER(a.filename) NOT LIKE '%.csv'
                AND LOWER(a.filename) NOT LIKE '%.htm'
                AND LOWER(a.filename) NOT LIKE '%.html'
            ) AS other_count,
            COUNT(a.id) FILTER (WHERE a.machine_readable = false) AS unreadable_count,
            COUNT(a.id) FILTER (WHERE a.machine_readable = true) AS readable_count
          FROM solicitations s
          LEFT JOIN attachment a ON a.solicitation_id = s.id
          WHERE s."createdAt" >= NOW() - INTERVAL '1 day' * $1
        `, [days])

        // ── Top unreadable file extensions ───────────────────────────
        const unreadableTypesResult = await pgPool.query(`
          SELECT
            COALESCE(
              LOWER(SUBSTRING(a.filename FROM '\.([^.]+)$')),
              'no extension'
            ) AS file_extension,
            COUNT(*) AS count
          FROM attachment a
          JOIN solicitations s ON s.id = a.solicitation_id
          WHERE a.machine_readable = false
            AND s."createdAt" >= NOW() - INTERVAL '1 day' * $1
          GROUP BY file_extension
          ORDER BY count DESC
          LIMIT 15
        `, [days])

        const totals = totalsResult.rows[0] || {}

        logger.log('info', 'Admin viewed scheduled pipeline stats', {
          tag: 'admin-health', admin: getAdminEmail(req), days
        })

        return res.status(200).json({
          period_days: days,
          totals: {
            solicitations: parseInt(totals.total_solicitations) || 0,
            documents: parseInt(totals.total_documents) || 0,
            by_type: {
              pdf: parseInt(totals.pdf_count) || 0,
              docx: parseInt(totals.docx_count) || 0,
              txt: parseInt(totals.txt_count) || 0,
              spreadsheet: parseInt(totals.spreadsheet_count) || 0,
              html: parseInt(totals.html_count) || 0,
              other: parseInt(totals.other_count) || 0
            },
            readable: parseInt(totals.readable_count) || 0,
            unreadable: parseInt(totals.unreadable_count) || 0
          },
          daily: dailyResult.rows.map(r => ({
            date: r.scan_date,
            solicitations: parseInt(r.unique_solicitations) || 0,
            documents: parseInt(r.total_documents) || 0,
            by_type: {
              pdf: parseInt(r.pdf_count) || 0,
              docx: parseInt(r.docx_count) || 0,
              txt: parseInt(r.txt_count) || 0,
              spreadsheet: parseInt(r.spreadsheet_count) || 0,
              html: parseInt(r.html_count) || 0,
              other: parseInt(r.other_count) || 0
            },
            readable: parseInt(r.readable_count) || 0,
            unreadable: parseInt(r.unreadable_count) || 0
          })),
          unreadable_types: unreadableTypesResult.rows.map(r => ({
            extension: r.file_extension,
            count: parseInt(r.count) || 0
          }))
        })
      } catch (err) {
        logger.log('error', 'Error fetching scheduled pipeline stats', { error: err.message, tag: 'admin-health' })
        return res.status(500).json({ error: 'Failed to fetch scheduled pipeline stats' })
      }
    },

    /**
     * GET /api/admin/system-logs
     * Retrieve recent application logs from winston_logs table.
     */
    getSystemLogs: async function (req, res) {
      try {
        const limit = parseInt(req.query.limit) || 100
        const level = req.query.level || ''
        const search = req.query.search || ''

        let query = `SELECT "timestamp", level, message FROM winston_logs`
        const conditions = []
        const params = []
        let paramIdx = 1

        if (level) {
          conditions.push(`level = $${paramIdx++}`)
          params.push(level)
        }
        if (search) {
          conditions.push(`message ILIKE $${paramIdx++}`)
          params.push(`%${search}%`)
        }

        if (conditions.length > 0) {
          query += ' WHERE ' + conditions.join(' AND ')
        }
        query += ` ORDER BY "timestamp" DESC NULLS LAST LIMIT $${paramIdx}`
        params.push(limit)

        const result = await pgPool.query(query, params)

        logger.log('info', 'Admin viewed system logs', { tag: 'admin-health', admin: getAdminEmail(req), filters: { level, search } })

        return res.status(200).json({ logs: result.rows })
      } catch (err) {
        logger.log('error', 'Error fetching system logs', { error: err.message, tag: 'admin-health' })
        return res.status(500).json({ error: 'Failed to fetch logs', logs: [] })
      }
    },

    // ═════════════════════════════════════════════════════════════════
    // AGENCY MANAGEMENT
    // ═════════════════════════════════════════════════════════════════

    /**
     * GET /api/admin/agencies
     * List all agencies with user counts.
     */
    listAgencies: async function (req, res) {
      try {
        const result = await pgPool.query(`
          SELECT
            a.id, a.agency, a.acronym,
            COUNT(u.id) FILTER (WHERE u."isAccepted" = true AND u."isRejected" = false) as active_users,
            COUNT(u.id) as total_users
          FROM "Agencies" a
          LEFT JOIN "Users" u ON u.agency = a.agency
          GROUP BY a.id, a.agency, a.acronym
          ORDER BY a.agency
        `)

        logger.log('info', 'Admin listed agencies', { tag: 'admin-agencies', admin: getAdminEmail(req) })
        return res.status(200).json({ agencies: result.rows })
      } catch (err) {
        logger.log('error', 'Error listing agencies', { error: err.message, tag: 'admin-agencies' })
        return res.status(500).json({ error: 'Failed to list agencies' })
      }
    }
  }
}
