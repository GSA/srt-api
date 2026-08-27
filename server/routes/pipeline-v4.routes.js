/**
 * Pipeline V4 — BM25 Gatekeeper (David's deterministic compliance screener)
 * 
 * Architecture:
 *   BM25 keyword scoring (deterministic) → LLM (informational context only)
 *   HIGH score = "Included" without LLM
 *   LOW score = "Not Included" without LLM
 *   MEDIUM score = ML model tiebreaker
 * 
 * Stages:
 *   1. Text extraction
 *   2. Machine Readability check (LLM)
 *   3. Is Solicitation check (LLM)
 *   4. BM25 Keyword Screening (David's — deterministic, free, fast)
 *   5. ICT Classification (LLM)
 *   6. Document Summary (LLM)
 *   ML: srt-ml as tiebreaker for MEDIUM bucket only
 */

const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });
const logger = require('../config/winston');
const usaiAdapter = require('../shared/rag_services/usai_adapter');
const path = require('path');
const { spawn } = require('child_process');
const crypto = require('crypto');
const draftsFactory = require('./drafts.routes');

// The model every gate runs on. Sourced from the adapter so there is ONE place
// that decides which model this app uses; override per-environment with
// USAI_MODEL. Previously pinned to gemini-2.5-pro — these gates decide the
// verdict a contracting officer acts on, so they run on the strongest model
// available rather than the fastest.
const GATE_MODEL = usaiAdapter.defaultModel;

// ── Reuse prompts from v2 for gates ──────────────────────────────────────────
const { PROMPTS } = (() => {
  // Import the PROMPTS object from pipeline-v2
  const v2Module = require('./pipeline-v2.routes.js');
  // We can't easily extract PROMPTS from the module since it's inside the factory
  // So we'll define the gate prompts inline here
  return { PROMPTS: null };
})();

const GATE_PROMPTS = {
  machineReadable: {
    system: `Determine if this document is machine readable. A document is machine readable if software can reliably extract, interpret, and process its contents. Return ONLY valid JSON: {"is_machine_readable": true/false, "confidence": 1-10, "explanation": "brief explanation"}`,
    user: (text) => `Is this document machine readable?\n\n${text.substring(0, 5000)}`
  },
  isSolicitation: {
    system: `Determine if this document is a government solicitation (RFP, RFQ, IFB, BAA, etc). Return ONLY valid JSON: {"is_solicitation": true/false, "confidence": 1-10, "explanation": "brief explanation", "document_type": "RFP/RFQ/IFB/Other/Not a Solicitation"}`,
    user: (text) => `Is this document a solicitation?\n\n${text.substring(0, 10000)}`
  },
  ictClassification: {
    system: `You are an ICT classification expert. Identify what types of ICT are being procured. Return ONLY valid JSON: {"ict_types": {"Web": true/false, "Software": true/false, "Hardware": true/false, "Electronic_Content": true/false, "Telecommunications": true/false, "Multimedia": true/false, "Medical_Devices": true/false}, "explanation": "brief explanation"}`,
    user: (text) => `Classify ICT types:\n\n${text.substring(0, 50000)}`
  },
  exemption: {
    system: `You are a Section 508 compliance expert. Determine whether this solicitation documents a SECTION 508 EXEMPTION or exception.

Recognized Section 508 exemptions/exceptions (36 CFR 1194.1, E202):
- National Security Systems (NSS)
- Federal contracts for ICT incidental to a contract ("back office" / not delivered to the agency)
- Micro-purchase (below the micro-purchase threshold, limited circumstances)
- Undue burden determination (documented, with rationale)
- Fundamental alteration of the ICT's nature
- Commercial non-availability / "best meets" determination (no conforming product exists)
- Maintenance/monitoring spaces not used by the public or employees

Only report an exemption when the document AFFIRMATIVELY invokes or documents one. Do NOT infer an exemption from the mere absence of Section 508 language.

Return ONLY valid JSON:
{
  "has_exemption": true/false,
  "exemption_type": "NSS | incidental/back-office | micro-purchase | undue burden | fundamental alteration | commercial non-availability | maintenance spaces | other | none",
  "confidence": 1-10,
  "explanation": "1-2 sentences quoting or paraphrasing the exemption language found, or why none was found"
}`,
    user: (text) => `Does this solicitation document a Section 508 exemption?\n\n${text.substring(0, 50000)}`
  },
  documentSummary: {
    system: `Summarize this solicitation document factually. Return ONLY valid JSON: {"document_summary": "2-3 sentences", "procurement_description": "what ICT is being procured", "key_findings": ["finding 1", "..."], "document_type": "RFQ/RFP/SOW/Other"}`,
    user: (context) => `Summarize based on this analysis:\n\n${JSON.stringify(context, null, 2)}`
  }
};

