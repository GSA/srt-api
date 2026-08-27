/** @module FeedbackRoutes */
const logger = require('../config/winston')
const jwt = require('jsonwebtoken')

function getUserEmail(req) {
  try {
    const token = req.headers['authorization'].split(' ')[1]
    return jwt.decode(token).user.email
  } catch (e) {
    return null
  }
}

module.exports = function (pgPool) {

  // Ensure feedback table exists
  pgPool.query(`
    CREATE TABLE IF NOT EXISTS user_feedback (
      id SERIAL PRIMARY KEY,
      user_email VARCHAR(255) NOT NULL,
      source VARCHAR(50) NOT NULL,
      solicitation_number VARCHAR(100),
      feedback_text TEXT NOT NULL,
      ai_summary TEXT,
      ai_interpretation TEXT,
      ai_suggestion TEXT,
      status VARCHAR(20) DEFAULT 'new',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `).catch(err => logger.log('warn', 'Could not create user_feedback table', { error: err.message }))

  return {

    /**
     * POST /api/feedback
     * Submit feedback from manual upload, solicitation detail, or contact us.
     * Rate limited: max 3 per user per day.
     */
    submitFeedback: async function (req, res) {
      try {
        const userEmail = getUserEmail(req)
        if (!userEmail) {
          return res.status(401).json({ error: 'Authentication required' })
        }

        const { source, feedback_text, solicitation_number } = req.body

        if (!feedback_text || feedback_text.trim().length < 5) {
          return res.status(400).json({ error: 'Feedback text is required (minimum 5 characters)' })
        }

        if (!source || !['manual_upload', 'solicitation_detail', 'contact_us'].includes(source)) {
          return res.status(400).json({ error: 'Valid source required (manual_upload, solicitation_detail, contact_us)' })
        }

        // Rate limit: max 3 per user per day
        const rateCheck = await pgPool.query(
          `SELECT COUNT(*) as count FROM user_feedback 
           WHERE user_email = $1 AND created_at > NOW() - INTERVAL '24 hours'`,
          [userEmail]
        )

        if (parseInt(rateCheck.rows[0].count) >= 3) {
          return res.status(429).json({ error: 'Daily feedback limit reached (3 per day). Please try again tomorrow.' })
        }

        // Save feedback
        const insertResult = await pgPool.query(
          `INSERT INTO user_feedback (user_email, source, solicitation_number, feedback_text)
           VALUES ($1, $2, $3, $4) RETURNING id`,
          [userEmail, source, solicitation_number || null, feedback_text.trim()]
        )

        const feedbackId = insertResult.rows[0].id

        logger.log('info', `Feedback submitted by ${userEmail}`, {
          tag: 'feedback', source, feedbackId, solNum: solicitation_number
        })

        // Generate AI summary in background (don't block response)
        generateAiSummary(pgPool, feedbackId, feedback_text, source, solicitation_number)

        // If contact_us, also send email to srt@gsa.gov
        if (source === 'contact_us') {
          try {
            const emailRoutes = require('./email.routes')
            await emailRoutes.sendMessage({
              to: 'srt@gsa.gov',
              subject: `SRT Contact Us — Feedback from ${userEmail}`,
              html: `<p><strong>From:</strong> ${userEmail}</p>
                     <p><strong>Source:</strong> Contact Us</p>
                     ${solicitation_number ? `<p><strong>Solicitation:</strong> ${solicitation_number}</p>` : ''}
                     <hr/>
                     <p>${feedback_text.replace(/\n/g, '<br>')}</p>`
            })
          } catch (emailErr) {
            logger.log('warn', 'Failed to send contact us email', { error: emailErr.message, tag: 'feedback' })
          }
        }

        return res.status(201).json({ 
          success: true, 
          message: 'Feedback submitted. Thank you!',
          id: feedbackId
        })
      } catch (err) {
        logger.log('error', 'Error submitting feedback', { error: err.message, tag: 'feedback' })
        return res.status(500).json({ error: 'Failed to submit feedback' })
      }
    },

    /**
     * GET /api/admin/feedback
     * List all feedback for admin panel.
     */
    listFeedback: async function (req, res) {
      try {
        const limit = parseInt(req.query.limit) || 50
        const offset = parseInt(req.query.offset) || 0
        const source = req.query.source || ''

        let query = `SELECT * FROM user_feedback`
        const params = []
        let paramIdx = 1

        if (source) {
          query += ` WHERE source = $${paramIdx++}`
          params.push(source)
        }

        query += ` ORDER BY created_at DESC LIMIT $${paramIdx++} OFFSET $${paramIdx++}`
        params.push(limit, offset)

        const result = await pgPool.query(query, params)
        const countResult = await pgPool.query(
          `SELECT COUNT(*) as total FROM user_feedback${source ? ' WHERE source = $1' : ''}`,
          source ? [source] : []
        )

        return res.json({
          feedback: result.rows,
          totalCount: parseInt(countResult.rows[0].total),
          limit,
          offset
        })
      } catch (err) {
        logger.log('error', 'Error listing feedback', { error: err.message, tag: 'feedback' })
        return res.status(500).json({ error: 'Failed to list feedback' })
      }
    },

    /**
     * PUT /api/admin/feedback/:id/status
     * Update feedback status (new, reviewed, resolved, dismissed).
     */
    updateFeedbackStatus: async function (req, res) {
      try {
        const { id } = req.params
        const { status } = req.body
        const validStatuses = ['new', 'reviewed', 'resolved', 'dismissed']

        if (!validStatuses.includes(status)) {
          return res.status(400).json({ error: `Status must be one of: ${validStatuses.join(', ')}` })
        }

        await pgPool.query(`UPDATE user_feedback SET status = $1 WHERE id = $2`, [status, id])

        return res.json({ success: true })
      } catch (err) {
        logger.log('error', 'Error updating feedback status', { error: err.message, tag: 'feedback' })
        return res.status(500).json({ error: 'Failed to update status' })
      }
    }
  }
}

/**
 * Generate AI summary of feedback (runs async, updates DB when done).
 */
async function generateAiSummary(pgPool, feedbackId, feedbackText, source, solNum) {
  try {
    const usaiAdapter = require('../shared/rag_services/usai_adapter')

    const systemPrompt = `You are analyzing user feedback for the Solicitation Review Tool (SRT), a federal government application that checks solicitations for Section 508 accessibility requirements.

Given the user's feedback, provide:
1. A brief summary of the main issue (1-2 sentences)
2. Your interpretation of what the user is experiencing or requesting
3. A suggestion for what the development team could do to address it

Return ONLY valid JSON:
{
  "summary": "brief summary of the issue",
  "interpretation": "what the user likely means or is experiencing",
  "suggestion": "what we could do about it"
}`

    const userPrompt = `User feedback (source: ${source}${solNum ? ', solicitation: ' + solNum : ''}):\n\n"${feedbackText}"`

    const raw = await usaiAdapter.chatCompletion(systemPrompt, userPrompt, usaiAdapter.defaultCheapModel)
    const parsed = usaiAdapter.parseJsonResponse(raw)

    if (parsed && parsed.summary) {
      await pgPool.query(
        `UPDATE user_feedback SET ai_summary = $1, ai_interpretation = $2, ai_suggestion = $3 WHERE id = $4`,
        [parsed.summary, parsed.interpretation, parsed.suggestion, feedbackId]
      )
      logger.log('info', `AI summary generated for feedback #${feedbackId}`, { tag: 'feedback' })
    }
  } catch (err) {
    logger.log('warn', `Failed to generate AI summary for feedback #${feedbackId}`, { error: err.message, tag: 'feedback' })
  }
}
