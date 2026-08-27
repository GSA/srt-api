const fetch = require('node-fetch'); // Fallback if native fetch is weird, or just use global.fetch
const logger = require('../../config/winston');

class USAIAdapter {
    constructor() {
        this.apiKey = process.env.USAI_API;
        this.baseUrl = process.env.USAI_BASE_URL || 'https://api.gsa.usai.gov/api/v1';
        // Defaults track the best models USAI currently offers. Both are
        // overridable per-environment via USAI_MODEL / USAI_CHEAP_MODEL.
        //
        // IMPORTANT: every name here must appear in GET /models. USAI 422s on
        // unknown models, and because these are fallbacks behind unset env vars,
        // a stale name fails silently at call time rather than at boot. The old
        // defaults (claude_4_5_sonnet, claude_3_5_haiku) predated the current
        // catalog — the haiku one did not exist at all and 422'd every call.
        this.defaultModel = process.env.USAI_MODEL || 'claude_4_8_opus';
        this.defaultCheapModel = process.env.USAI_CHEAP_MODEL || 'claude_4_5_haiku';
        // Embeddings are only comparable to other embeddings from the SAME model —
        // cosine similarity across two different models is meaningless, and fails
        // silently as bad scores rather than as an error. Both sides of vector
        // matching (the standards index and the document chunks) must resolve to
        // this one value. cohere_english_v3 is the strongest English retrieval
        // model in USAI's catalog.
        this.defaultEmbeddingModel = process.env.USAI_EMBED_MODEL || 'cohere_english_v3';
    }

    async testCompletion(model = process.env.USAI_MODEL || 'claude_4_8_opus') {
        const payload = {
            model: model,
            messages: [{ role: 'user', content: 'Return the word "HELLO" as JSON: {"message": "HELLO"}' }],
            response_format: { type: 'json_object' },
            max_tokens: 50
        };

        const response = await fetch(`${this.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const raw = await response.text();
        let parsed = null;
        if (response.ok) {
            try { parsed = JSON.parse(raw); } catch (e) {}
        }

        return {
            status_code: response.status,
            success: response.ok,
            model_tested: model,
            raw_response: raw.substring(0, 3000),
            parsed
        };
    }

    async testEmbeddings(model = 'cohere_english_v3') {
        const payload = { model: model, input: ['Section 508 testing'], input_type: 'search_document' };
        logger.log('info', `USAI testEmbeddings called`, { model, payload: JSON.stringify(payload), tag: 'usai-embeddings' });
        
        const response = await fetch(`${this.baseUrl}/embeddings`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const raw = await response.text();
        let parsed = null;
        if (response.ok) {
            try { parsed = JSON.parse(raw); } catch (e) {}
        }

        return {
            status_code: response.status,
            success: response.ok,
            model_tested: model,
            raw_response: raw.substring(0, 3000),
            parsed
        };
    }

    async getModels() {
        const response = await fetch(`${this.baseUrl}/models`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        const raw = await response.text();
        let parsed = null;
        if (response.ok) {
            try { parsed = JSON.parse(raw); } catch (e) {}
        }

        return {
            status_code: response.status,
            success: response.ok,
            raw_response: raw.substring(0, 5000),
            models: parsed
        };
    }

    async chatCompletion(system, user, model, retries = 3, delay = 2000, temperature = 0.2) {
        model = model || this.defaultModel;
        const payload = {
            model: model,
            messages: [
                { role: 'system', content: system },
                { role: 'user', content: user }
            ],
            temperature: temperature,
            max_tokens: 4000
        };

        for (let i = 0; i <= retries; i++) {
            const response = await fetch(`${this.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                if ((response.status === 429 || response.status === 503) && i < retries) {
                    logger.log('warn', `USAI Chat rate limit (${response.status}). Retrying in ${delay}ms...`, { tag: 'usai-retry' });
                    await new Promise(r => setTimeout(r, delay));
                    delay *= 2;
                    continue;
                }
                const err = await response.text();
                // Newer models (claude_4_8_opus among them) reject `temperature`
                // outright: "ValidationException: `temperature` is deprecated for
                // this model." Strip it and retry once rather than maintaining a
                // per-model allow-list that goes stale every catalog update.
                if (/temperature/i.test(err) && payload.temperature !== undefined) {
                    logger.log('warn', `USAI rejected temperature for ${model}; retrying without it`, { model, tag: 'usai-retry' });
                    delete payload.temperature;
                    i--; // can only fire once (the field is gone), so it must not
                         // burn a retry — and on the last iteration a bare
                         // `continue` would exit the loop and return undefined.
                    continue;
                }
                throw new Error(`USAI API Error: ${err}`);
            }

            const data = await response.json();
            return data.choices?.[0]?.message?.content || "";
        }
    }