// ── Deterministic 508 signal detection ───────────────────────────────────────

/**
 * A package that ships a document literally named "Section 508" / "VPAT" /
 * "ACR" is almost always using an agency template — they know what they're
 * doing. Treat that as satisfied rather than telling them to add a clause they
 * already have. (GSA 508 team direction: avoid false positives here.)
 */
function detectSection508Document(fileName) {
  const n = (fileName || '').toLowerCase();
  const patterns = [
    { re: /508/, label: 'Section 508' },
    { re: /\bvpat\b/, label: 'VPAT' },
    { re: /accessibility[ _-]*conformance[ _-]*report/, label: 'Accessibility Conformance Report' },
    { re: /\bacr\b/, label: 'ACR' }
  ];
  for (const p of patterns) {
    if (p.re.test(n)) {
      return { found: true, matched: p.label, file_name: fileName };
    }
  }
  return { found: false };
}

/**
 * Detect requirement content that came out of the Accessibility Requirements
 * Tool (ART). If they already pulled requirements from ART, SRT should not
 * offer a competing list — our answer differing from ART's is worse than
 * saying nothing.
 */
function detectArtDerivedContent(text) {
  const t = (text || '').toLowerCase();
  const signals = [];
  if (/accessibility requirements tool|section508\.gov\/art|\bart tool\b/.test(t)) {
    signals.push('ART reference');
  }
  // ART emits Revised 508 Standards clause numbers: E205.4, E207.2, 302.1, 502.3.1
  const clauseHits = (text || '').match(/\bE?[23]0\d(?:\.\d+){1,3}\b/g) || [];
  const distinct = new Set(clauseHits.map(x => x.toUpperCase()));
  if (distinct.size >= 5) {
    signals.push(`${distinct.size} Revised 508 Standards clause references`);
  }
  if (/revised 508 standards/.test(t) && /wcag 2\.0 level aa|wcag 2\.0 aa/.test(t)) {
    signals.push('Revised 508 Standards + WCAG 2.0 AA citation');
  }
  return { found: signals.length > 0, signals };
}

// ── BM25 subprocess call ─────────────────────────────────────────────────────

