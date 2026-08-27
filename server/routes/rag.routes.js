/** @module RagRoutes */
const logger = require('../config/winston')

/**
 * RAG Analysis API Routes
 * Uses pgPool for raw SQL queries against the rag-* tables (hyphenated names require quoting).
 */
module.exports = function (pgPool) {
    return {

        /**
         * GET /api/rag/solicitations
         * List all RAG-analyzed solicitations for the daily report
         */
        listSolicitations: async function (req, res) {
            try {
                const result = await pgPool.query(`
          SELECT
            id,
            solicitation_number,
            title,
            agency,
            ai_applicable,
            ai_compliant,
            ai_overall_risk_level,
            total_files,
            total_matches,
            average_quality_score,
            last_analyzed_at,
            created_at
          FROM "rag-solicitations"
          ORDER BY created_at DESC
        `)
                return res.json({
                    solicitations: result.rows,
                    totalCount: result.rows.length
                })
            } catch (err) {
                logger.log('error', 'Error fetching RAG solicitations list', { error: err.message, tag: 'rag' })
                return res.status(500).json({ error: 'Failed to fetch RAG solicitations' })
            }
        },

        /**
         * GET /api/rag/solicitation/:solNum
         * Full RAG analysis detail for a single solicitation
         */
        getSolicitation: async function (req, res) {
            try {
                const { solNum } = req.params
                const result = await pgPool.query(
                    `SELECT * FROM "rag-solicitations" WHERE solicitation_number = $1`,
                    [solNum]
                )

                if (result.rows.length === 0) {
                    return res.status(404).json({ error: 'RAG solicitation not found' })
                }

                const sol = result.rows[0]
                return res.json(sol)
            } catch (err) {
                logger.log('error', 'Error fetching RAG solicitation detail', { error: err.message, tag: 'rag', solNum: req.params.solNum })
                return res.status(500).json({ error: 'Failed to fetch RAG solicitation' })
            }
        },

        /**
         * GET /api/rag/solicitation/:solNum/documents
         * Documents with their ICT types and quality metrics
         */
        getDocuments: async function (req, res) {
            try {
                const { solNum } = req.params

                // Get the solicitation ID first
                const solResult = await pgPool.query(
                    `SELECT id FROM "rag-solicitations" WHERE solicitation_number = $1`,
                    [solNum]
                )

                if (solResult.rows.length === 0) {
                    return res.status(404).json({ error: 'RAG solicitation not found' })
                }

                const solId = solResult.rows[0].id

                // Get documents
                const docsResult = await pgPool.query(
                    `SELECT DISTINCT ON (file_name) * FROM "rag-documents" WHERE solicitation_id = $1 ORDER BY file_name, created_at DESC`,
                    [solId]
                )

                // Get ICT types for all documents
                const ictResult = await pgPool.query(
                    `SELECT dit.*
           FROM "rag-document-ict-types" dit
           INNER JOIN "rag-documents" d ON dit.document_id = d.id
           WHERE d.solicitation_id = $1
           ORDER BY dit.document_id, dit.ict_type`,
                    [solId]
                )

                // Get quality metrics for all documents
                const qualityResult = await pgPool.query(
                    `SELECT dqm.*
           FROM "rag-document-quality-metrics" dqm
           INNER JOIN "rag-documents" d ON dqm.document_id = d.id
           WHERE d.solicitation_id = $1`,
                    [solId]
                )

                // Group ICT types and quality metrics by document_id
                const ictByDoc = {}
                for (const row of ictResult.rows) {
                    if (!ictByDoc[row.document_id]) ictByDoc[row.document_id] = []
                    ictByDoc[row.document_id].push(row)
                }

                const qualityByDoc = {}
                for (const row of qualityResult.rows) {
                    qualityByDoc[row.document_id] = row
                }

                // Combine into one response
                const documents = docsResult.rows.map(doc => ({
                    ...doc,
                    ict_types: ictByDoc[doc.id] || [],
                    quality_metrics: qualityByDoc[doc.id] || null
                }))

                return res.json({ documents })
            } catch (err) {
                logger.log('error', 'Error fetching RAG documents', { error: err.message, tag: 'rag', solNum: req.params.solNum })
                return res.status(500).json({ error: 'Failed to fetch RAG documents' })
            }
        },

        /**
         * GET /api/rag/solicitation/:solNum/matches
         * Vector matches with chunk text, similarity scores, and explanations
         */
        getMatches: async function (req, res) {
            try {
                const { solNum } = req.params

                // Get the solicitation ID first
                const solResult = await pgPool.query(
                    `SELECT id FROM "rag-solicitations" WHERE solicitation_number = $1`,
                    [solNum]
                )

                if (solResult.rows.length === 0) {
                    return res.status(404).json({ error: 'RAG solicitation not found' })
                }

                const solId = solResult.rows[0].id

                // Get vector matches joined with document info
                const matchesResult = await pgPool.query(
                    `SELECT
            vm.*,
            vm.is_meaningful_match AS is_meaningful_508_match,
            vm.llm_validation_reasoning AS validation_reasoning,
            d.file_name,
            d.document_type,
            d.is_508_applicable,
            d.is_compliant
           FROM "rag-vector-matches" vm
           INNER JOIN "rag-documents" d ON vm.document_id = d.id
           WHERE d.solicitation_id = $1
           ORDER BY vm.similarity_score DESC`,
                    [solId]
                )

                return res.json({ matches: matchesResult.rows })
            } catch (err) {
                logger.log('error', 'Error fetching RAG matches', { error: err.message, tag: 'rag', solNum: req.params.solNum })
                return res.status(500).json({ error: 'Failed to fetch RAG matches' })
            }
        }
    }
}

