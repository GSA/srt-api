/**
 * Pipeline V2 — Laura's Prompts
 * 
 * Architecture:
 *   srt-ml (deterministic compliance) + LLM (informational context only)
 *   Vector matching active with LLM validation
 *   Models: Gemini 2.5 Pro (primary), Gemini 2.5 Flash (match validation)
 * 
 * Stages:
 *   1. Text extraction (PDF/DOCX/TXT)
 *   2. 508 Applicability Assessment (Gemini Pro)
 *   3. ICT Type Classification (Gemini Pro)
 *   4. Vector Match Analysis (Cohere embeddings + Gemini Flash validation)
 *   5. Document Summary (Gemini Pro)
 *   6. Solicitation-level Summary (Gemini Pro) — multi-file only
 *   ML: srt-ml binary compliance prediction (runs in parallel)
 */

const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });
const logger = require('../config/winston');
const usaiAdapter = require('../shared/rag_services/usai_adapter');
const vectorMatching = require('../shared/rag_services/vector_matching');
const fs = require('fs');
const path = require('path');

// Models
const GEMINI_PRO = 'gemini-2.5-pro';
const GEMINI_FLASH = 'gemini-2.5-flash';

// ══════════════════════════════════════════════════════════════════
// PROMPTS (Laura's — May 7, 2026, updated from SRT_PROMPTS_20260507.docx)
// ══════════════════════════════════════════════════════════════════

