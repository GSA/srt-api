const fetch = require('node-fetch'); // Fallback if native fetch is weird, or just use global.fetch
const logger = require('../../config/winston');

class USAIAdapter {
    constructor() {
        this.apiKey = process.env.USAI_API;
        this.baseUrl = process.env.USAI_BASE_URL || 'https://api.gsa.usai.gov/api/v1';
        this.defaultModel = process.env.USAI_MODEL || 'claude_4_5_sonnet';
        this.defaultCheapModel = process.env.USAI_CHEAP_MODEL || 'claude_3_5_haiku';
    }

    async testCompletion(model = 'claude_3_5_sonnet') {
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
                throw new Error(`USAI API Error: ${err}`);
            }

            const data = await response.json();
            return data.choices?.[0]?.message?.content || "";
        }
    }

    async getEmbeddings(text, model, retries = 3, delay = 2000) {
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
