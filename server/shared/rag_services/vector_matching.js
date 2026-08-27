const usaiAdapter = require('./usai_adapter');

function cosineSimilarity(A, B) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < A.length; i++) {
        dotProduct += A[i] * B[i];
        normA += A[i] * A[i];
        normB += B[i] * B[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Simple recursive character splitter equivalent
function chunkText(text, chunkSize = 1000, chunkOverlap = 100) {
    const chunks = [];
    let start = 0;
    while (start < text.length) {
        let end = start + chunkSize;
        // avoid splitting in the middle of a word if possible
        if (end < text.length) {
            const spaceIndex = text.lastIndexOf(' ', end);
            if (spaceIndex > start) {
                end = spaceIndex;
            }
        }
        chunks.push(text.substring(start, end));
        start = end - chunkOverlap;
    }
    return chunks;
}

class VectorMatching {
    constructor() {
        this.index = null;
        this.chunkTexts = [];
    }

    // Default from the adapter, not a literal: the standards index and the
    // document chunks in runVectorMatching() MUST use the same embedding model
    // or the cosine scores below are comparing vectors from different spaces.
    async buildIndex(standardsText, model = usaiAdapter.defaultEmbeddingModel) {
        const chunks = chunkText(standardsText, 1000, 100);
        this.chunkTexts = chunks;
        this.index = [];

        // Build embeddings sequentially or parallel in small batches
        const batchSize = 3;
        for (let i = 0; i < chunks.length; i += batchSize) {
            const batch = chunks.slice(i, i + batchSize);
            const promises = batch.map(async (c) => {
                if (!c.trim()) return null;
                return await usaiAdapter.getEmbeddings(c, model);
            });
            const results = await Promise.all(promises);
            this.index.push(...results);
            // wait slightly to avoid rate limit
            await new Promise(r => setTimeout(r, 1000));
        }
        return this.index;
    }

    async runVectorMatching(documentText, threshold = 0.40) {
        if (!this.index || this.index.length === 0) {
            throw new Error("Standards index not built.");
        }

        const docChunks = chunkText(documentText, 1000, 100);
        const MAX_CHUNKS = 75;
        const processLimit = Math.min(docChunks.length, MAX_CHUNKS);

        const rawMatches = [];
        let errors = 0;
        const start = Date.now();

        // Process chunks
        for (let i = 0; i < processLimit; i++) {
            const chunk = docChunks[i];
            try {
                // Explicit model — this previously passed none, so the payload
                // shipped without a model field while buildIndex() used cohere.
                const emb = await usaiAdapter.getEmbeddings(chunk, usaiAdapter.defaultEmbeddingModel);
                
                // Compare to all standards
                let bestMatchScore = -1;
                let bestMatchIdx = -1;
                for (let j = 0; j < this.index.length; j++) {
                    if (!this.index[j]) continue;
                    const sim = cosineSimilarity(emb, this.index[j]);
                    if (sim > bestMatchScore) {
                        bestMatchScore = sim;
                        bestMatchIdx = j;
                    }
                }

                if (bestMatchScore >= threshold) {
                    rawMatches.push({
                        chunk_index: i,
                        chunk_text: chunk.substring(0, 300),
                        matched_standard: this.chunkTexts[bestMatchIdx].substring(0, 300),
                        similarity_score: parseFloat(bestMatchScore.toFixed(4)),
                        full_chunk: chunk.substring(0, 500),
                        full_standard: this.chunkTexts[bestMatchIdx].substring(0, 500)
                    });
                }
            } catch (e) {
                errors++;
            }
        }

        rawMatches.sort((a, b) => b.similarity_score - a.similarity_score);
        const topMatches = rawMatches.slice(0, 10);
        const faissTime = Date.now() - start;

        // LLM verification
        let llmAnalysis = "";
        let llmTime = 0;
        let matchVerdicts = {};

        if (topMatches.length > 0) {
            let matchSummary = "";
            topMatches.forEach((m, idx) => {
                matchSummary += `\\n--- Match ${idx + 1} (sim: ${m.similarity_score}) ---\\n`;
                matchSummary += `Solicitation text:\\n${m.full_chunk}\\n\\n`;
                matchSummary += `508 Standard text:\\n${m.full_standard}\\n`;
            });

            const llmStart = Date.now();
            const system = `You are a Section 508 expert. For each match between solicitation text and a 508 standard, determine if the solicitation text is a MEANINGFUL reference to Section 508 accessibility.

A match IS meaningful if the solicitation text:
- Explicitly mentions "Section 508", "Rehabilitation Act" in the context of ICT accessibility
- References VPAT, ACR, WCAG, or accessibility conformance requirements
- Contains FAR clauses specifically about ICT accessibility (e.g., 52.239-70, HHSAR 352.239-73/74)
- Requires the vendor to make products/services accessible to people with disabilities

A match is NOT meaningful if the solicitation text:
- References "Equal Opportunity for Workers with Disabilities" (FAR 52.222-36) — this is about hiring, not product accessibility
- Contains generic FAR boilerplate about telecommunications equipment prohibitions (Kaspersky, Huawei bans)
- Just happens to use similar regulatory language but has nothing to do with accessibility
- References the Rehabilitation Act only in the context of employment discrimination (Section 503), not ICT accessibility (Section 508)

Return ONLY valid JSON:
{
  "matches": [
    {"match_number": 1, "is_meaningful": true/false, "reason": "brief reason"}
  ],
  "overall_includes_508": true/false,
  "summary": "1-2 sentence factual summary"
}`;

            try {
                const response = await usaiAdapter.chatCompletion(
                    system, 
                    `Analyze these ${topMatches.length} matches:\\n${matchSummary}`,
                    usaiAdapter.defaultCheapModel
                );
                llmTime = Date.now() - llmStart;
                const result = usaiAdapter.parseJsonResponse(response);
                
                if (result) {
                    llmAnalysis = JSON.stringify(result);
                    (result.matches || []).forEach(v => {
                        matchVerdicts[v.match_number] = {
                            is_meaningful: !!v.is_meaningful,
                            reason: v.reason || ""
                        };
                    });
                }
            } catch (e) {
                llmAnalysis = `LLM analysis failed: ${e.message}`;
            }
        } else {
            llmAnalysis = "No matches found above threshold.";
        }

        // Apply verdicts
        const explicitMentions = topMatches.filter(m => m.similarity_score >= 0.50).length;
        topMatches.forEach((m, idx) => {
            const verdict = matchVerdicts[idx + 1] || {};
            m.llm_meaningful = !!verdict.is_meaningful;
            m.llm_reason = verdict.reason || "";
        });

        // Strip full chunks for response
        const matches = rawMatches.map(m => {
            const copied = { ...m };
            delete copied.full_chunk;
            delete copied.full_standard;
            return copied;
        });

        const strength = matches.length >= 3 ? "High" : matches.length >= 1 ? "Medium" : "Low";

        return {
            matches_found: matches.length,
            matches: matches,
            match_strength: strength,
            explicit_mentions: explicitMentions,
            processing_stats: {
                total_chunks_processed: processLimit,
                matches_above_threshold: matches.length,
                embedding_errors: errors,
                threshold_used: threshold,
                faiss_time_ms: faissTime,
                llm_time_ms: llmTime
            },
            llm_analysis: llmAnalysis
        };
    }
}

module.exports = new VectorMatching();
