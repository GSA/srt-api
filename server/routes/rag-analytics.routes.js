/** @module RagAnalyticsRoutes */
const logger = require('../config/winston')

/**
 * Advanced RAG Analytics API Routes
 */
module.exports = function (pgPool) {

    // Ensure ad-hoc usage tracking table exists
    pgPool.query(`
        CREATE TABLE IF NOT EXISTS adhoc_analysis_log (
            id SERIAL PRIMARY KEY,
            file_name VARCHAR(500),
            file_size INTEGER,
            ml_prediction VARCHAR(50),
            ict_category VARCHAR(200),
            is_508_applicable BOOLEAN,
            art_clauses_retrieved BOOLEAN,
            pipeline_version VARCHAR(20),
            created_at TIMESTAMP DEFAULT NOW()
        )
    `).catch(err => logger.log('warn', 'Could not create adhoc_analysis_log table', { error: err.message }));

    // Ensure pipeline stages library table exists
    pgPool.query(`
        CREATE TABLE IF NOT EXISTS pipeline_stages (
            id SERIAL PRIMARY KEY,
            stage_id VARCHAR(100) UNIQUE NOT NULL,
            name VARCHAR(200) NOT NULL,
            type VARCHAR(50) NOT NULL DEFAULT 'llm',
            system_prompt TEXT,
            user_description TEXT,
            model VARCHAR(100) DEFAULT 'claude_4_5_sonnet',
            example_input JSONB,
            example_output JSONB,
            is_default BOOLEAN DEFAULT false,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        )
    `).catch(err => logger.log('warn', 'Could not create pipeline_stages table', { error: err.message }));

    // Ensure pipeline templates table exists
    pgPool.query(`
        CREATE TABLE IF NOT EXISTS pipeline_templates (
            id SERIAL PRIMARY KEY,
            template_id VARCHAR(100) UNIQUE NOT NULL,
            name VARCHAR(200) NOT NULL,
            description TEXT,
            stages JSONB NOT NULL,
            created_by VARCHAR(200),
            is_default BOOLEAN DEFAULT false,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        )
    `).catch(err => logger.log('warn', 'Could not create pipeline_templates table', { error: err.message }));

    return {

        /**
         * 0a. GET /api/rag-analytics/adhoc-usage
         * Returns usage stats for the ad-hoc prediction tool.
         */
        getAdhocUsage: async function (req, res) {
            try {
                const result = await pgPool.query(`
                    SELECT
                        COUNT(*) as total_analyses,
                        COUNT(DISTINCT file_name) as unique_files,
                        SUM(CASE WHEN ml_prediction = 'compliant' THEN 1 ELSE 0 END) as compliant_count,
                        SUM(CASE WHEN ml_prediction = 'non_compliant' THEN 1 ELSE 0 END) as non_compliant_count,
                        SUM(CASE WHEN ml_prediction = 'unknown' THEN 1 ELSE 0 END) as unknown_count,
                        MIN(created_at) as first_analysis,
                        MAX(created_at) as last_analysis
                    FROM adhoc_analysis_log
                `);
                const daily = await pgPool.query(`
                    SELECT
                        DATE(created_at) as date,
                        COUNT(*) as count
                    FROM adhoc_analysis_log
                    GROUP BY DATE(created_at)
                    ORDER BY date DESC
                    LIMIT 30
                `);
                const byIct = await pgPool.query(`
                    SELECT
                        ict_category,
                        COUNT(*) as count
                    FROM adhoc_analysis_log
                    WHERE ict_category IS NOT NULL AND ict_category != ''
                    GROUP BY ict_category
                    ORDER BY count DESC
                    LIMIT 10
                `);
                return res.json({
                    summary: result.rows[0],
                    daily: daily.rows,
                    by_ict: byIct.rows
                });
            } catch (err) {
                logger.log('error', 'Error fetching adhoc usage', { error: err.message });
                return res.status(500).json({ error: 'Failed to fetch adhoc usage stats' });
            }
        },

        /**
         * 0b. GET /api/rag-analytics/stages — List all saved stages
         */
        listStages: async function (req, res) {
            try {
                const result = await pgPool.query('SELECT * FROM pipeline_stages ORDER BY is_default DESC, created_at ASC');
                return res.json(result.rows);
            } catch (err) {
                return res.status(500).json({ error: err.message });
            }
        },

        /**
         * 0c. POST /api/rag-analytics/stages — Create or update a stage
         */
        saveStage: async function (req, res) {
            try {
                const { stage_id, name, type, system_prompt, user_description, model, example_input, example_output, is_default } = req.body;
                if (!stage_id || !name) return res.status(400).json({ error: 'stage_id and name are required' });

                const result = await pgPool.query(`
                    INSERT INTO pipeline_stages (stage_id, name, type, system_prompt, user_description, model, example_input, example_output, is_default, updated_at)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
                    ON CONFLICT (stage_id) DO UPDATE SET
                        name = EXCLUDED.name, type = EXCLUDED.type, system_prompt = EXCLUDED.system_prompt,
                        user_description = EXCLUDED.user_description, model = EXCLUDED.model,
                        example_input = EXCLUDED.example_input, example_output = EXCLUDED.example_output,
                        is_default = EXCLUDED.is_default, updated_at = NOW()
                    RETURNING *
                `, [stage_id, name, type || 'llm', system_prompt || '', user_description || '', model || 'claude_4_5_sonnet',
                    JSON.stringify(example_input || {}), JSON.stringify(example_output || {}), is_default || false]);

                return res.json(result.rows[0]);
            } catch (err) {
                return res.status(500).json({ error: err.message });
            }
        },

        /**
         * 0d. DELETE /api/rag-analytics/stages/:stageId — Delete a stage
         */
        deleteStage: async function (req, res) {
            try {
                await pgPool.query('DELETE FROM pipeline_stages WHERE stage_id = $1', [req.params.stageId]);
                return res.json({ success: true });
            } catch (err) {
                return res.status(500).json({ error: err.message });
            }
        },

        /**
         * 0e. POST /api/rag-analytics/stages/generate-examples — AI generates example input/output for a stage
         */
        generateExamples: async function (req, res) {
            try {
                const adapter = require('../shared/rag_services/usai_adapter');
                const { system_prompt, user_description } = req.body;

                const prompt = `You are helping design a data pipeline stage. Based on the stage description and system prompt below, generate realistic example input and output JSON.

Stage description: "${user_description || 'No description provided'}"
System prompt: "${(system_prompt || '').substring(0, 1000)}"

Return ONLY valid JSON with this structure:
{
  "example_input": {
    "document_text": "A brief example snippet of solicitation text that this stage would receive...",
    "previous_stage_context": { "example_field": "example value from a previous stage" }
  },
  "example_output": {
    // Generate realistic output fields matching what the system prompt asks for
  }
}`;

                const response = await adapter.chatCompletion(prompt, 'Generate example input and output for this pipeline stage.', adapter.defaultCheapModel);
                const parsed = adapter.parseJsonResponse(response) || {};

                return res.json({ success: true, example_input: parsed.example_input || {}, example_output: parsed.example_output || {} });
            } catch (err) {
                return res.status(500).json({ error: err.message });
            }
        },

        /**
         * 0f. GET /api/rag-analytics/pipelines — List saved pipeline templates
         */
        listPipelines: async function (req, res) {
            try {
                const result = await pgPool.query('SELECT * FROM pipeline_templates ORDER BY is_default DESC, created_at DESC');
                return res.json(result.rows);
            } catch (err) { return res.status(500).json({ error: err.message }); }
        },

        /**
         * 0g. POST /api/rag-analytics/pipelines — Save a pipeline template
         */
        savePipeline: async function (req, res) {
            try {
                const { template_id, name, description, stages, created_by, is_default } = req.body;
                if (!template_id || !name || !stages) return res.status(400).json({ error: 'template_id, name, and stages required' });
                const result = await pgPool.query(
                    `INSERT INTO pipeline_templates (template_id, name, description, stages, created_by, is_default, updated_at)
                     VALUES ($1, $2, $3, $4, $5, $6, NOW())
                     ON CONFLICT (template_id) DO UPDATE SET name=EXCLUDED.name, description=EXCLUDED.description, stages=EXCLUDED.stages, updated_at=NOW()
                     RETURNING *`,
                    [template_id, name, description || '', JSON.stringify(stages), created_by || '', is_default || false]
                );
                return res.json(result.rows[0]);
            } catch (err) { return res.status(500).json({ error: err.message }); }
        },

        /**
         * 0h. DELETE /api/rag-analytics/pipelines/:templateId
         */
        deletePipeline: async function (req, res) {
            try {
                await pgPool.query('DELETE FROM pipeline_templates WHERE template_id = $1', [req.params.templateId]);
                return res.json({ success: true });
            } catch (err) { return res.status(500).json({ error: err.message }); }
        },

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
        },

        /**
         * 7. GET /api/rag-analytics/playground/status
         * Verify USAI integration status
         */
        getPlaygroundStatus: async function (req, res) {
            const hasKey = !!process.env.USAI_API;
            const usaiApi = process.env.USAI_API || '';
            const keyPreview = hasKey ? usaiApi.substring(0, 6) + '...' : '';
            return res.json({
                usai_api_configured: hasKey,
                usai_api_key_preview: keyPreview,
                usai_base_url: process.env.USAI_BASE_URL || 'https://api.gsa.usai.gov/api/v1',
                ready: hasKey
            });
        },

        /**
         * 8. GET /api/rag-analytics/playground/list-models
         */
        listPlaygroundModels: async function (req, res) {
            try {
                const adapter = require('../shared/rag_services/usai_adapter');
                const result = await adapter.getModels();
                return res.status(result.status_code || 200).json(result);
            } catch (err) {
                return res.status(500).json({ success: false, error: err.message });
            }
        },

        /**
         * 9. POST /api/rag-analytics/playground/test-completion
         */
        testPlaygroundCompletion: async function (req, res) {
            try {
                const adapter = require('../shared/rag_services/usai_adapter');
                // Fall back to the adapter's default rather than a hardcoded name —
                // 'claude_3_5_sonnet' is not in USAI's catalog and always 422'd.
                const model = req.query.model || req.body.model || adapter.defaultModel;
                const result = await adapter.testCompletion(model);
                return res.status(result.status_code || 200).json(result);
            } catch (err) {
                return res.status(500).json({ success: false, error: err.message });
            }
        },

        /**
         * 10. POST /api/rag-analytics/playground/test-embeddings
         */
        testPlaygroundEmbeddings: async function (req, res) {
            try {
                const adapter = require('../shared/rag_services/usai_adapter');
                const model = req.query.model || req.body.model || 'cohere_english_v3';
                const result = await adapter.testEmbeddings(model);
                return res.status(result.status_code || 200).json(result);
            } catch (err) {
                return res.status(500).json({ success: false, error: err.message });
            }
        },

        /**
         * 10b. POST /api/rag-analytics/playground/package-synthesis
         * Lightweight endpoint — single LLM call to summarize a multi-file solicitation package.
         * Expects JSON body with { summaries: [...], file_count: N, any_compliant: bool }
         */
        packageSynthesis: async function (req, res) {
            try {
                const adapter = require('../shared/rag_services/usai_adapter');
                const { summaries, file_count, any_compliant } = req.body;

                if (!summaries || !Array.isArray(summaries)) {
                    return res.status(400).json({ error: 'summaries array is required' });
                }

                const system = `You are summarizing a federal solicitation package that contains ${file_count} documents.

Based on the individual file analysis summaries provided, generate a concise executive summary of the entire package.

Describe:
1. What this solicitation package is for overall
2. What types of ICT are involved across all documents
3. The overall Section 508 compliance posture

The package-level compliance determination is: ${any_compliant ? 'COMPLIANT (at least one document includes Section 508 requirements)' : 'NON-COMPLIANT (no documents adequately address Section 508)'}

Return ONLY valid JSON:
{
  "executive_summary": "3-4 sentence summary of the entire solicitation package",
  "procurement_description": "what is being procured across all documents",
  "key_findings": ["finding 1", "finding 2", ...],
  "document_type": "RFQ/RFP/SOW/Package/Other"
}`;

                const userMsg = `Summarize this solicitation package:\n\n${summaries.join('\n\n')}`;
                const chatResponse = await adapter.chatCompletion(system, userMsg);
                const parsed = adapter.parseJsonResponse(chatResponse) || { executive_summary: chatResponse };

                return res.json({ success: true, synthesis: parsed });
            } catch (err) {
                logger.log('error', 'Package synthesis failed', { error: err.message, tag: 'rag-analytics' });
                return res.status(500).json({ success: false, error: err.message });
            }
        },

        /**
         * 10e. POST /api/rag-analytics/playground/generate-prompt
         * Takes a plain English description and generates a proper system prompt with JSON schema.
         * Body: { description: string }
         */
        generatePrompt: async function (req, res) {
            try {
                const adapter = require('../shared/rag_services/usai_adapter');
                const { description } = req.body;

                if (!description) return res.status(400).json({ error: 'description is required' });

                const system = `You are a prompt engineering assistant. A non-technical user wants to create an AI analysis stage for a federal solicitation review pipeline.

The user will describe in plain English what they want the stage to do and what information they want back. Your job is to translate that into a precise system prompt that:

1. Clearly instructs the AI what role to play
2. Specifies exactly what to analyze in the solicitation text
3. Defines a JSON output structure based on what the user asked for
4. Includes "Return ONLY valid JSON:" followed by the schema

Rules:
- Every field the user mentions should become a JSON field
- Use descriptive field names in snake_case
- Include appropriate data types (string, boolean, number, array)
- Add brief comments in the schema showing what each field should contain
- Keep the prompt professional and focused on federal procurement/508 compliance context

Return ONLY the system prompt text. Do not wrap it in JSON or code blocks. Just the raw prompt text that will be used as a system message.`;

                const userMsg = `The user wants a pipeline stage that does the following:\n\n"${description}"`;
                const generatedPrompt = await adapter.chatCompletion(system, userMsg, adapter.defaultCheapModel);

                return res.json({ success: true, prompt: generatedPrompt });
            } catch (err) {
                return res.status(500).json({ success: false, error: err.message });
            }
        },

        /**
         * 10d. POST /api/rag-analytics/playground/execute-stage
         * Executes a single pipeline stage. For testing individual prompts.
         * Body JSON: { type, systemPrompt, model, context (previous outputs), documentText }
         */
        executeStage: async function (req, res) {
            try {
                const adapter = require('../shared/rag_services/usai_adapter');
                const { spawn } = require('child_process');
                const { type, systemPrompt, model, context, documentText } = req.body;
                const startTime = Date.now();

                if (type === 'ml_prediction') {
                    const text = documentText || 'Sample solicitation text for testing.';
                    const fileName = 'test_document';
                    const output = await new Promise((resolve, reject) => {
                        const inputData = JSON.stringify({ documents: { [fileName]: text } });
                        const py = spawn('python3', ['-m', 'srt_ml.predict.analyze_text'], { stdio: ['pipe', 'pipe', 'pipe'] });
                        let stdout = '', stderr = '';
                        py.stdout.on('data', d => stdout += d.toString());
                        py.stderr.on('data', d => stderr += d.toString());
                        py.on('error', e => reject(e));
                        py.stdin.write(inputData);
                        py.stdin.end();
                        py.on('close', code => {
                            if (code !== 0) return reject(new Error(stderr));
                            try {
                                const r = JSON.parse(stdout);
                                const pred = r.predictions?.[fileName];
                                const isCompliant = pred === true || pred === 'True' || pred === 'compliant';
                                resolve({ prediction: isCompliant ? 'compliant' : 'non_compliant', source: 'srt-ml', raw: r });
                            } catch (e) { reject(e); }
                        });
                    });
                    return res.json({ success: true, input: { type: 'ml_prediction', documentLength: (documentText || '').length }, output, metrics: { duration_ms: Date.now() - startTime, model: 'srt-ml', type: 'ml_prediction' } });

                } else if (type === 'art_api') {
                    const artBody = context || { ict_type: ['it-prod'], solicitation_phase: 'solicitation-development' };
                    artBody.solicitation_phase = 'solicitation-development';
                    const artApiUrl = process.env.ART_API_URL || 'https://art-api-dev.app.cloud.gov';
                    const artResp = await fetch(`${artApiUrl}/v1/get508Languages`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(artBody)
                    });
                    const output = artResp.ok ? { language: await artResp.json(), source: 'ART API' } : { error: `ART API returned ${artResp.status}`, body: await artResp.text() };
                    return res.json({ success: true, input: artBody, output, metrics: { duration_ms: Date.now() - startTime, model: 'ART API', type: 'art_api' } });

                } else {
                    const usedModel = model || adapter.defaultModel;
                    const userMsg = `Previous analysis context:\n${JSON.stringify(context || {}, null, 2)}\n\nDocument text:\n${(documentText || 'No document provided.').substring(0, 40000)}`;
                    const promptTokenEstimate = Math.ceil(((systemPrompt || '').length + userMsg.length) / 4);
                    const rawResponse = await adapter.chatCompletion(systemPrompt || 'You are a helpful analyst.', userMsg, usedModel);
                    const responseTokenEstimate = Math.ceil((rawResponse || '').length / 4);
                    const parsed = adapter.parseJsonResponse(rawResponse) || { raw_response: rawResponse };
                    return res.json({
                        success: true,
                        input: { systemPrompt: (systemPrompt || '').substring(0, 500), model: usedModel, contextKeys: Object.keys(context || {}), documentLength: (documentText || '').length },
                        output: parsed,
                        rawResponse: rawResponse?.substring(0, 3000),
                        metrics: { duration_ms: Date.now() - startTime, model: usedModel, type: 'llm', prompt_tokens_est: promptTokenEstimate, response_tokens_est: responseTokenEstimate }
                    });
                }
            } catch (err) {
                return res.status(500).json({ success: false, error: err.message });
            }
        },

        /**
         * 10c. POST /api/rag-analytics/playground/execute-pipeline
         * Executes a custom pipeline definition. Each stage is an LLM call with a configurable prompt.
         * The output of each stage is injected as context into the next stage.
         *
         * Body: { text: string, stages: [{ id, name, type, systemPrompt, model? }] }
         * Streams SSE events for each stage.
         */
        executePipeline: async function (req, res) {
            const multer = require('multer');
            const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } }).single('file');

            upload(req, res, async (err) => {
                if (err) return res.status(400).json({ error: err.message });

                res.setHeader('Content-Type', 'text/event-stream');
                res.setHeader('Cache-Control', 'no-cache');
                res.setHeader('Connection', 'keep-alive');
                res.setHeader('X-Accel-Buffering', 'no');
                res.flushHeaders();

                function sendEvent(eventName, data) {
                    const jsonStr = JSON.stringify(data).replace(/\n/g, '\\n');
                    res.write(`event: ${eventName}\ndata: ${jsonStr}\n\n`);
                }

                try {
                    const adapter = require('../shared/rag_services/usai_adapter');
                    const { spawn } = require('child_process');

                    // Parse document
                    let text = '';
                    let fileName = 'raw_text';
                    const file = req.file;

                    if (file) {
                        fileName = file.originalname || 'uploaded_file';
                        const mime = file.mimetype;
                        if (mime === 'application/pdf') {
                            const { PDFParse } = require('pdf-parse');
                            const pdf = new PDFParse({ data: new Uint8Array(file.buffer) });
                            const result = await pdf.getText();
                            text = result.text;
                            await pdf.destroy();
                        } else if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
                            const mammoth = require('mammoth');
                            const result = await mammoth.extractRawText({ buffer: file.buffer });
                            text = result.value;
                        } else {
                            text = file.buffer.toString('utf8');
                        }
                    }

                    // stages come as a JSON string in the form field
                    let stages = [];
                    try {
                        stages = JSON.parse(req.body.stages || '[]');
                    } catch (e) {
                        sendEvent('error', { error: 'Invalid stages JSON' });
                        return res.end();
                    }

                    if (!req.body.text && !file) {
                        sendEvent('error', { error: 'No text or file provided' });
                        return res.end();
                    }
                    if (!text && req.body.text) text = req.body.text;

                    sendEvent('stage_result', { stageId: '_parse', name: 'Document Parsing', output: { fileName, charCount: text.length, preview: text.substring(0, 500) } });

                    // Execute each stage sequentially, chaining outputs
                    let previousOutputs = { document_text: text.substring(0, 50000), file_name: fileName };

                    for (let i = 0; i < stages.length; i++) {
                        const stage = stages[i];
                        sendEvent('stage_start', { stageId: stage.id, name: stage.name, index: i });

                        try {
                            let output;

                            if (stage.type === 'ml_prediction') {
                                // Special: run srt-ml model
                                output = await new Promise((resolve, reject) => {
                                    const inputData = JSON.stringify({ documents: { [fileName]: text } });
                                    const py = spawn('python3', ['-m', 'srt_ml.predict.analyze_text'], { stdio: ['pipe', 'pipe', 'pipe'] });
                                    let stdout = '', stderr = '';
                                    py.stdout.on('data', d => stdout += d.toString());
                                    py.stderr.on('data', d => stderr += d.toString());
                                    py.on('error', e => reject(e));
                                    py.stdin.write(inputData);
                                    py.stdin.end();
                                    py.on('close', code => {
                                        if (code !== 0) return reject(new Error(stderr));
                                        try {
                                            const r = JSON.parse(stdout);
                                            const pred = r.predictions?.[fileName];
                                            const isCompliant = pred === true || pred === 'True' || pred === 'compliant';
                                            resolve({ prediction: isCompliant ? 'compliant' : 'non_compliant', source: 'srt-ml', raw: r });
                                        } catch (e) { reject(e); }
                                    });
                                });

                            } else if (stage.type === 'art_api') {
                                // Special: call ART API using previous ICT classification
                                const artBody = previousOutputs.art_body || { ict_type: ['it-prod'], solicitation_phase: 'solicitation-development' };
                                const artApiUrl = process.env.ART_API_URL || 'https://art-api-dev.app.cloud.gov';
                                const artResp = await fetch(`${artApiUrl}/v1/get508Languages`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify(artBody)
                                });
                                if (artResp.ok) {
                                    output = { language: await artResp.json(), source: 'ART API' };
                                } else {
                                    output = { error: `ART API returned ${artResp.status}`, body: await artResp.text() };
                                }

                            } else {
                                // Default: LLM chat completion
                                const model = stage.model || adapter.defaultModel;
                                const userMsg = `Previous analysis context:\n${JSON.stringify(previousOutputs, null, 2)}\n\nDocument text:\n${text.substring(0, 40000)}`;
                                const rawResponse = await adapter.chatCompletion(stage.systemPrompt, userMsg, model);
                                output = adapter.parseJsonResponse(rawResponse) || { raw_response: rawResponse };
                                output._raw = rawResponse?.substring(0, 2000);
                            }

                            previousOutputs[stage.id] = output;
                            sendEvent('stage_result', { stageId: stage.id, name: stage.name, index: i, output });

                        } catch (stageErr) {
                            const errOutput = { error: stageErr.message };
                            previousOutputs[stage.id] = errOutput;
                            sendEvent('stage_result', { stageId: stage.id, name: stage.name, index: i, output: errOutput, error: true });
                        }
                    }

                    sendEvent('complete', { success: true, outputs: previousOutputs });
                    return res.end();

                } catch (err) {
                    sendEvent('error', { error: err.message });
                    return res.end();
                }
            });
        },

        /**
         * 11. POST /api/rag-analytics/playground/analyze
         * Execute the full 7-stage RAG pipeline and generate a comprehensive 508 compliance report.
         * Streams progress via Server-Sent Events (SSE) so the UI can show real-time stage updates.
         *
         * Stages:
         *   1. Document Parsing
         *   2. ML Compliance Determination (srt-ml model)
         *   3. ICT Classification (LLM)
         *   4. 508 Applicability Assessment (LLM)
         *   5. Semantic Vector Matching (embeddings + LLM verification)
         *   6. ART Clause Lookup (based on ICT classification)
         *   7. Final Report Synthesis (LLM)
         */
        playgroundAnalyze: async function (req, res) {
            const multer = require('multer');
            const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } }).single('file'); // 50MB
            
            upload(req, res, async (err) => {
                logger.log('info', 'Executing full 7-stage pipeline', { tag: 'rag-analytics' });
                if (err) {
                    logger.log('error', 'Playground multer upload rejected', { error: err.message, tag: 'rag-analytics' });
                    return res.status(400).json({ error: 'Failed to upload file: ' + err.message });
                }

                // Check if client wants SSE streaming
                const wantsStream = req.query.stream === 'true' || req.headers.accept === 'text/event-stream';

                // Helper to send SSE events (ensures data is single-line for SSE protocol)
                function sendEvent(eventName, data) {
                    if (wantsStream) {
                        const jsonStr = JSON.stringify(data).replace(/\n/g, '\\n');
                        res.write(`event: ${eventName}\ndata: ${jsonStr}\n\n`);
                    }
                }

                if (wantsStream) {
                    res.setHeader('Content-Type', 'text/event-stream');
                    res.setHeader('Cache-Control', 'no-cache');
                    res.setHeader('Connection', 'keep-alive');
                    res.setHeader('X-Accel-Buffering', 'no');
                    res.flushHeaders();
                }
                
                try {
                    let text = req.body.text || '';
                    const file = req.file;
                    let fileName = 'raw_text_input';

                    // ═══════════════════════════════════════════════════════════
                    // STAGE 1: Document Parsing
                    // ═══════════════════════════════════════════════════════════
                    sendEvent('stage', { stage: 'parsing', stageNum: 1, message: 'Stage 1/7: Parsing document content...' });

                    if (file) {
                        fileName = file.originalname || 'uploaded_file';
                        logger.log('info', 'Received file upload', { filename: fileName, size: file.size, mime: file.mimetype, tag: 'rag-analytics' });
                        const mime = file.mimetype;
                        if (mime === 'application/pdf') {
                            const { PDFParse } = require('pdf-parse');
                            const pdf = new PDFParse({ data: new Uint8Array(file.buffer) });
                            const result = await pdf.getText();
                            text = result.text;
                            await pdf.destroy();
                        } else if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
                            const mammoth = require('mammoth');
                            const result = await mammoth.extractRawText({ buffer: file.buffer });
                            text = result.value;
                        } else {
                            text = file.buffer.toString('utf8');
                        }
                    }

                    if (!text || text.length < 10) {
                        logger.log('error', 'Text parsing failed or too short', { tag: 'rag-analytics' });
                        if (wantsStream) {
                            sendEvent('error', { error: 'Text too short, invalid file type, or missing' });
                            return res.end();
                        }
                        return res.status(400).json({ error: 'Text too short, invalid file type, or missing' });
                    }

                    sendEvent('stage_result', { stage: 'parsing', stageNum: 1, message: `Document parsed: ${text.length} characters extracted`, data: { fileName, charCount: text.length } });

                const adapter = require('../shared/rag_services/usai_adapter');
                const { spawn } = require('child_process');

                // ═══════════════════════════════════════════════════════════
                // STAGE 2: ML Compliance Determination (srt-ml model)
                // ═══════════════════════════════════════════════════════════
                sendEvent('stage', { stage: 'ml_prediction', stageNum: 2, message: 'Stage 2/7: Running ML compliance model...' });
                logger.log('info', 'Starting ML compliance prediction', { tag: 'rag-analytics' });

                let mlPrediction;
                try {
                    mlPrediction = await new Promise((resolve, reject) => {
                        const inputData = JSON.stringify({ documents: { [fileName]: text } });
                        const pythonProcess = spawn('python3', ['-m', 'srt_ml.predict.analyze_text'], { stdio: ['pipe', 'pipe', 'pipe'] });
                        
                        let stdout = '';
                        let stderr = '';
                        
                        pythonProcess.stdout.on('data', (data) => { stdout += data.toString(); });
                        pythonProcess.stderr.on('data', (data) => { stderr += data.toString(); });
                        pythonProcess.on('error', (error) => reject(new Error(`ML process failed to start: ${error.message}`)));
                        
                        pythonProcess.stdin.write(inputData);
                        pythonProcess.stdin.end();
                        
                        pythonProcess.on('close', (code) => {
                            if (code !== 0) {
                                reject(new Error(`ML model exited with code ${code}: ${stderr}`));
                                return;
                            }
                            try {
                                const result = JSON.parse(stdout);
                                const prediction = result.predictions?.[fileName];
                                const isCompliant = prediction === true || prediction === 'True' || prediction === 'compliant';
                                resolve({
                                    prediction: isCompliant ? 'compliant' : 'non_compliant',
                                    raw_output: result,
                                    source: 'srt-ml'
                                });
                            } catch (e) {
                                reject(new Error(`Failed to parse ML output: ${e.message}`));
                            }
                        });
                    });
                } catch (e) {
                    logger.log('warn', 'ML prediction failed, continuing pipeline', { error: e.message, tag: 'rag-analytics' });
                    mlPrediction = { prediction: 'unknown', error: e.message, source: 'srt-ml' };
                }
                sendEvent('stage_result', { stage: 'ml_prediction', stageNum: 2, message: `ML Determination: ${mlPrediction.prediction}`, data: mlPrediction });

                // ═══════════════════════════════════════════════════════════
                // STAGE 3: ICT Classification (LLM)
                // ═══════════════════════════════════════════════════════════
                sendEvent('stage', { stage: 'ict_classification', stageNum: 3, message: 'Stage 3/7: Classifying ICT types...' });
                logger.log('info', 'Starting ICT classification', { tag: 'rag-analytics' });

                const ictSystem = `You are an ICT (Information and Communication Technology) classification expert for federal procurement.

Read the solicitation text carefully. Identify ALL types of ICT (Information and Communication Technology) being procured, delivered, or referenced.

Consider the full document — look for mentions of:
- Software systems, applications, platforms
- Hardware devices, computers, peripherals
- Cloud services (SaaS, PaaS, IaaS)
- Web applications or websites
- Mobile apps
- Electronic documents (PDFs, forms)
- Multimedia (video, audio)
- Telecommunications equipment
- Kiosks or self-service machines
- IT professional services (development, maintenance, help desk)

Return ONLY valid JSON:
{
  "ict_types": {
    "software": true/false,
    "hardware": true/false,
    "cloud_services": true/false,
    "web_applications": true/false,
    "mobile_applications": true/false,
    "electronic_documents": true/false,
    "multimedia": true/false,
    "telecommunications": true/false,
    "kiosks_self_service": true/false,
    "it_services": true/false
  },
  "primary_ict_category": "the single main ICT type being procured",
  "explanation": "2-3 sentences explaining what ICT is in this solicitation and why you classified it this way",
  "specific_products_mentioned": ["list any specific products, platforms, or systems named in the document"],
  "naics_estimate": "best guess at 6-digit NAICS code if determinable, or empty string"
}`;
                let ictClassification;
                let ictRawResponse = '';
                try {
                    ictRawResponse = await adapter.chatCompletion(ictSystem, `Classify the ICT types in this federal solicitation document:\n\n${text.substring(0, 50000)}`);
                    logger.log('info', 'ICT classification raw response', { response: ictRawResponse?.substring(0, 500), tag: 'rag-analytics' });
                    ictClassification = adapter.parseJsonResponse(ictRawResponse) || {};
                    ictClassification._raw_response = ictRawResponse?.substring(0, 1000);
                } catch (e) { 
                    ictClassification = { error: e.message, _raw_response: ictRawResponse?.substring(0, 500) }; 
                }
                sendEvent('stage_result', { stage: 'ict_classification', stageNum: 3, message: `ICT: ${ictClassification.primary_ict_category || 'Unable to determine'}`, data: ictClassification });

                // ═══════════════════════════════════════════════════════════
                // STAGE 4: 508 Applicability Assessment (LLM)
                // ═══════════════════════════════════════════════════════════
                sendEvent('stage', { stage: 'applicability', stageNum: 4, message: 'Stage 4/7: Assessing 508 applicability...' });
                logger.log('info', 'Starting applicability assessment', { tag: 'rag-analytics' });

                const applicabilitySystem = `You are a Section 508 compliance expert. Analyze the document text and determine if Section 508 of the Rehabilitation Act applies to this federal solicitation.

CRITICAL EXCLUSION RULES — Section 508 does NOT apply to:
- Construction, demolition, dredging, excavation, or landscaping projects
- Pure supply/material procurements with no ICT component

CRITICAL INCLUSION RULES — Section 508 DOES apply to:
- Any procurement involving software, web applications, or cloud services
- Hardware with user-facing digital displays or touchscreens
- IT services, help desk, managed services, system integration
- Electronic documents, multimedia content

Return ONLY valid JSON with these fields:
{
  "is_508_applicable": true/false,
  "confidence_score": 1-10,
  "applicability_explanation": "2-3 sentences explaining decision",
  "has_explicit_508_mention": true/false,
  "relevant_far_clauses": ["list of FAR clauses found, if any"]
}`;
                let applicabilityContext;
                let appRawResponse = '';
                try {
                    appRawResponse = await adapter.chatCompletion(applicabilitySystem, `Determine if Section 508 applies to this document:\n\n${text.substring(0, 50000)}`);
                    logger.log('info', 'Applicability raw response', { response: appRawResponse?.substring(0, 500), tag: 'rag-analytics' });
                    applicabilityContext = adapter.parseJsonResponse(appRawResponse) || {};
                    applicabilityContext._raw_response = appRawResponse?.substring(0, 1000);
                } catch (e) { applicabilityContext = { error: e.message }; }
                sendEvent('stage_result', { stage: 'applicability', stageNum: 4, message: applicabilityContext.is_508_applicable ? '508 Applicable' : 'Not Applicable (pipeline continues — NAICS filtering)', data: applicabilityContext });

                // ═══════════════════════════════════════════════════════════
                // STAGE 5: Semantic Vector Matching (SKIPPED — using ML model)
                // ═══════════════════════════════════════════════════════════
                const vmResult = { matches_found: 0, matches: [], match_strength: 'Skipped', explicit_mentions: 0, skipped: true, reason: 'Using ML model for compliance determination — vector matching bypassed for performance.' };
                sendEvent('stage_result', { stage: 'vector_matching', stageNum: 5, message: 'Skipped (ML model used for compliance)', data: vmResult });

                // ═══════════════════════════════════════════════════════════
                // STAGE 6: ART Clause Lookup (real ART API)
                // ═══════════════════════════════════════════════════════════
                sendEvent('stage', { stage: 'art_clauses', stageNum: 6, message: 'Stage 6/7: Querying Accessibility Requirements Tool (ART) API...' });
                logger.log('info', 'Starting ART clause lookup', { tag: 'rag-analytics' });

                // Determine active ICT types for clause generation
                const activeIctTypes = ictClassification.ict_types 
                    ? Object.entries(ictClassification.ict_types).filter(([k, v]) => v).map(([k]) => k)
                    : [];

                // Use LLM to map ICT classification into ART API body format
                const artMappingSystem = `You are mapping ICT classification results into the ART (Accessibility Requirements Tool) API request format.

The ART API accepts a JSON body with these fields:
- "ict_type": array of ["it-prod", "it-serv", "it-none"]
- "exceptions": array of ["excep-nat-sec", "excep-und-bur", "excep-mon-spa", "excep-alter", "excep-fed-con"]
- "electronic_content": object with boolean keys: "is_website", "is_public", "is_official_communication"
- "software_group": object with:
    - "software_criteria": array of ["assistive-technology", "no-user-interface", "idk"]
    - "software_web": boolean
    - "create_electronic_content": boolean
    - "cloud_services": array of ["saas", "paas", "other", "idk"]
    - "software_purchase": array of ["web-app", "auth-tool", "software-infrastructure", "other"]
- "hardware_group": object with:
    - "hardware_items": array of ["computer", "tablet", "printers_scanners_copiers", "multi-functional", "peripheral", "kiosk", "mobile", "video-teleconference-equipment", "video-monitor", "other", "none"]
    - "server_iaas": boolean
- "support": array of ["technical", "call", "doc", "training"]
- "solicitation_phase": always "solicitation-development"

Based on the ICT classification below, generate the appropriate ART API request body. Only include fields that are relevant. Always include "solicitation_phase": "solicitation-development" and "ict_type".

ICT Classification:
${JSON.stringify(ictClassification, null, 2)}

Return ONLY valid JSON matching the ART API format described above.`;

                let artClauses;
                try {
                    // Step 1: Use LLM to generate ART API body from ICT classification
                    const artBodyChat = await adapter.chatCompletion(artMappingSystem, `Map this ICT classification to ART API format:\n\n${JSON.stringify(ictClassification)}`, adapter.defaultCheapModel);
                    let artBody = adapter.parseJsonResponse(artBodyChat) || {};
                    
                    // Ensure required fields
                    artBody.solicitation_phase = 'solicitation-development';
                    if (!artBody.ict_type) {
                        artBody.ict_type = activeIctTypes.includes('it_services') || activeIctTypes.includes('cloud_services') ? ['it-serv'] : ['it-prod'];
                    }

                    // ── ART API body validation / cleanup ──
                    // Valid values for each field
                    const VALID_HARDWARE_ITEMS = ['computer', 'tablet', 'printers_scanners_copiers', 'multi-functional', 'peripheral', 'kiosk', 'mobile', 'video-teleconference-equipment', 'video-monitor', 'other', 'none'];
                    const VALID_ICT_TYPE = ['it-prod', 'it-serv', 'it-none'];
                    const VALID_CLOUD_SERVICES = ['saas', 'paas', 'other', 'idk'];
                    const VALID_SOFTWARE_PURCHASE = ['web-app', 'auth-tool', 'software-infrastructure', 'other'];
                    const VALID_SOFTWARE_CRITERIA = ['assistive-technology', 'no-user-interface', 'idk'];
                    const VALID_SUPPORT = ['technical', 'call', 'doc', 'training'];
                    const VALID_EXCEPTIONS = ['excep-nat-sec', 'excep-und-bur', 'excep-mon-spa', 'excep-alter', 'excep-fed-con'];

                    // Validate ict_type
                    if (artBody.ict_type) {
                        artBody.ict_type = artBody.ict_type.filter(v => VALID_ICT_TYPE.includes(v));
                        if (artBody.ict_type.length === 0) artBody.ict_type = ['it-prod'];
                    }

                    // Remove false boolean values from electronic_content
                    if (artBody.electronic_content) {
                        for (const key of Object.keys(artBody.electronic_content)) {
                            if (artBody.electronic_content[key] === false) delete artBody.electronic_content[key];
                        }
                        if (Object.keys(artBody.electronic_content).length === 0) delete artBody.electronic_content;
                    }

                    // hardware_group validation
                    if (artBody.hardware_group) {
                        if (artBody.hardware_group.hardware_items) {
                            artBody.hardware_group.hardware_items = artBody.hardware_group.hardware_items
                                .map(v => VALID_HARDWARE_ITEMS.includes(v) ? v : 'other')
                                .filter((v, i, a) => a.indexOf(v) === i); // dedupe
                        }
                        // server_iaas can only be present if hardware_items contains 'server'
                        const hwItems = artBody.hardware_group.hardware_items || [];
                        if (!hwItems.includes('server')) {
                            delete artBody.hardware_group.server_iaas;
                        }
                        if (!hwItems.length) delete artBody.hardware_group.hardware_items;
                        if (Object.keys(artBody.hardware_group).length === 0) delete artBody.hardware_group;
                    }

                    // software_group cleanup
                    if (artBody.software_group) {
                        if (artBody.software_group.cloud_services) {
                            artBody.software_group.cloud_services = artBody.software_group.cloud_services.filter(v => VALID_CLOUD_SERVICES.includes(v));
                            if (artBody.software_group.cloud_services.length === 0) delete artBody.software_group.cloud_services;
                        }
                        if (artBody.software_group.software_purchase) {
                            artBody.software_group.software_purchase = artBody.software_group.software_purchase.filter(v => VALID_SOFTWARE_PURCHASE.includes(v));
                            if (artBody.software_group.software_purchase.length === 0) delete artBody.software_group.software_purchase;
                        }
                        if (artBody.software_group.software_criteria) {
                            artBody.software_group.software_criteria = artBody.software_group.software_criteria.filter(v => VALID_SOFTWARE_CRITERIA.includes(v));
                            if (artBody.software_group.software_criteria.length === 0) delete artBody.software_group.software_criteria;
                        }
                        for (const key of Object.keys(artBody.software_group)) {
                            const val = artBody.software_group[key];
                            if (val === false || (Array.isArray(val) && val.length === 0)) {
                                delete artBody.software_group[key];
                            }
                        }
                        if (Object.keys(artBody.software_group).length === 0) delete artBody.software_group;
                    }

                    // Validate support
                    if (artBody.support) {
                        artBody.support = artBody.support.filter(v => VALID_SUPPORT.includes(v));
                        if (artBody.support.length === 0) delete artBody.support;
                    }

                    // Validate exceptions
                    if (artBody.exceptions) {
                        artBody.exceptions = artBody.exceptions.filter(v => VALID_EXCEPTIONS.includes(v));
                        if (artBody.exceptions.length === 0) delete artBody.exceptions;
                    }

                    logger.log('info', 'ART API request body generated', { artBody: JSON.stringify(artBody).substring(0, 500), tag: 'rag-analytics' });

                    // Step 2: Call the real ART API
                    const artApiUrl = process.env.ART_API_URL || 'https://art-api-dev.app.cloud.gov';
                    const artResponse = await fetch(`${artApiUrl}/v1/get508Languages`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(artBody)
                    });

                    if (!artResponse.ok) {
                        const artError = await artResponse.text();
                        logger.log('warn', 'ART API returned error', { status: artResponse.status, error: artError, tag: 'rag-analytics' });
                        artClauses = { 
                            error: `ART API returned ${artResponse.status}`, 
                            art_body_sent: artBody,
                            raw_error: artError 
                        };
                    } else {
                        const artData = await artResponse.json();
                        artClauses = {
                            language: artData,
                            art_body_sent: artBody,
                            active_ict_types: activeIctTypes,
                            source: 'ART API (art-api-dev.app.cloud.gov)'
                        };
                    }
                } catch (e) {
                    logger.log('warn', 'ART clause lookup failed', { error: e.message, tag: 'rag-analytics' });
                    artClauses = { error: e.message, active_ict_types: activeIctTypes };
                }
                sendEvent('stage_result', { stage: 'art_clauses', stageNum: 6, message: artClauses.error ? `ART API error: ${artClauses.error}` : 'ART clauses retrieved', data: artClauses });

                // ═══════════════════════════════════════════════════════════
                // STAGE 7: Final Report Synthesis (LLM)
                // ═══════════════════════════════════════════════════════════
                sendEvent('stage', { stage: 'synthesis', stageNum: 7, message: 'Stage 7/7: Generating comprehensive report...' });
                logger.log('info', 'Starting final report synthesis', { tag: 'rag-analytics' });

                const synthesisSystem = `You are generating a comprehensive Section 508 compliance analysis report for a federal solicitation.

You have the following analysis data:
- ML Model Prediction: ${mlPrediction.prediction}
- ICT Classification: ${ictClassification.primary_ict_category || 'Unknown'}
- 508 Applicability: ${applicabilityContext.is_508_applicable ? 'Yes' : 'No'} (confidence: ${applicabilityContext.confidence_score}/10)
- Vector Matches Found: ${vmResult.matches_found} (strength: ${vmResult.match_strength})
- Active ICT Types: ${activeIctTypes.join(', ') || 'None'}

Generate a comprehensive executive summary report. Be factual and specific.

Return ONLY valid JSON:
{
  "executive_summary": "3-4 sentence high-level summary of findings",
  "document_purpose": "what this solicitation is for",
  "procurement_description": "detailed description of what ICT is being procured",
  "compliance_determination": "compliant/non_compliant/undetermined with explanation",
  "risk_level": "High/Medium/Low",
  "risk_explanation": "why this risk level was assigned",
  "key_findings": ["finding 1", "finding 2", ...],
  "recommendations": ["recommendation 1", "recommendation 2", ...],
  "document_type": "RFQ/RFP/SOW/Amendment/Other"
}`;
                let synthesisContext;
                try {
                    const synthChat = await adapter.chatCompletion(synthesisSystem, `Generate the final report synthesis based on the document:\n\n${text.substring(0, 40000)}`);
                    synthesisContext = adapter.parseJsonResponse(synthChat) || {};
                } catch (e) { synthesisContext = { error: e.message }; }
                sendEvent('stage_result', { stage: 'synthesis', stageNum: 7, message: 'Report generated', data: synthesisContext });

                // ═══════════════════════════════════════════════════════════
                // COMPILE FINAL REPORT
                // ═══════════════════════════════════════════════════════════
                const finalReport = {
                    success: true,
                    status: 'Complete',
                    generated_at: new Date().toISOString(),
                    file_name: fileName,
                    document_length: text.length,

                    // Stage 2: ML Determination
                    ml_prediction: mlPrediction,

                    // Stage 3: ICT Classification
                    ict_classification: ictClassification,

                    // Stage 4: Applicability
                    applicability: applicabilityContext,

                    // Stage 5: Vector Matching
                    vector_matching: vmResult,

                    // Stage 6: ART Clauses
                    art_clauses: artClauses,

                    // Stage 7: Synthesis / Report
                    synthesis: synthesisContext,

                    // Pipeline metadata
                    pipeline_note: 'Full 7-stage analysis completed. All stages run regardless of applicability — solicitations are pre-filtered by NAICS code. ML model provides compliance determination; LLM stages provide enriched context and recommendations.',
                    pipeline_version: '2.0'
                };

                // Log usage to database
                try {
                    await pgPool.query(
                        `INSERT INTO adhoc_analysis_log (file_name, file_size, ml_prediction, ict_category, is_508_applicable, art_clauses_retrieved, pipeline_version)
                         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                        [
                            fileName,
                            text.length,
                            mlPrediction.prediction || 'unknown',
                            ictClassification.primary_ict_category || '',
                            applicabilityContext.is_508_applicable || false,
                            !!(artClauses.language),
                            '2.0'
                        ]
                    );
                } catch (logErr) {
                    logger.log('warn', 'Failed to log adhoc analysis', { error: logErr.message });
                }

                if (wantsStream) {
                    sendEvent('complete', finalReport);
                    return res.end();
                } else {
                    return res.json(finalReport);
                }

                } catch (err) {
                    logger.log('error', 'Error running pipeline analysis', { 
                        error: err.message, 
                        stack: err.stack,
                        tag: 'rag-analytics' 
                    });
                    if (wantsStream) {
                        sendEvent('error', { error: err.message, stack: err.stack });
                        return res.end();
                    }
                    return res.status(500).json({ success: false, error: err.message });
                }
            });
        },

        /**
         * POST /api/rag-analytics/art-lookup
         * Standalone ART requirements lookup by ICT types.
         * Used by the report detail page for non-compliant solicitations.
         */
        artLookup: async function (req, res) {
            try {
                const { ict_types } = req.body;
                if (!ict_types || !Array.isArray(ict_types) || ict_types.length === 0) {
                    return res.status(400).json({ error: 'ict_types array required' });
                }

                // Build ART API body deterministically from ICT types — no LLM needed
                const artBody = {
                    solicitation_phase: 'solicitation-development',
                    ict_type: []
                };

                const hasSoftware = ict_types.includes('Software') || ict_types.includes('Web');
                const hasHardware = ict_types.includes('Hardware');
                const hasTelecom = ict_types.includes('Telecommunications');
                const hasContent = ict_types.includes('Electronic_Content') || ict_types.includes('Multimedia');

                // Determine ict_type
                if (hasSoftware || hasHardware || hasTelecom) {
                    artBody.ict_type.push('it-prod');
                }
                if (ict_types.includes('Web') || ict_types.includes('Software')) {
                    artBody.ict_type.push('it-serv');
                }
                if (artBody.ict_type.length === 0) {
                    artBody.ict_type = ['it-prod'];
                }
                // Dedupe
                artBody.ict_type = [...new Set(artBody.ict_type)];

                // Software group
                if (hasSoftware) {
                    artBody.software_group = {
                        software_web: ict_types.includes('Web'),
                        create_electronic_content: hasContent
                    };
                    if (ict_types.includes('Web')) {
                        artBody.software_group.software_purchase = ['web-app'];
                        // ART API validation rejects cloud_services unless create_electronic_content
                        // is true (it treats false as missing), which 400s for web solicitations with
                        // no electronic content. Only send cloud_services when content is present.
                        if (hasContent) {
                            artBody.software_group.cloud_services = ['saas'];
                        }
                    } else {
                        artBody.software_group.software_purchase = ['other'];
                    }
                }

                // Hardware group
                if (hasHardware) {
                    artBody.hardware_group = {
                        hardware_items: ['computer', 'other']
                    };
                }

                // Electronic content
                if (hasContent) {
                    artBody.electronic_content = {
                        is_public: true
                    };
                }

                // Support (always include doc for ICT procurements)
                artBody.support = ['doc'];
                if (hasTelecom) {
                    artBody.support.push('technical');
                }

                logger.log('info', 'ART lookup - deterministic body', { artBody: JSON.stringify(artBody), ict_types, tag: 'art-lookup' });

                // Call ART API
                const artApiUrl = process.env.ART_API_URL || 'https://art-api-dev.app.cloud.gov';
                const artResponse = await fetch(`${artApiUrl}/v1/get508Languages`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(artBody)
                });

                if (!artResponse.ok) {
                    const artError = await artResponse.text();
                    logger.log('warn', 'ART API error', { status: artResponse.status, error: artError, artBody, tag: 'art-lookup' });
                    return res.status(502).json({ error: `ART API returned ${artResponse.status}`, detail: artError, art_body_sent: artBody });
                }

                const artData = await artResponse.json();
                return res.json({
                    language: artData,
                    art_body_sent: artBody,
                    active_ict_types: ict_types,
                    source: 'ART API'
                });
            } catch (err) {
                logger.log('error', 'ART lookup failed', { error: err.message, tag: 'art-lookup' });
                return res.status(500).json({ error: 'ART lookup failed: ' + err.message });
            }
        }
    }
}