function runBm25(text) {
  return new Promise((resolve) => {
    const pythonPath = process.env.PYTHON_PATH || '/opt/venv/bin/python3';
    const bm25Dir = path.join(__dirname, '..', 'shared', 'bm25');
    
    const child = spawn(pythonPath, ['-m', 'bm25'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: path.join(__dirname, '..', 'shared'),
      env: { ...process.env }
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => { stdout += data.toString(); });
    child.stderr.on('data', (data) => { stderr += data.toString(); });

    child.on('close', (code) => {
      if (code !== 0) {
        logger.log('warn', `BM25 exited with code ${code}`, { stderr: stderr.substring(0, 500), tag: 'pipeline-v4' });
        resolve({ bucket: 'MEDIUM', bm25_normalized_score: 0, error: stderr.substring(0, 200) });
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (e) {
        resolve({ bucket: 'MEDIUM', bm25_normalized_score: 0, error: 'Failed to parse BM25 output' });
      }
    });

    child.on('error', (err) => {
      resolve({ bucket: 'MEDIUM', bm25_normalized_score: 0, error: err.message });
    });

    child.stdin.write(JSON.stringify({ text: text.substring(0, 200000) }));
    child.stdin.end();
  });
}

// ── ML Prediction (tiebreaker for MEDIUM) ────────────────────────────────────

function runMlPrediction(text, fileName = 'uploaded_file') {
  return new Promise((resolve) => {
    const pythonPath = process.env.PYTHON_PATH || '/opt/venv/bin/python3';
    const child = spawn(pythonPath, ['-m', 'srt_ml.predict.analyze_text'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env }
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => { stdout += data.toString(); });
    child.stderr.on('data', (data) => { stderr += data.toString(); });

    child.on('close', (code) => {
      if (code !== 0) {
        resolve({ prediction: 'undetermined', source: 'srt-ml', error: stderr.substring(0, 200) });
        return;
      }
      try {
        const result = JSON.parse(stdout);
        const pred = result.predictions?.[fileName];
        const isCompliant = pred === true || pred === 'True' || pred === 'compliant';
        resolve({ prediction: isCompliant ? 'compliant' : 'non_compliant', source: 'srt-ml', raw: result });
      } catch (e) {
        resolve({ prediction: 'undetermined', source: 'srt-ml', error: 'Failed to parse ML output' });
      }
    });

    child.on('error', (err) => {
      resolve({ prediction: 'undetermined', source: 'srt-ml', error: err.message });
    });

    const inputData = JSON.stringify({ documents: { [fileName]: text.substring(0, 100000) } });
    child.stdin.write(inputData);
    child.stdin.end();
  });
}

// ── Text extraction ──────────────────────────────────────────────────────────

/**
 * OCR fallback for image-only / scanned PDFs.
 * Uses the system tesseract + poppler binaries shipped in the Dockerfile.
 * Heavy: rasterizes each page to PNG and runs tesseract on it. Capped at a
 * small page count so we never tie the pipeline up on huge scans.
 */
async function ocrPdfBuffer(buffer, { maxPages = 25, dpi = 200 } = {}) {
  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  const { promisify } = require('util');
  const { execFile } = require('child_process');
  const exec = promisify(execFile);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'srt-ocr-'));
  try {
    const pdfPath = path.join(tmpDir, 'in.pdf');
    fs.writeFileSync(pdfPath, buffer);

    // Rasterize PDF pages to PNG with poppler's pdftoppm.
    // -r dpi, -l N caps to first N pages.
    await exec('pdftoppm', ['-png', '-r', String(dpi), '-l', String(maxPages),
                            pdfPath, path.join(tmpDir, 'page')], { timeout: 120000 });

    const pngs = fs.readdirSync(tmpDir)
      .filter(f => f.startsWith('page') && f.endsWith('.png'))
      .sort()
      .map(f => path.join(tmpDir, f));

    const parts = [];
    for (const png of pngs) {
      try {
        // tesseract <input> stdout -l eng
        const { stdout } = await exec('tesseract', [png, 'stdout', '-l', 'eng'],
                                      { timeout: 120000, maxBuffer: 50 * 1024 * 1024 });
        if (stdout && stdout.trim()) parts.push(stdout);
      } catch (e) {
        // skip a single bad page rather than failing the whole document
      }
    }
    return parts.join('\n');
  } finally {
    try { require('fs').rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
  }
}

async function extractText(file) {
  const mime = file.mimetype;
  if (mime === 'application/pdf') {
    const { PDFParse } = require('pdf-parse');
    const pdf = new PDFParse({ data: new Uint8Array(file.buffer) });
    const result = await pdf.getText();
    const text = result.text;
    await pdf.destroy();

    // OCR fallback: if pdf-parse returned essentially nothing, the PDF is
    // almost certainly a scanned image. Try Tesseract before giving up so
    // the pipeline can still classify those documents.
    const stripped = (text || '').replace(/\s/g, '');
    if (stripped.length < 80) {
      try {
        const ocrText = await ocrPdfBuffer(file.buffer);
        if (ocrText && ocrText.replace(/\s/g, '').length > stripped.length) {
          return { text: ocrText, ocrApplied: true };
        }
      } catch (e) {
        // OCR not available or failed — fall back to whatever we had.
      }
    }
    return { text, ocrApplied: false };
  } else if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const mammoth = require('mammoth');
    const result = await mammoth.extractRawText({ buffer: file.buffer });
    return { text: result.value, ocrApplied: false };
  } else {
    return { text: file.buffer.toString('utf8'), ocrApplied: false };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN ROUTE
// ══════════════════════════════════════════════════════════════════════════════

module.exports = function (pgPool) {
  const drafts = draftsFactory(pgPool);
  return {
    analyze: [upload.single('file'), async function (req, res) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no'
      });

      function sendEvent(event, data) {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      }

      try {
        const startTime = Date.now();
        sendEvent('stage', { stage: 'init', message: 'Pipeline V4 (BM25 Gatekeeper) starting...' });

        // ── Identify user + content (drafts auto-save & per-user cache) ──
        // Part of the per-user cache key. BUMP THIS whenever pipeline logic
        // changes in a way that could produce a different verdict for the same
        // bytes — otherwise findCachedResult() happily serves the old answer and
        // the new code never runs. (4.1: exemption check moved ahead of the
        // applicability gate, so previously-cached "not applicable" results for
        // exempt documents are wrong.)
        const PIPELINE_VERSION = '4.1';
        const userEmail = drafts.emailFromReq(req);
        const rawContent = req.file ? req.file.buffer : Buffer.from(req.body.text || '', 'utf8');
        const contentHash = crypto.createHash('sha256').update(rawContent).digest('hex');
        const forceRerun = req.body.force === 'true' || req.body.force === true;

        // ── Extract text ──────────────────────────────────────────
        let text = '';
        let fileName = 'pasted_text';
        let ocrApplied = false;
        if (req.file) { fileName = req.file.originalname || 'uploaded_file'; }
        const draftTitle = req.file ? fileName : `Pasted text (${contentHash.slice(0, 8)})`;

        // Per-user cache: identical content on the same pipeline version →
        // return the stored result instantly (zero LLM tokens). The client
        // can pass force=true to re-run anyway.
        if (userEmail && !forceRerun) {
          try {
            const cached = await drafts.findCachedResult(userEmail, contentHash, PIPELINE_VERSION);
            if (cached && cached.result) {
              sendEvent('stage', { stage: 'cache_hit', message: 'Identical document already analyzed — returning your saved result.' });
              sendEvent('complete', {
                ...cached.result,
                cached: true,
                cached_at: cached.created_at,
                draft: { draft_id: cached.draft_id, version_number: cached.version_number }
              });
              return res.end();
            }
          } catch (e) {
            logger.log('warn', 'draft cache lookup failed', { error: e.message, tag: 'pipeline-v4' });
          }
        }

        // Auto-save every completed run as the next version of this user's
        // draft (results only — the uploaded file itself is not stored).
        async function persistDraft (finalResult, verdict) {
          if (!userEmail) return;
          try {
            const saved = await drafts.saveVersion(userEmail, {
              title: draftTitle,
              fileName,
              contentHash,
              source: req.file ? 'file' : 'text',
              pipelineVersion: PIPELINE_VERSION,
              verdict,
              result: finalResult
            });
            finalResult.draft = saved;
          } catch (e) {
            logger.log('warn', 'draft auto-save failed', { error: e.message, tag: 'pipeline-v4' });
          }
        }

        if (req.file) {
          sendEvent('stage', { stage: 'extract', message: `Extracting text from ${fileName}...` });
          const extraction = await extractText(req.file);
          text = extraction.text || '';
          ocrApplied = !!extraction.ocrApplied;
          if (ocrApplied) {
            sendEvent('stage', {
              stage: 'ocr_applied',
              message: 'Image-only PDF detected — recovered text via OCR (Tesseract).'
            });
          }
        } else if (req.body.text) {
          text = req.body.text;
        }

        if (!text || text.length < 10) {
          sendEvent('error', { error: 'Text too short or missing.' });
          return res.end();
        }

        sendEvent('stage', {
          stage: 'extract_done',
          message: `Extracted ${text.length} characters${ocrApplied ? ' (via OCR)' : ''}`
        });

        // ── Stage 1: Machine Readability (LLM) ───────────────────
        sendEvent('stage', { stage: 'machine_readable', message: 'Checking machine readability...' });
        let machineReadable = null;
        try {
          const raw = await usaiAdapter.chatCompletion(GATE_PROMPTS.machineReadable.system, GATE_PROMPTS.machineReadable.user(text), GATE_MODEL);
          machineReadable = usaiAdapter.parseJsonResponse(raw);
          sendEvent('stage', { stage: 'machine_readable_done', data: machineReadable });
        } catch (e) {
          sendEvent('stage', { stage: 'machine_readable_error', message: e.message });
        }

        if (machineReadable && machineReadable.is_machine_readable === false) {
          const finalResult = { pipeline_version: PIPELINE_VERSION, pipeline_name: 'bm25_gatekeeper', file_name: fileName, stopped_at_gate: 'machine_readable', gate_message: 'Document is not machine readable.', machine_readable: machineReadable, ocr_applied: ocrApplied };
          await persistDraft(finalResult, 'not_machine_readable');
          sendEvent('complete', finalResult);
          return res.end();
        }

        // ── Stage 2: Is Solicitation (LLM) — SKIPPED for now ───────
        // Skipping this gate — documents uploaded manually are assumed to be solicitations
        let isSolicitation = { is_solicitation: true, confidence: 10, explanation: 'Skipped — manual upload assumed to be a solicitation.' };
        sendEvent('stage', { stage: 'is_solicitation_done', message: 'Is Solicitation: skipped (assumed true for manual upload)', data: isSolicitation });

        // ── Stage 2b: 508 Applicability (LLM) ────────────────────
        sendEvent('stage', { stage: 'applicability', message: 'Assessing Section 508 applicability...' });
        let applicability = null;
        try {
          const applicabilitySystem = `You are a Section 508 compliance expert. Determine if Section 508 of the Rehabilitation Act applies to this procurement.

CRITICAL EXCLUSION RULES — Section 508 does NOT apply to:
- Construction, demolition, dredging, excavation, or landscaping projects
- Passive mechanical components (bearings, seals, valves, gaskets, hose clamps)
- Analog instruments without digital displays (mechanical gauges, pointer meters)
- Bulk commodities: clothing, boots, food, medical supplies, chemicals
- Physical repair/maintenance of structures (roofing, plumbing, HVAC ducting)
- Ammunition, missiles, or munitions components without user interfaces
- Cables, fiber optics
- Temperature sensor with no display

CRITICAL INCLUSION RULES — Section 508 DOES apply to:
- Any procurement involving software, software licenses, web applications, or cloud services
- Hardware with user-facing digital displays, interfaces, or touchscreens
- IT services, help desk, managed services, system integration
- Telecommunications and network equipment
- Any product requiring a VPAT or Accessibility Conformance Report (ACR)

Return ONLY valid JSON:
{
  "is_508_applicable": true/false,
  "confidence_score": 1-10,
  "applicability_explanation": "2-3 sentences explaining decision"
}`;
          const raw = await usaiAdapter.chatCompletion(applicabilitySystem, `Determine if Section 508 applies to this document:\n\n${text.substring(0, 50000)}`, GATE_MODEL);
          applicability = usaiAdapter.parseJsonResponse(raw);
          sendEvent('stage', { stage: 'applicability_done', message: `508 Applicable: ${applicability?.is_508_applicable}`, data: applicability });
        } catch (e) {
          sendEvent('stage', { stage: 'applicability_error', message: e.message });
          // Default to applicable if we can't determine — safer to check than to skip
          applicability = { is_508_applicable: true, confidence_score: 5, applicability_explanation: 'Unable to assess — defaulting to applicable.' };
        }

        // ── Stage 2c: Deterministic 508 signals ──────────────────
        // A package that ships a "Section 508" / "VPAT" / "ACR" document, or
        // requirement content pulled from ART, is already handled — SRT should
        // not recommend a clause or a competing requirement list in that case.
        const section508Doc = detectSection508Document(fileName);
        const artDerived = detectArtDerivedContent(text);
        if (section508Doc.found) {
          sendEvent('stage', { stage: 'section508_doc', message: `Section 508 documentation detected in file name (${section508Doc.matched}).`, data: section508Doc });
        }
        if (artDerived.found) {
          sendEvent('stage', { stage: 'art_derived', message: `Requirement content appears to come from ART (${artDerived.signals.join('; ')}).`, data: artDerived });
        }

        // ── Stage 2d: Section 508 Exemption check (LLM) ──────────
        // Runs BEFORE the applicability gate: an exemption (e.g. National
        // Security Systems) means 508 APPLIES but is EXCEPTED — which the
        // applicability model frequently mislabels as "not applicable". If we
        // gated first we would never surface the exemption at all.
        const EXEMPTION_HINTS = /national security system|\bNSS\b|undue burden|micro-?purchase|fundamental alteration|commercial non-?availability|back.?office|incidental to (a |the )?contract|\bexempt/i;
        const worthCheckingExemption = applicability?.is_508_applicable !== false || EXEMPTION_HINTS.test(text);
        let exemption = null;
        if (!worthCheckingExemption) {
          exemption = { has_exemption: false, exemption_type: 'none', confidence: 10, explanation: 'No exemption language present.' };
        } else {
        sendEvent('stage', { stage: 'exemption', message: 'Checking for documented Section 508 exemptions...' });
        try {
          const raw = await usaiAdapter.chatCompletion(GATE_PROMPTS.exemption.system, GATE_PROMPTS.exemption.user(text), GATE_MODEL);
          exemption = usaiAdapter.parseJsonResponse(raw);
          sendEvent('stage', { stage: 'exemption_done', message: `Exemption: ${exemption?.has_exemption ? exemption.exemption_type : 'none found'}`, data: exemption });
        } catch (e) {
          sendEvent('stage', { stage: 'exemption_error', message: e.message });
          exemption = { has_exemption: false, exemption_type: 'none', confidence: 0, explanation: 'Exemption check unavailable.' };
        }
        }

        // ── GATE: Stop if 508 does not apply ─────────────────────
        // A documented exemption means 508 applies but is excepted — keep going
        // so the report can show the exemption instead of "not applicable".
        if (applicability && applicability.is_508_applicable === false && !exemption?.has_exemption) {
          const totalTime = Date.now() - startTime;
          const finalResult = {
            pipeline_version: PIPELINE_VERSION,
            pipeline_name: 'bm25_gatekeeper',
            file_name: fileName,
            generated_at: new Date().toISOString(),
            processing_time_ms: totalTime,
            ocr_applied: ocrApplied,
            stopped_at_gate: 'applicability',
            gate_message: 'Section 508 does not apply to this procurement. No further analysis required.',
            exemption: exemption,
            section508_document: section508Doc,
            art_derived: artDerived,
            machine_readable: machineReadable,
            is_solicitation: isSolicitation,
            applicability: applicability,
            ml_prediction: { prediction: 'not_applicable', source: 'applicability_gate' }
          };
          sendEvent('stage', { stage: 'gate_stop', message: 'STOPPED: Section 508 does not apply.' });
          await persistDraft(finalResult, 'not_applicable');
          sendEvent('complete', finalResult);
          try {
            await pgPool.query(
              `INSERT INTO adhoc_analysis_log (file_name, ml_prediction, is_508_applicable, pipeline_version, created_at) VALUES ($1, $2, $3, $4, NOW())`,
              [fileName, 'not_applicable', false, '4.0-bm25']
            );
          } catch (e) {}
          return res.end();
        }

        // ── Stage 3: BM25 + ML Model (David's — deterministic) ──────
        sendEvent('stage', { stage: 'bm25', message: 'Running BM25 screening + ML model...' });
        const bm25FullResult = await runBm25(text);
        const bm25Result = bm25FullResult.bm25 || bm25FullResult;
        const mlModelResult = bm25FullResult.ml_prediction || { prediction: 'non_compliant', source: 'fallback' };
        sendEvent('stage', { stage: 'bm25_done', message: `ML Model: ${mlModelResult.prediction} (confidence: ${mlModelResult.probability})`, data: { bm25: bm25Result, ml_prediction: mlModelResult } });

        // ── Compliance determination from ML model ────────────────
        let complianceDetermination = mlModelResult.prediction === 'compliant' ? 'compliant' : 'non_compliant';
        let complianceSource = mlModelResult.source;
        sendEvent('stage', { stage: 'compliance', message: `Compliance: ${complianceDetermination} (source: ${complianceSource}, probability: ${mlModelResult.probability})` });

        // ── Stage 4: ICT Classification (LLM) ────────────────────
        sendEvent('stage', { stage: 'ict', message: 'Classifying ICT types...' });
        let ictClassification = null;
        try {
          const raw = await usaiAdapter.chatCompletion(GATE_PROMPTS.ictClassification.system, GATE_PROMPTS.ictClassification.user(text), GATE_MODEL);
          ictClassification = usaiAdapter.parseJsonResponse(raw);
          sendEvent('stage', { stage: 'ict_done', data: ictClassification });
        } catch (e) {
          sendEvent('stage', { stage: 'ict_error', message: e.message });
        }

        // ── Stage 5: Document Summary (LLM) ──────────────────────
        sendEvent('stage', { stage: 'summary', message: 'Generating document summary...' });
        let documentSummary = null;
        try {
          const context = { bm25: bm25Result, ict: ictClassification, compliance: complianceDetermination };
          const raw = await usaiAdapter.chatCompletion(GATE_PROMPTS.documentSummary.system, GATE_PROMPTS.documentSummary.user(context), GATE_MODEL);
          documentSummary = usaiAdapter.parseJsonResponse(raw);
          sendEvent('stage', { stage: 'summary_done', data: documentSummary });
        } catch (e) {
          sendEvent('stage', { stage: 'summary_error', message: e.message });
        }

        // ── Final output ──────────────────────────────────────────
        const totalTime = Date.now() - startTime;
        const finalResult = {
          pipeline_version: PIPELINE_VERSION,
          pipeline_name: 'bm25_gatekeeper',
          file_name: fileName,
          generated_at: new Date().toISOString(),
          processing_time_ms: totalTime,
          ocr_applied: ocrApplied,
          // Compliance
          ml_prediction: { prediction: complianceDetermination, source: complianceSource, probability: mlModelResult.probability, threshold: mlModelResult.threshold },
          // Gates
          machine_readable: machineReadable,
          is_solicitation: isSolicitation,
          // BM25 evidence
          bm25: bm25Result,
          // LLM enrichment
          ict_classification: ictClassification,
          document_summary: documentSummary,
          // Applicability (from LLM gate)
          applicability: applicability,
          // Section 508 signals driving the recommendation logic in the UI
          exemption: exemption,
          section508_document: section508Doc,
          art_derived: artDerived,
          // Already handled → don't recommend a clause or requirements
          already_addressed: !!(section508Doc.found || artDerived.found),
        };

        const savedVerdict = exemption?.has_exemption ? 'exempt'
          : (section508Doc.found || artDerived.found) ? 'already_addressed'
          : complianceDetermination;
        await persistDraft(finalResult, savedVerdict);
        sendEvent('complete', finalResult);

        // Log to DB
        try {
          await pgPool.query(
            `INSERT INTO adhoc_analysis_log (file_name, ml_prediction, is_508_applicable, pipeline_version, created_at) VALUES ($1, $2, $3, $4, NOW())`,
            [fileName, complianceDetermination, true, '4.0-bm25']
          );
        } catch (e) {}

        res.end();
      } catch (err) {
        logger.log('error', 'Pipeline V4 fatal error', { error: err.message, stack: err.stack, tag: 'pipeline-v4' });
        sendEvent('error', { error: `Pipeline error: ${err.message}` });
        res.end();
      }
    }]
  };
};
