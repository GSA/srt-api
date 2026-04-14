/** @module RagAnalyticsRoutes */
const logger = require('../config/winston')

/**
 * Advanced RAG Analytics API Routes
 */
module.exports = function (pgPool) {
    return {

        /**
         * 1. GET /api/rag-analytics/tri-state
         * Calculates The Tri-State Compliance Posture.
         */
        getTriState: async function (req, res) {
            try {
                const result = await pgPool.query(`
SELECT
    COUNT(*) as total_solicitations,
    SUM(CASE WHEN ai_applicable = true AND ai_compliant = true THEN 1 ELSE 0 END) as compliant_count,
    SUM(CASE WHEN ai_applicable = true AND ai_compliant = false THEN 1 ELSE 0 END) as non_compliant_count,
    SUM(CASE WHEN ai_applicable = false THEN 1 ELSE 0 END) as not_applicable_count
FROM "rag-solicitations";
                `)
                return res.json(result.rows[0])
            } catch (err) {
                logger.log('error', 'Error fetching tri-state analytics', { error: err.message, tag: 'rag-analytics' })
                return res.status(500).json({ error: 'Failed to fetch tri-state analytics' })
            }
        },

        /**
         * 2. GET /api/rag-analytics/posture
         * Fetches high-level executive indicators across explicit coverage, COTS penetration, internal conflict rates, and risk posture. 
         */
        getPosture: async function (req, res) {
            try {
                const result = await pgPool.query(`
SELECT
    -- Risk Levels
    COUNT(*) FILTER (WHERE ai_overall_risk_level = 'High Risk') as high_risk_count,
    COUNT(*) FILTER (WHERE ai_overall_risk_level = 'Medium Risk') as medium_risk_count,
    COUNT(*) FILTER (WHERE ai_overall_risk_level = 'Low Risk') as low_risk_count,
    
    -- Explicit Rates and COTS
    SUM(CASE WHEN ai_explicit_508_coverage = true THEN 1 ELSE 0 END) as explicit_coverage_count,
    SUM(CASE WHEN ai_has_cots_products = true THEN 1 ELSE 0 END) as cots_products_count,
    SUM(CASE WHEN ai_conflicts_detected = true THEN 1 ELSE 0 END) as internal_conflict_count,
    
    -- Overall AI Confidence Baseline
    ROUND(AVG(average_quality_score)::numeric, 4) as global_average_confidence
FROM "rag-solicitations";
                `)
                return res.json(result.rows[0])
            } catch (err) {
                logger.log('error', 'Error fetching posture analytics', { error: err.message, tag: 'rag-analytics' })
                return res.status(500).json({ error: 'Failed to fetch posture analytics' })
            }
        },

        /**
         * 3. GET /api/rag-analytics/ict-taxonomy
         * Calculates the most common types of technology being procured globally.
         */
        getIctTaxonomy: async function (req, res) {
            try {
                const result = await pgPool.query(`
SELECT 
    unnest(ai_primary_ict_types) as ict_type, 
    COUNT(*) as frequency
FROM "rag-solicitations"
WHERE ai_primary_ict_types IS NOT NULL
GROUP BY ict_type
ORDER BY frequency DESC;
                `)
                return res.json(result.rows)
            } catch (err) {
                logger.log('error', 'Error fetching ict-taxonomy analytics', { error: err.message, tag: 'rag-analytics' })
                return res.status(500).json({ error: 'Failed to fetch ict-taxonomy analytics' })
            }
        },

        /**
         * 4. GET /api/rag-analytics/document-intelligence
         * Aggregates forensic splits across individual PDFs/Word docs.
         */
        getDocumentIntelligence: async function (req, res) {
            try {
                const result = await pgPool.query(`
SELECT
    -- Hardware vs Software vs Physical Applicable Bounds
    SUM(CASE WHEN hardware_component = true THEN 1 ELSE 0 END) as total_hardware_documents,
    SUM(CASE WHEN software_component = true THEN 1 ELSE 0 END) as total_software_documents,
    SUM(CASE WHEN is_physical_only = true THEN 1 ELSE 0 END) as purely_physical_documents,
    
    -- "False Security" Rate (Describes 508, but failed compliance checks natively)
    SUM(CASE WHEN is_discussing_508 = true AND is_compliant = false THEN 1 ELSE 0 END) as false_security_documents
FROM "rag-documents";
                `)
                return res.json(result.rows[0])
            } catch (err) {
                logger.log('error', 'Error fetching document-intelligence analytics', { error: err.message, tag: 'rag-analytics' })
                return res.status(500).json({ error: 'Failed to fetch document-intelligence analytics' })
            }
        },

        /**
         * 5. GET /api/rag-analytics/vector-violations
         * Retrieves the Top 10 most notoriously violated Sub-Standards across the federal government.
         */
        getVectorViolations: async function (req, res) {
            try {
                const result = await pgPool.query(`
SELECT 
    matched_standard, 
    COUNT(*) as violation_frequency,
    ROUND(AVG(false_positive_likelihood)::numeric, 4) as avg_false_positive_likelihood,
    ROUND(AVG(similarity_score)::numeric, 4) as avg_similarity_score,
    SUM(CASE WHEN is_meaningful_match = true THEN 1 ELSE 0 END) as meaningful_hits,
    SUM(CASE WHEN explicit_accessibility_mention = true THEN 1 ELSE 0 END) as explicit_mention_hits
FROM "rag-vector-matches"
GROUP BY matched_standard
ORDER BY violation_frequency DESC
LIMIT 10;
                `)
                return res.json(result.rows)
            } catch (err) {
                logger.log('error', 'Error fetching vector-violations analytics', { error: err.message, tag: 'rag-analytics' })
                return res.status(500).json({ error: 'Failed to fetch vector-violations analytics' })
            }
        },

        /**
         * 6. GET /api/rag-analytics/agency-leaderboard
         * Generates a strict, ruthless leaderboard scoring federal agencies purely on true AI evaluation.
         */
        getAgencyLeaderboard: async function (req, res) {
            try {
                const result = await pgPool.query(`
SELECT 
    agency,
    COUNT(*) as total_solicitations,
    SUM(CASE WHEN ai_compliant = true THEN 1 ELSE 0 END) as compliant_count,
    SUM(CASE WHEN ai_compliant = false AND ai_applicable = true THEN 1 ELSE 0 END) as non_compliant_count,
    ROUND((SUM(CASE WHEN ai_compliant = true THEN 1 ELSE 0 END)::decimal / NULLIF(COUNT(*), 0)) * 100, 2) as true_compliance_rate
FROM "rag-solicitations"
WHERE agency IS NOT NULL
GROUP BY agency
ORDER BY true_compliance_rate DESC;
                `)
                return res.json(result.rows)
            } catch (err) {
                logger.log('error', 'Error fetching agency-leaderboard analytics', { error: err.message, tag: 'rag-analytics' })
                return res.status(500).json({ error: 'Failed to fetch agency-leaderboard analytics' })
            }
        }
    }
}