const PROMPTS = {
  machineReadable: {
    system: `(Q1) Is the document machine readable
Determine if Section 508 applies to a document or collection of documents. First review the document to determine if the document or collection of documents is machine readable? A document is considered machine readable if software can reliably extract, interpret, and process its contents without manual retyping or human interpretation. Check the files for actual encoded text, structured fields, metadata, tagged elements, tables/data in parseable form. These are all indications that the document or package is machine readable. Is this document and/or package machine readable

Return ONLY valid JSON:
{
  "is_machine_readable": true/false,
  "confidence": 1-10,
  "explanation": "brief explanation of determination",
  "indicators_found": ["list of machine readability indicators found"]
}`,
    user: (text) => `Is this document machine readable?\n\n${text.substring(0, 5000)}`
  },

  isSolicitation: {
    system: `(Q2) Is the document/package a solicitation?
Determine if the document and/or package is a solicitation. A government solicitation is a formal request from an agency seeking bids, proposals, quotes, or applications from vendors. You can usually identify one by a combination of keywords, document structure, FAR clauses, procurement identifiers, and required sections.

Structural elements of a solicitation include: 1. Solicitation Number, RFQ No., RFP No.
Core solicitation terms: Solicitation
Request for Proposal (RFP)
Request for Quote (RFQ)
Request for Quotation
Invitation for Bid (IFB)
Broad Agency Announcement (BAA)
Sources Sought
Request for Information (RFI)
Notice of Funding Opportunity (NOFO)
Funding Opportunity Announcement (FOA)
Combined Synopsis/Solicitation

Return ONLY valid JSON:
{
  "is_solicitation": true/false,
  "confidence": 1-10,
  "document_type": "RFP/RFQ/IFB/BAA/RFI/NOFO/FOA/Combined Synopsis/Other/Not a Solicitation",
  "explanation": "brief explanation of determination",
  "identifiers_found": ["list of solicitation identifiers found"]
}`,
    user: (text) => `Is this document a solicitation?\n\n${text.substring(0, 10000)}`
  },

  applicability: {
    system: `You are a Section 508 compliance expert. Analyze the document text and determine if Section 508 of the Rehabilitation Act applies to this document.

CRITICAL EXCLUSION RULES — Section 508 does NOT apply to:
- Construction, demolition, dredging, excavation, or landscaping projects
- Passive mechanical components (bearings, seals, valves, gaskets, hose clamps)
- Analog instruments without digital displays (mechanical gauges, pointer meters)
- Bulk commodities: clothing, boots, food, medical supplies, chemicals
- Physical repair/maintenance of structures (roofing, plumbing, HVAC ducting)
- Ammunition, missiles, or munitions components without user interfaces

CRITICAL INCLUSION RULES — Section 508 DOES apply to:
- Any procurement involving software, web applications, or cloud services
- Hardware with user-facing digital displays or touchscreens
- IT services, help desk, managed services, system integration
- Telecommunications and network equipment
- Any product requiring a VPAT or Accessibility Conformance Report (ACR)

Return ONLY valid JSON with these fields:
{
  "is_508_applicable": true/false,
  "confidence_score": 1-10,
  "key_eit_indicators": ["specific technology keywords found"],
  "applicability_explanation": "2-3 sentences explaining decision",
  "accessibility_considerations": "specific accessibility features needed or None",
  "is_physical_only": true/false,
  "has_explicit_508_mention": true/false,
  "is_cots_product": true/false,
  "ict_complexity": "Simple/Medium/Complex"
}`,
    user: (text) => `Determine if Section 508 applies to this document:\n\n${text.substring(0, 50000)}`
  },

  ictClassification: {
    system: `You are an ICT classification expert for federal procurement. Analyze this solicitation document and identify what types of Information and Communication Technology are BEING PROCURED (bought/contracted for).

Only mark a type as true if the solicitation is actually acquiring that type of ICT. Do NOT mark true just because the document mentions a website URL, uses email, or references technology in passing. The question is: what ICT is the government buying?

For example:
- A solicitation to buy laptops → Hardware=true
- A solicitation for a web application → Web=true, Software=true
- A solicitation that mentions "submit via email" → Telecommunications=false (email is just the submission method, not what's being procured)
- A solicitation for an MRI machine with software → Hardware=true, Software=true, Medical_Devices=true

Return ONLY valid JSON:
{
  "ict_types": {
    "Web": true/false,
    "Software": true/false,
    "Hardware": true/false,
    "Electronic_Content": true/false,
    "Telecommunications": true/false,
    "Multimedia": true/false,
    "Medical_Devices": true/false
  },
  "hardware_component": "Yes"/"No",
  "software_component": "Yes"/"No",
  "explanation": "brief explanation of what ICT is being procured"
}`,
    user: (text) => `Classify ICT types in this text:\n\n${text.substring(0, 50000)}`
  },

  documentSummary: {
    system: `You are summarizing a single solicitation document.

Your job is to provide a factual summary of what this document is about and what ICT (Information and Communication Technology) is being procured.

Describe:
1. What the solicitation/document is for (the purpose, scope, what's being bought)
2. What types of ICT are involved (software, hardware, services, etc.)
3. Whether Section 508 accessibility standards are mentioned or referenced
4. Any notable regulatory references found in the document

Do NOT make compliance determinations. Do NOT recommend actions. Just describe what's in the document factually.

Return ONLY valid JSON:
{
  "document_summary": "2-3 sentence summary of what this document is about",
  "procurement_description": "what ICT is being procured",
  "section_508_references": ["list of specific 508/accessibility references found, if any"],
  "regulatory_references": ["other notable regulatory references"],
  "key_findings": ["factual finding 1", "..."],
  "document_type": "RFQ/RFP/SOW/Amendment/Other"
}`,
    user: (analysisJson) => `Summarize this document based on the analysis:\n\n${JSON.stringify(analysisJson, null, 2)}`
  },

  solicitationSummary: {
    system: `You are summarizing a federal solicitation package across multiple files.

Describe:
1. What this solicitation is for (the overall procurement purpose)
2. What types of ICT are being procured across all files
3. A brief description of what each file contains
4. Whether any files reference Section 508 accessibility standards (factual observation)
5. The primary ICT types involved

Do NOT make compliance determinations. Do NOT recommend actions. Compliance is determined by a separate ML model — your job is informational context only.

Return ONLY valid JSON:
{
  "solicitation_summary": "2-3 sentence overview of what this solicitation is about",
  "procurement_type": "Services/Products/Mixed",
  "procurement_complexity": "Simple/Medium/Complex",
  "primary_ict_types": ["list of ICT types being procured"],
  "has_cots_products": true/false,
  "file_descriptions": [{"file": "name", "description": "what this file contains"}],
  "section_508_observations": "factual note on whether 508 is mentioned in any files",
  "key_findings": ["factual finding 1", "..."],
  "solicitation_explanation": "2-3 sentence factual summary of the solicitation and its ICT content"
}`,
    user: (fileResults) => `Summarize this solicitation package:\n\n${JSON.stringify(fileResults, null, 2)}`
  }
};