    async getEmbeddings(text, model = this.defaultEmbeddingModel, retries = 3, delay = 2000) {
        model = model || 'cohere_english_v3';
        
        // Sanitize input text — remove excessive dots/periods, control chars, and normalize whitespace
        let sanitized = Array.isArray(text) ? text[0] : text;
        sanitized = sanitized
            .replace(/\.{3,}/g, '...')           // Collapse long runs of dots
            .replace(/\s{3,}/g, ' ')             // Collapse excessive whitespace
            .replace(/[^\x20-\x7E\n\r\t]/g, '') // Strip non-printable/non-ASCII chars
            .trim();
        
        // If after sanitization the text is too short or mostly non-semantic, return empty
        if (!sanitized || sanitized.length < 10) {
            logger.log('warn', 'USAI getEmbeddings skipped — text too short after sanitization', { 
                originalLength: (Array.isArray(text) ? text[0] : text).length,
                sanitizedLength: sanitized ? sanitized.length : 0,
                tag: 'usai-embeddings' 
            });
            return [];
        }

        // Cohere models require input_type parameter
        const payload = { 
            model: model, 
            input: [sanitized],
            input_type: 'search_document'
        };
        
        logger.log('info', `USAI getEmbeddings called`, { 
            model, 
            inputLength: sanitized.length,
            payload: JSON.stringify(payload).substring(0, 200),
            tag: 'usai-embeddings' 
        });
        
        for (let i = 0; i <= retries; i++) {
            const response = await fetch(`${this.baseUrl}/embeddings`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorStr = await response.text();
                logger.log('error', `USAI Embedding error`, { 
                    status: response.status, 
                    error: errorStr, 
                    attempt: i + 1,
                    model,
                    inputPreview: sanitized.substring(0, 100),
                    tag: 'usai-embeddings' 
                });
                if ((response.status === 429 || response.status === 503) && i < retries) {
                    logger.log('warn', `USAI Embedding rate limit (${response.status}). Retrying in ${delay}ms...`, { tag: 'usai-retry' });
                    await new Promise(r => setTimeout(r, delay));
                    delay *= 2;
                    continue;
                }
                // On 400 errors, don't throw — return empty so the pipeline continues
                if (response.status === 400) {
                    logger.log('warn', `USAI Embedding 400 — skipping chunk (non-fatal)`, { 
                        inputPreview: sanitized.substring(0, 150),
                        tag: 'usai-embeddings' 
                    });
                    return [];
                }
                throw new Error(`USAI Embedding Error: ${response.status} - ${errorStr}`);
            }

            const data = await response.json();
            logger.log('info', `USAI Embedding success`, { 
                model, 
                embeddingLength: data.data?.[0]?.embedding?.length || 0,
                tag: 'usai-embeddings' 
            });
            return data.data?.[0]?.embedding || [];
        }
    }

    parseJsonResponse(text) {
        if (!text) return null;
        
        // Try direct parse first
        try {
            return JSON.parse(text.trim());
        } catch(e) {}
        
        // Try extracting from markdown code block: ```json ... ```
        const blockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
        if (blockMatch) {
            try { return JSON.parse(blockMatch[1].trim()); } catch(e) {}
        }
        
        // Try finding a JSON object in the text
        const objStart = text.indexOf('{');
        const objEnd = text.lastIndexOf('}');
        if (objStart !== -1 && objEnd > objStart) {
            try { return JSON.parse(text.substring(objStart, objEnd + 1)); } catch(e) {}
        }

        return null;
    }
}

module.exports = new USAIAdapter();