// ══════════════════════════════════════════════════════════════════
// PROMPTS V3 (FAR-grounded — May 14, 2026, from SRT_PROMPTS_v3.docx)
// Only applicability and ICT classification changed; others same as v2
// ══════════════════════════════════════════════════════════════════

const PROMPTS_V3 = {
  ...PROMPTS,
  applicability: {
    system: `You are a Section 508 compliance expert working with federal acquisition professionals to include Section 508 in solicitation language as required or otherwise indicated by FAR, particularly part 39.104. Analyze the document text and determine if Section 508 of the Rehabilitation Act and updated Federal Acquisition Requirements related to Section 508 apply to this document.

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

Return ONLY valid JSON with these fields:
{
  "is_508_applicable": true/false,
  "confidence_score": 1-10,
  "key_eit_indicators": ["specific technology keywords found"],
  "applicability_explanation": "2-3 sentences explaining decision",
  "accessibility_considerations": "specific accessibility features needed or None",
  "is_physical_only": true/false,
  "has_explicit_508_mention": true/false,
  "is_cots_product": true/false,
  "ict_complexity": "Simple/Medium/Complex"
}`,
    user: (text) => `Determine if Section 508 applies to this document:\n\n${text.substring(0, 50000)}`
  },

  ictClassification: {
    system: `You are an ICT classification expert for federal procurement. Analyze this solicitation document and identify what types of Information and Communication Technology are BEING PROCURED (bought/contracted for). If a particular product is being requested, use outside sources to determine if the product mentioned is ICT under the specifications in the previous prompt.

Full text of the FAR as it relates to ICT and accessibility: When acquiring ICT, agencies must ensure that—
(a) Federal employees with disabilities have access to and use of information and data that is comparable to the access and use by Federal employees who are not individuals with disabilities; and
(b) Members of the public with disabilities seeking information or services from an agency have access to and use of information and data that is comparable to the access to and use of information and data by members of the public who are not individuals with disabilities.

39.104-3 Applicability.
(a) General. Unless an exception at 39.104-4 or an exemption at 39.104-5 applies, acquisitions for ICT supplies and services must meet the applicable ICT accessibility standards at 36 CFR 1194.1.
(b) Commercial products and commercial services. When acquiring commercial products and commercial services, an agency must comply with those ICT accessibility standards that can be met with supplies or services that are available in the commercial marketplace and that best address the agency's needs, but see 39.104-5(a)(3).
(c) Legacy ICT. Any component or portion of existing ICT (i.e., ICT that was procured, maintained, or used on or before January 18, 2018) is not required to comply with the current ICT accessibility standards if it—
(1) Complies with an earlier standard issued according to section 508 of the Rehabilitation Act of 1973 (29 U.S.C. 794d), which is set forth in Appendix D to 36 CFR 1194.1); and
(2) Has not been altered (i.e., a change that affects interoperability, the user interface, or access to information or data) after January 18, 2018.
(d) Alterations of legacy ICT. When altering any component or portion of existing ICT, after January 18, 2018, the component or portion must be modified to conform to the current ICT accessibility standards in 36 CFR 1194.1.

39.104-4 Exceptions.
(a) The requirements in 39.104-2 do not apply to acquisitions for—
(1) National security systems. ICT operated by agencies as part of a national security system, as defined by 40 U.S.C. 11103(a);
(2) Incidental contract items. ICT acquired by a contractor incidental to a contract, i.e., for in-house use by the contractor to perform the contract; or
(3) Maintenance or monitoring spaces. The portions of ICT that are operable parts or status indicators located in spaces frequented only by service personnel for maintenance, repair, or occasional monitoring of equipment.

39.104-5 Exemptions.
(a) Allowable exemptions. An agency may grant an exemption for the following:
(1) Undue burden. When an agency determines the acquisition of ICT conforming with all the applicable ICT accessibility standards would impose an undue burden on the agency.
(2) Fundamental alteration. When an agency determines that acquisition of ICT that conforms with all applicable ICT accessibility standards would result in a fundamental alteration in the nature of the ICT.
(3) Nonavailability of conforming commercial products and commercial services. Where there are no commercial products and commercial services that fully conform to the ICT accessibility standards.

Only mark a type as true if the solicitation is actually acquiring that type of ICT.
Do NOT mark true just because the document mentions a website URL, uses email, or references technology in passing.

The question is: what ICT is the government buying?

For example:
- A solicitation to buy laptops → Hardware=true
- A solicitation for a web application → Web=true, Software=true
- A solicitation that mentions "submit via email" → Telecommunications=false (email is just the submission method, not what's being procured)
- A solicitation for an MRI machine with software → Hardware=true, Software=true, Medical_Devices=true
- A solicitation for software licenses - software license=true or software licenses=true

Return ONLY valid JSON:
{
  "ict_types": {
    "Web": true/false,
    "Software": true/false,
    "Hardware": true/false,
    "Electronic_Content": true/false,
    "Telecommunications": true/false,
    "Multimedia": true/false,
    "Medical_Devices": true/false
  },
  "hardware_component": "Yes"/"No",
  "software_component": "Yes"/"No",
  "explanation": "brief explanation of what ICT is being procured"
}`,
    user: (text) => `Classify ICT types in this text:\n\n${text.substring(0, 50000)}`
  }
};

// ══════════════════════════════════════════════════════════════════
// HELPER: Run srt-ml prediction
// ══════════════════════════════════════════════════════════════════

function runMlPrediction(text, fileName = 'uploaded_file') {
  return new Promise((resolve) => {
    const { spawn } = require('child_process');
    const pythonPath = process.env.PYTHON_PATH || 'python3';
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
        logger.log('warn', `srt-ml exited with code ${code}`, { stderr: stderr.substring(0, 500), tag: 'pipeline-v2' });
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

    // Send in the format srt-ml expects: { documents: { filename: text } }
    const inputData = JSON.stringify({ documents: { [fileName]: text.substring(0, 100000) } });
    child.stdin.write(inputData);
    child.stdin.end();
  });
}

// ══════════════════════════════════════════════════════════════════
// HELPER: Ensure 508 standards index is built
// ══════════════════════════════════════════════════════════════════

let indexReady = false;
let indexBuilding = false;

async function ensureIndex() {
  if (indexReady) return true;
  if (indexBuilding) {
    // Wait for it
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 2000));
      if (indexReady) return true;
    }
    return false;
  }

  indexBuilding = true;
  try {
    const standardsPath = path.join(__dirname, '..', 'shared', 'rag_services', '508_standards.txt');
    const standardsText = fs.readFileSync(standardsPath, 'utf8');
    logger.log('info', 'Building 508 standards vector index...', { tag: 'pipeline-v2', chars: standardsText.length });
    await vectorMatching.buildIndex(standardsText);
    indexReady = true;
    logger.log('info', `508 standards index built: ${vectorMatching.chunkTexts.length} chunks`, { tag: 'pipeline-v2' });
    return true;
  } catch (e) {
    logger.log('error', `Failed to build standards index: ${e.message}`, { tag: 'pipeline-v2' });
    indexBuilding = false;
    return false;
  }
}

// ══════════════════════════════════════════════════════════════════
// HELPER: Extract text from uploaded file
// ══════════════════════════════════════════════════════════════════

async function extractText(file) {
  const mime = file.mimetype;
  if (mime === 'application/pdf') {
    const { PDFParse } = require('pdf-parse');
    const pdf = new PDFParse({ data: new Uint8Array(file.buffer) });
    const result = await pdf.getText();
    const text = result.text;
    await pdf.destroy();
    return text;
  } else if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const mammoth = require('mammoth');
    const result = await mammoth.extractRawText({ buffer: file.buffer });
    return result.value;
  } else {
    return file.buffer.toString('utf8');
  }
}

// ══════════════════════════════════════════════════════════════════
// MAIN PIPELINE ROUTE
// ══════════════════════════════════════════════════════════════════

module.exports = function (pgPool) {
  return {
    /**
     * POST /api/pipeline-v2/analyze
     * Runs Laura's pipeline with SSE streaming
     */
    analyze: [upload.single('file'), async function (req, res) {
      // SSE setup
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no'
      });

      function sendEvent(event, data) {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      }

      // Select prompt set based on pipeline_version parameter
      const pipelineVersion = req.body.pipeline_version || 'v2';
      const activePrompts = pipelineVersion === 'v3' ? PROMPTS_V3 : PROMPTS;
      const pipelineLabel = pipelineVersion === 'v3' ? '3.0-far-grounded' : '2.0-laura';

      try {
        const startTime = Date.now();
        sendEvent('stage', { stage: 'init', message: `Pipeline ${pipelineVersion.toUpperCase()} starting...` });

        // ── Extract text ──────────────────────────────────────────
        let text = '';
        let fileName = 'pasted_text';

        if (req.file) {
          fileName = req.file.originalname || 'uploaded_file';
          sendEvent('stage', { stage: 'extract', message: `Extracting text from ${fileName}...` });
          text = await extractText(req.file);
        } else if (req.body.text) {
          text = req.body.text;
          fileName = 'pasted_text';
        }

        if (!text || text.length < 10) {
          sendEvent('error', { error: 'Text too short or missing. Upload a valid document.' });
          return res.end();
        }

        sendEvent('stage', { stage: 'extract_done', message: `Extracted ${text.length} characters`, chars: text.length });

        // ── ML Prediction (parallel) ──────────────────────────────
        sendEvent('stage', { stage: 'ml_start', message: 'Running ML compliance model...' });
        const mlPromise = runMlPrediction(text, fileName);

        // ── Stage 1a: Machine Readability ─────────────────────────
        sendEvent('stage', { stage: 'machine_readable', message: 'Checking machine readability...' });
        let machineReadable = null;
        let machineReadableDebug = {};
        try {
          const systemPrompt = activePrompts.machineReadable.system;
          const userPrompt = activePrompts.machineReadable.user(text);
          const raw = await usaiAdapter.chatCompletion(systemPrompt, userPrompt, GEMINI_PRO, 3, 2000, 0.1);
          machineReadable = usaiAdapter.parseJsonResponse(raw);
          machineReadableDebug = { system_prompt: systemPrompt, user_prompt: userPrompt.substring(0, 500) + '...', raw_response: raw, parsed: machineReadable };
          sendEvent('stage', { stage: 'machine_readable_done', message: `Machine readable: ${machineReadable?.is_machine_readable}`, data: machineReadable, debug: machineReadableDebug });
        } catch (e) {
          sendEvent('stage', { stage: 'machine_readable_error', message: `Machine readability check failed: ${e.message}` });
        }

        // ── GATE 1: Stop if not machine readable ─────────────────
        if (machineReadable && machineReadable.is_machine_readable === false) {
          const mlResult = await mlPromise;
          const totalTime = Date.now() - startTime;
          const finalResult = {
            pipeline_version: pipelineLabel,
            pipeline_name: pipelineLabel,
            file_name: fileName,
            generated_at: new Date().toISOString(),
            processing_time_ms: totalTime,
            stopped_at_gate: 'machine_readable',
            gate_message: 'This document is not machine readable. Machine readability is a prerequisite for analysis.',
            ml_prediction: mlResult,
            machine_readable: machineReadable,
            is_solicitation: null,
            applicability: null,
            ict_classification: null,
            vector_matches: null,
            document_summary: null,
            debug: { machine_readable: machineReadableDebug }
          };
          sendEvent('stage', { stage: 'gate_stop', message: 'STOPPED: Document is not machine readable.' });
          sendEvent('complete', finalResult);
          try {
            await pgPool.query(
              `INSERT INTO adhoc_analysis_log (file_name, ml_prediction, is_508_applicable, pipeline_version, created_at)
               VALUES ($1, $2, $3, $4, NOW())`,
              [fileName, mlResult.prediction, null, '2.0-laura']
            );
          } catch (e) {}
          return res.end();
        }

        // ── Stage 1b: Is Solicitation ─────────────────────────────
        sendEvent('stage', { stage: 'is_solicitation', message: 'Checking if document is a solicitation...' });
        let isSolicitation = null;
        let isSolicitationDebug = {};
        try {
          const systemPrompt = activePrompts.isSolicitation.system;
          const userPrompt = activePrompts.isSolicitation.user(text);
          const raw = await usaiAdapter.chatCompletion(systemPrompt, userPrompt, GEMINI_PRO, 3, 2000, 0.1);
          isSolicitation = usaiAdapter.parseJsonResponse(raw);
          isSolicitationDebug = { system_prompt: systemPrompt, user_prompt: userPrompt.substring(0, 500) + '...', raw_response: raw, parsed: isSolicitation };
          sendEvent('stage', { stage: 'is_solicitation_done', message: `Is solicitation: ${isSolicitation?.is_solicitation}`, data: isSolicitation, debug: isSolicitationDebug });
        } catch (e) {
          sendEvent('stage', { stage: 'is_solicitation_error', message: `Solicitation check failed: ${e.message}` });
        }

        // ── GATE: Stop if not a solicitation ──────────────────────
        if (isSolicitation && isSolicitation.is_solicitation === false) {
          const mlResult = await mlPromise;
          const totalTime = Date.now() - startTime;
          const finalResult = {
            pipeline_version: pipelineLabel,
            pipeline_name: pipelineLabel,
            file_name: fileName,
            generated_at: new Date().toISOString(),
            processing_time_ms: totalTime,
            stopped_at_gate: 'is_solicitation',
            gate_message: 'This document is not a solicitation. No further analysis performed.',
            ml_prediction: mlResult,
            machine_readable: machineReadable,
            is_solicitation: isSolicitation,
            applicability: null,
            ict_classification: null,
            vector_matches: null,
            document_summary: null,
            debug: {
              machine_readable: machineReadableDebug,
              is_solicitation: isSolicitationDebug
            }
          };
          sendEvent('stage', { stage: 'gate_stop', message: 'STOPPED: Document is not a solicitation. No further analysis.' });
          sendEvent('complete', finalResult);
          try {
            await pgPool.query(
              `INSERT INTO adhoc_analysis_log (file_name, ml_prediction, is_508_applicable, pipeline_version, created_at)
               VALUES ($1, $2, $3, $4, NOW())`,
              [fileName, mlResult.prediction, null, '2.0-laura']
            );
          } catch (e) {}
          return res.end();
        }

        // ── Stage 2: 508 Applicability ────────────────────────────
        sendEvent('stage', { stage: 'applicability', message: 'Assessing Section 508 applicability...' });
        let applicability = null;
        let applicabilityDebug = {};
        try {
          const systemPrompt = activePrompts.applicability.system;
          const userPrompt = activePrompts.applicability.user(text);
          const raw = await usaiAdapter.chatCompletion(systemPrompt, userPrompt, GEMINI_PRO, 3, 2000, 0.1);
          applicability = usaiAdapter.parseJsonResponse(raw);
          applicabilityDebug = { system_prompt: systemPrompt, user_prompt: userPrompt.substring(0, 500) + '...', raw_response: raw, parsed: applicability };
          sendEvent('stage', { stage: 'applicability_done', message: `508 Applicable: ${applicability?.is_508_applicable}`, data: applicability, debug: applicabilityDebug });
        } catch (e) {
          sendEvent('stage', { stage: 'applicability_error', message: `Applicability failed: ${e.message}` });
        }

        // ── Stage 3: ICT Classification ───────────────────────────
        sendEvent('stage', { stage: 'ict', message: 'Classifying ICT types...' });
        let ictClassification = null;
        let ictDebug = {};
        try {
          const systemPrompt = activePrompts.ictClassification.system;
          const userPrompt = activePrompts.ictClassification.user(text);
          const raw = await usaiAdapter.chatCompletion(systemPrompt, userPrompt, GEMINI_PRO, 3, 2000, 0.3);
          ictClassification = usaiAdapter.parseJsonResponse(raw);
          ictDebug = { system_prompt: systemPrompt, user_prompt: userPrompt.substring(0, 500) + '...', raw_response: raw, parsed: ictClassification };
          sendEvent('stage', { stage: 'ict_done', message: 'ICT classification complete', data: ictClassification, debug: ictDebug });
        } catch (e) {
          sendEvent('stage', { stage: 'ict_error', message: `ICT classification failed: ${e.message}` });
        }

        // ── Stage 4: Vector Match Analysis ────────────────────────
        sendEvent('stage', { stage: 'vector', message: 'Running vector match analysis against 508 standards...' });
        let vectorResults = null;
        try {
          const indexOk = await ensureIndex();
          if (indexOk) {
            vectorResults = await vectorMatching.runVectorMatching(text, 0.40);
            sendEvent('stage', { 
              stage: 'vector_done', 
              message: `Found ${vectorResults.matches_found} matches (${vectorResults.matches.filter(m => m.llm_meaningful).length} meaningful)`,
              data: { 
                matches_found: vectorResults.matches_found, 
                meaningful: vectorResults.matches.filter(m => m.llm_meaningful).length,
                match_strength: vectorResults.match_strength
              }
            });
          } else {
            sendEvent('stage', { stage: 'vector_error', message: 'Standards index not available — skipping vector matching' });
          }
        } catch (e) {
          sendEvent('stage', { stage: 'vector_error', message: `Vector matching failed: ${e.message}` });
        }

        // ── Stage 5: Document Summary ─────────────────────────────
        sendEvent('stage', { stage: 'summary', message: 'Generating document summary...' });
        let documentSummary = null;
        let summaryDebug = {};
        try {
          const analysisContext = {
            applicability: applicability,
            ict: ictClassification,
            vector_matching: vectorResults ? {
              matches_found: vectorResults.matches_found,
              meaningful_matches: vectorResults.matches.filter(m => m.llm_meaningful).length,
              match_strength: vectorResults.match_strength,
              top_matches: vectorResults.matches.slice(0, 5).map(m => ({
                solicitation_text: m.chunk_text,
                standard_text: m.matched_standard,
                similarity: m.similarity_score,
                meaningful: m.llm_meaningful,
                reason: m.llm_reason
              }))
            } : null
          };

          const systemPrompt = activePrompts.documentSummary.system;
          const userPrompt = activePrompts.documentSummary.user(analysisContext);
          const raw = await usaiAdapter.chatCompletion(systemPrompt, userPrompt, GEMINI_PRO);
          documentSummary = usaiAdapter.parseJsonResponse(raw);
          summaryDebug = { system_prompt: systemPrompt, user_prompt: userPrompt.substring(0, 1000) + '...', raw_response: raw, parsed: documentSummary };
          sendEvent('stage', { stage: 'summary_done', message: 'Document summary complete', data: documentSummary, debug: summaryDebug });
        } catch (e) {
          sendEvent('stage', { stage: 'summary_error', message: `Summary failed: ${e.message}` });
        }

        // ── Await ML result ───────────────────────────────────────
        const mlResult = await mlPromise;
        sendEvent('stage', { stage: 'ml_done', message: `ML prediction: ${mlResult.prediction}`, data: mlResult });

        // ── Final output ──────────────────────────────────────────
        const totalTime = Date.now() - startTime;
        const finalResult = {
          pipeline_version: pipelineLabel,
          pipeline_name: pipelineLabel,
          file_name: fileName,
          generated_at: new Date().toISOString(),
          processing_time_ms: totalTime,
          ml_prediction: mlResult,
          machine_readable: machineReadable,
          is_solicitation: isSolicitation,
          applicability: applicability,
          ict_classification: ictClassification,
          vector_matches: vectorResults ? {
            matches_found: vectorResults.matches_found,
            meaningful_matches: vectorResults.matches.filter(m => m.llm_meaningful).length,
            match_strength: vectorResults.match_strength,
            matches: vectorResults.matches.slice(0, 10),
            llm_analysis: vectorResults.llm_analysis,
            processing_stats: vectorResults.processing_stats
          } : null,
          document_summary: documentSummary,
          debug: {
            machine_readable: machineReadableDebug,
            is_solicitation: isSolicitationDebug,
            applicability: applicabilityDebug,
            ict: ictDebug,
            summary: summaryDebug,
            vector_validation: vectorResults?.llm_analysis || null
          }
        };

        sendEvent('complete', finalResult);

        // Log to DB
        try {
          await pgPool.query(
            `INSERT INTO adhoc_analysis_log (file_name, ml_prediction, is_508_applicable, pipeline_version, created_at)
             VALUES ($1, $2, $3, $4, NOW())`,
            [fileName, mlResult.prediction, applicability?.is_508_applicable ?? null, '2.0-laura']
          );
        } catch (e) {
          logger.log('warn', 'Failed to log pipeline-v2 analysis', { error: e.message, tag: 'pipeline-v2' });
        }

        res.end();
      } catch (err) {
        logger.log('error', 'Pipeline V2 fatal error', { error: err.message, stack: err.stack, tag: 'pipeline-v2' });
        sendEvent('error', { error: `Pipeline error: ${err.message}` });
        res.end();
      }
    }]
  };
};
