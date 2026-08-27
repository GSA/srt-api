#!/usr/bin/env python3
"""
bm25_508_screener.py
--------------------
Section 508 compliance BM25 triage screener.

Reads a CSV manifest (solicitation_id, compliant) and resolves each document
from the structured solicitation_data directory, checking BOTH compliant/ and
non_compliant/ subdirectories regardless of the CSV label — mismatches are
flagged in the output.

Directory structure expected:
    solicitation_data/
        compliant/{solicitation_id}/          ← folder containing doc files
        non_compliant/{solicitation_id}/

Supported file formats: .pdf, .docx, .doc, .txt
Non-PDF files are converted to plaintext and saved under extracted_txt/.

Outputs:
    results.json   – full structured output, LLM-ready chunks per document
    results.csv    – flat summary for spreadsheet review

Usage:
    python bm25_508_screener.py --manifest solicitations.csv [options]

Options:
    --manifest    PATH    CSV with columns: solicitation_id, compliant
    --data-dir    PATH    Root of solicitation_data/ (default: solicitation_data)
    --standards   PATH    Path to standards.txt  (default: standards.txt)
    --keywords    PATH    Path to keyword_hits.csv (default: keyword_hits.csv)
    --output-dir  PATH    Directory for output files (default: .)
    --low         FLOAT   Low/Medium BM25 threshold  (default: 0.25)
    --high        FLOAT   Medium/High BM25 threshold (default: 0.60)
    --window      INT     Context window chars around keyword hits (default: 1500)
"""

import re
import sys
import csv
import json
import math
import string
import logging
import argparse
import subprocess
import tempfile
from pathlib import Path
from collections import Counter
from stop_words import get_stop_words
# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Stopwords
# ---------------------------------------------------------------------------
STOPWORDS = get_stop_words('en')
# ---------------------------------------------------------------------------
# Default 508 keyword phrases (augmented by keyword_hits.csv at runtime)
# ---------------------------------------------------------------------------
DEFAULT_KEYWORDS: list[tuple[str, float]] = [
    ("section 508", 10.0),
    ("508 compliance", 5.0),
    ("508 conformance", 3.0),
    ("rehabilitation act", 3.0),
    ("vpat",           2.5),
    ("wcag",           2.0),
    ("852.239-75", 5.0),
    ("852.239-76", 5.0),
    ("852.239-70", 5.0),
    ("352.239-79", 5.0),
    ("352.239-73", 5.0),
    ("FAR 39.203", 5.0),
    ("FAR 39.204", 5.0),
    ("FAR 39.205", 5.0),
    ("FAR 7.103(q)", 5.0),
    ("FAR 10.001(a)(3)(ix)", 5.0),
    ("FAR 11.002(f)", 5.0),
    ("FAR 12.202(d)", 5.0),
    ("FAR Subpart 39.2", 5.0),

    ("accessibility standards", 1.0),
    ("voluntary product accessibility template", 1.0),
    ("assistive technology", 1.0),
    ("screen reader", 1.0),
    ("keyboard navigation", 1.0),
    ("electronic and information technology", 1.0),
    ("information and communication technology", 1.0),
    ("undue burden", 1.0),
    ("functional performance criteria", 1.0),
    ("technical standards", 1.0),
    ("support documentation", 1.0),
    ("closed functionality", 1.0),
    ("perceivable", 1.0),
    ("understandable", 1.0),
    ("alternative text", 1.0),
    ("alt text", 1.0),
    ("audio description", 1.0),
    ("accessibility notice", 1.0),
]


import re
def clean_pdf_text(text: str) -> str:
    """
    Fix PDFs where text extraction produces one word per line
    with blank lines between each word.
    Pattern looks like:
        'Western'
        ''
        'Acquisition'
        ''
        'Division'
    """
    lines = text.splitlines()
    non_empty = [l.strip() for l in lines if l.strip()]

    if not non_empty:
        return text

    # Detect fragmentation — check ratio of single-token non-empty lines
    single_token_lines = sum(1 for l in non_empty if len(l.split()) <= 1)
    fragmentation_ratio = single_token_lines / len(non_empty)

    if fragmentation_ratio < 0.40:
        return text

    # --- Fragmented doc detected ---
    # Strategy: walk line by line, accumulate words into a buffer.
    # A "real" paragraph break is 2+ consecutive blank lines.
    # A single blank line between single words is just extraction noise.
    result  = []
    buffer  = []
    blank_count = 0

    for line in lines:
        stripped = line.strip()

        if not stripped:
            blank_count += 1
            # Two or more consecutive blanks = real paragraph boundary
            if blank_count >= 2 and buffer:
                result.append(" ".join(buffer))
                buffer = []
                result.append("")
        else:
            blank_count = 0
            # If this line has multiple words it might be a header/sentence
            # on its own — flush buffer first, add as its own paragraph
            words = stripped.split()
            if len(words) > 6 and buffer:
                # Long line — likely a real sentence, flush and start fresh
                result.append(" ".join(buffer))
                buffer = []
                result.append(stripped)
            else:
                buffer.extend(words)

    # Flush any remaining buffer
    if buffer:
        result.append(" ".join(buffer))

    cleaned = "\n\n".join(p for p in result if p)

    # Fix spaces before punctuation: "contract ." → "contract."
    cleaned = re.sub(r'\s+([.,;:!?)\]])', r'\1', cleaned)

    # Fix hyphenated splits: "acces- sibility" → "accessibility"
    cleaned = re.sub(r'(\w)-\s+(\w)', r'\1\2', cleaned)

    # Collapse excessive internal spaces (double-space from PDF columns)
    cleaned = re.sub(r'  +', ' ', cleaned)

    return cleaned.strip()

# ---------------------------------------------------------------------------
# Solicitation manifest loading & directory resolution
# ---------------------------------------------------------------------------
 
class SolicitationRecord:
    """Holds everything known about one solicitation from the CSV + filesystem."""
 
    def __init__(
        self,
        solicitation_id: str,
        csv_compliant: bool,
        resolved_path: Path | None,
        actual_dir: str | None,
        location_mismatch: bool,
        missing: bool,
    ):
        self.solicitation_id = solicitation_id
        self.csv_compliant    = csv_compliant       # label from the CSV
        self.resolved_path    = resolved_path       # directory on disk
        self.actual_dir       = actual_dir          # "compliant" | "non_compliant" | None
        self.location_mismatch = location_mismatch  # CSV label vs actual dir disagree
        self.missing          = missing             # not found in either directory
 
 
def _parse_bool(value: str) -> bool:
    return value.strip().lower() in ("true", "1", "yes", "t", "y")
 
 
def load_manifest(csv_path: Path) -> list[SolicitationRecord]:
    """
    Parse the manifest CSV.  Accepts common column-name variants
    (case-insensitive):
        solicitation_id / id / solicitation
        compliant / complaint / is_compliant / label
    """
    records = []
    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        if reader.fieldnames is None:
            log.error("Manifest CSV appears to be empty: %s", csv_path)
            sys.exit(1)
 
        fields_lower = {h.lower().strip(): h for h in reader.fieldnames}
 
        id_col = next(
            (fields_lower[k] for k in ("solicitation_id", "id", "solicitation")
             if k in fields_lower),
            None,
        )
        compliant_col = next(
            (fields_lower[k] for k in ("compliant", "complaint", "is_compliant", "label")
             if k in fields_lower),
            None,
        )
 
        if not id_col:
            log.error("No solicitation_id column found in %s. Columns: %s",
                      csv_path, list(reader.fieldnames))
            sys.exit(1)
        if not compliant_col:
            log.error("No compliant column found in %s. Columns: %s",
                      csv_path, list(reader.fieldnames))
            sys.exit(1)
 
        log.info("Manifest columns → id: '%s'  compliant: '%s'", id_col, compliant_col)
 
        for row in reader:
            sol_id = row[id_col].strip()
            if not sol_id:
                continue
            records.append(
                SolicitationRecord(
                    solicitation_id=sol_id,
                    csv_compliant=_parse_bool(row.get(compliant_col, "false")),
                    resolved_path=None,
                    actual_dir=None,
                    location_mismatch=False,
                    missing=True,
                )
            )
 
    log.info("Loaded %d solicitation IDs from manifest", len(records))
    return records
 
 
def resolve_solicitation_paths(records: list[SolicitationRecord], data_root: Path) -> None:
    """
    For every record, search BOTH compliant/ and non_compliant/ directories.
    Updates records in-place.  Mismatches between CSV label and actual location
    are logged as warnings and flagged in the record.
    """
    compliant_root     = data_root / "compliant"
    non_compliant_root = data_root / "non_compliant"
 
    for rec in records:
        sid = rec.solicitation_id
        found_in: list[tuple[str, Path]] = []
 
        for dir_label, dir_root in [
            ("compliant",     compliant_root),
            ("non_compliant", non_compliant_root),
        ]:
            candidate = dir_root / sid
            if candidate.exists() and candidate.is_dir():
                found_in.append((dir_label, candidate))
 
        if not found_in:
            rec.missing = True
            log.warning("NOT FOUND in either directory: %s", sid)
            continue
 
        if len(found_in) > 1:
            log.warning(
                "Solicitation %s found in BOTH directories — using compliant/ copy", sid
            )
 
        actual_label, actual_path = found_in[0]
 
        rec.missing        = False
        rec.resolved_path  = actual_path
        rec.actual_dir     = actual_label
 
        expected_label = "compliant" if rec.csv_compliant else "non_compliant"
        rec.location_mismatch = (actual_label != expected_label)
 
        if rec.location_mismatch:
            log.warning(
                "LOCATION MISMATCH  %s: CSV says '%s' but file is in '%s/'",
                sid, expected_label, actual_label,
            )
 
 
SUPPORTED_EXTENSIONS = {".pdf", ".docx", ".doc", ".txt", ".text"}
 
 
def collect_files_from_dir(directory: Path) -> list[Path]:
    """Return all supported document files within a solicitation directory."""
    return sorted(
        p for p in directory.rglob("*")
        if p.is_file() and p.suffix.lower() in SUPPORTED_EXTENSIONS
    )
 
 
# ---------------------------------------------------------------------------
# Text extraction
# ---------------------------------------------------------------------------
 
def _run(cmd: list[str], timeout: int = 60) -> str:
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            timeout=timeout,
            # Force UTF-8 on all platforms — avoids Windows cp1252 codec errors
            # when tools like pandoc emit non-ASCII characters
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        stdout = result.stdout.decode("utf-8", errors="replace")
        stderr = result.stderr.decode("utf-8", errors="replace")
        if result.returncode != 0:
            log.warning("Command %s exited %d: %s",
                        cmd[0], result.returncode, stderr[:200])
        return stdout
    except FileNotFoundError:
        log.warning("Command not found: %s", cmd[0])
        return ""
    except subprocess.TimeoutExpired:
        log.warning("Command timed out: %s", " ".join(cmd))
        return ""
 
 
def extract_text_from_pdf(path: Path) -> str:
    try:
        from pypdf import PdfReader
        reader = PdfReader(str(path))
        pages = []
        for page in reader.pages:
            try:
                pages.append(page.extract_text() or "")
            except Exception:
                pages.append("")
        return clean_pdf_text("\n".join(pages))
    except ImportError:
        log.warning("pypdf not installed — falling back to raw byte regex for %s", path.name)
        return _extract_pdf_raw(path)
 
 
def _extract_pdf_raw(path: Path) -> str:
    try:
        raw    = path.read_bytes()
        chunks = re.findall(rb'\(([^)]{1,400})\)', raw)
        parts  = []
        for chunk in chunks:
            try:
                parts.append(chunk.decode("latin-1"))
            except Exception:
                pass
        return " ".join(parts)
    except Exception as e:
        log.error("Raw PDF extraction failed for %s: %s", path.name, e)
        return ""
 
def extract_text_from_docx(path: Path) -> str:
    # pandoc (best quality) — stdout may be None if pandoc not installed
    try:
        text = _run(["pandoc", "--track-changes=all", str(path), "-t", "plain"]) or ""
        if text.strip():
            return text
    except Exception as e:
        log.warning("pandoc failed for %s: %s", path.name, e)
 
    # python-docx fallback — paragraphs may contain None text
    try:
        import docx  # type: ignore
        doc = docx.Document(str(path))
        parts = []
        for p in doc.paragraphs:
            t = p.text
            if t is not None:
                parts.append(t)
        text = "\n".join(parts)
        if text.strip():
            return text
    except ImportError:
        pass
    except Exception as e:
        log.warning("python-docx failed for %s: %s", path.name, e)
 
    # raw XML unzip last resort — decode bytes safely
    try:
        import zipfile
        with zipfile.ZipFile(path) as zf:
            if "word/document.xml" in zf.namelist():
                raw = zf.read("word/document.xml")
                # Try UTF-8 first, fall back to latin-1 which never fails
                try:
                    xml = raw.decode("utf-8")
                except UnicodeDecodeError:
                    xml = raw.decode("latin-1")
                text = " ".join(re.findall(r'<w:t[^>]*>([^<]+)</w:t>', xml))
                if text.strip():
                    return text
    except Exception as e:
        log.error("DOCX zip extraction failed for %s: %s", path.name, e)
 
    log.error("All extraction methods failed for %s", path.name)
    return ""
 
 
def extract_text_from_doc(path: Path) -> str:
    with tempfile.TemporaryDirectory() as tmpdir:
        _run(["libreoffice", "--headless", "--convert-to", "docx",
              "--outdir", tmpdir, str(path)])
        converted = list(Path(tmpdir).glob("*.docx"))
        if converted:
            return extract_text_from_docx(converted[0])
    text = _run(["antiword", str(path)])
    if text.strip():
        return text
    log.error("Could not extract text from .doc file: %s", path.name)
    return ""
 
 
def extract_text(path: Path) -> str:
    suffix = path.suffix.lower()
    if suffix == ".pdf":
        return extract_text_from_pdf(path)
    elif suffix == ".docx":
        return extract_text_from_docx(path)
    elif suffix == ".doc":
        return extract_text_from_doc(path)
    elif suffix in (".txt", ".text"):
        return path.read_text(encoding="utf-8", errors="replace")
    else:
        log.warning("Unsupported type %s — attempting plaintext read", suffix)
        return path.read_text(encoding="utf-8", errors="replace")
 
 
def save_as_txt(solicitation_id: str, text: str, output_dir: Path) -> Path:
    txt_dir = output_dir / "extracted_txt"
    txt_dir.mkdir(parents=True, exist_ok=True)
    out = txt_dir / f"{solicitation_id}.txt"
    out.write_text(text, encoding="utf-8")
    return out
 
 
# ---------------------------------------------------------------------------
# Tokenization & n-grams
# ---------------------------------------------------------------------------
 
def tokenize(text: str) -> list[str]:
    text = text.lower()
    text = text.translate(str.maketrans(string.punctuation, " " * len(string.punctuation)))
    return [t for t in text.split() if t and t not in STOPWORDS and len(t) > 1]
 
 
def make_ngrams(tokens: list[str], max_n: int = 3) -> list[str]:
    ngrams = list(tokens)
    for n in range(2, max_n + 1):
        for i in range(len(tokens) - n + 1):
            ngrams.append("_".join(tokens[i:i + n]))
    return ngrams
 
 
# ---------------------------------------------------------------------------
# Keyword / standards loading
# ---------------------------------------------------------------------------
 
def load_keywords_from_csv(path: Path) -> list[tuple[str, float]]:
    """
    Load keywords from CSV. Accepts an optional second column for weight.
    Defaults to 1.0 if no weight column is present.
    """
    keywords = []
    try:
        with open(path, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            fields_lower = {h.lower().strip() for h in (reader.fieldnames or [])}
            has_weight = "weight" in fields_lower
            for row in reader:
                kw = list(row.values())[0].strip()
                if not kw or kw.lower() in ("keyword", "phrase", "term", "keywords"):
                    continue
                weight = 1.0
                if has_weight:
                    try:
                        weight = float(row.get("weight", 1.0))
                    except (ValueError, TypeError):
                        weight = 1.0
                keywords.append((kw, weight))
    except FileNotFoundError:
        log.warning("keyword_hits.csv not found at %s — using built-in defaults only", path)
    return keywords
 
 
def load_standards_terms(path: Path) -> list[str]:
    try:
        text  = path.read_text(encoding="utf-8", errors="replace")
        tokens = tokenize(text)
        freq  = Counter(tokens)
        return [t for t, c in freq.most_common(200) if c > 1 and len(t) > 3]
    except FileNotFoundError:
        log.warning("standards.txt not found at %s", path)
        return []
 
 
def build_query_terms(keywords: list[tuple[str, float]]) -> list[tuple[str, float]]:
    """
    Expand keyword phrases into n-gram query terms, preserving weights.
    If the same term appears in multiple keywords, the highest weight wins.
    Returns list of (term, weight) tuples.
    """
    seen: dict[str, float] = {}
    for kw, weight in keywords:
        for term in make_ngrams(tokenize(kw)):
            if term not in seen or weight > seen[term]:
                seen[term] = weight
    return list(seen.items())
 
 
# ---------------------------------------------------------------------------
# BM25
# ---------------------------------------------------------------------------
 
class BM25:
    def __init__(self, k1: float = 1.5, b: float = 0.75):
        self.k1 = k1
        self.b  = b
        self._doc_freqs: list[Counter] = []
        self._df:   Counter = Counter()
        self._avgdl: float  = 0.0
        self._n:     int    = 0
 
    def fit(self, corpus_tokens: list[list[str]]) -> "BM25":
        self._n        = len(corpus_tokens)
        self._doc_freqs = [Counter(toks) for toks in corpus_tokens]
        self._df       = Counter()
        total_len      = 0
        for freq in self._doc_freqs:
            total_len += sum(freq.values())
            for term in freq:
                self._df[term] += 1
        self._avgdl = total_len / self._n if self._n else 1.0
        return self
 
    def score(self, doc_idx: int, query_terms: list[tuple[str, float]]) -> float:
        freq  = self._doc_freqs[doc_idx]
        dl    = sum(freq.values())
        score = 0.0
        for term, weight in query_terms:
            if term not in freq:
                continue
            tf  = freq[term]
            df  = self._df.get(term, 0)
            idf = math.log((self._n - df + 0.5) / (df + 0.5) + 1)
            tf_norm = (tf * (self.k1 + 1)) / (
                tf + self.k1 * (1 - self.b + self.b * dl / self._avgdl)
            )
            score += idf * tf_norm * weight
        return score
 
    def score_all(self, query_terms: list[tuple[str, float]]) -> list[float]:
        return [self.score(i, query_terms) for i in range(self._n)]
 
 
# ---------------------------------------------------------------------------
# Keyword-anchored chunking
# ---------------------------------------------------------------------------
 
def _is_regex(pattern: str) -> bool:
    """
    Return True if the string looks like a regex rather than a plain phrase.
    Detects common regex metacharacters that would never appear in a plain
    keyword: \b \s \d . * + ? ( ) [ ] { } ^ $
    """
    regex_indicators = (r'\b', r'\s', r'\d', r'\w', r'\S', r'\D',
                        r'(?', r'(?:', r'(?i', r'(?=',
                        '.*', '.+', r'\+', r'\*')
    # Also flag bare metacharacters that plain phrases don't use
    bare_meta = re.compile(r'(?<!\\)[*+?|^$(){\[\]]')
    return any(ind in pattern for ind in regex_indicators) or bool(bare_meta.search(pattern))
 
 
def _compile_keyword(kw: str) -> tuple[re.Pattern, bool]:
    """
    Compile a keyword to a regex Pattern.
    - If it looks like a regex, compile it case-insensitively as-is.
    - Otherwise escape it and match case-insensitively (replaces the old
      kw.lower() + text_lower approach so plain phrases still work).
    Returns (compiled_pattern, is_regex_flag).
    """
    if _is_regex(kw):
        try:
            return re.compile(kw, re.IGNORECASE), True
        except re.error as e:
            log.warning("Invalid regex keyword %r (%s) — falling back to literal match", kw, e)
    return re.compile(re.escape(kw), re.IGNORECASE), False
 
 
def extract_relevant_chunks(
    text: str,
    keywords: list[tuple[str, float]],
    window_chars: int = 1500,
) -> list[dict]:
    hits: list[tuple[int, int, str]] = []
 
    for kw, _weight in keywords:
        pattern, _ = _compile_keyword(kw)
        for m in pattern.finditer(text):
            hits.append((m.start(), m.end(), kw))
 
    if not hits:
        return []
 
    hits.sort(key=lambda x: x[0])
 
    windows = []
    for start, end, kw in hits:
        ws = max(0, start - window_chars // 2)
        we = min(len(text), end + window_chars // 2)
        windows.append((ws, we, kw, start))
 
    # Merge overlapping windows
    merged = []
    cs, ce, ckws, cpos = windows[0][0], windows[0][1], [windows[0][2]], [windows[0][3]]
    for ws, we, kw, pos in windows[1:]:
        if ws <= ce:
            ce = max(ce, we)
            ckws.append(kw)
            cpos.append(pos)
        else:
            merged.append((cs, ce, ckws, cpos))
            cs, ce, ckws, cpos = ws, we, [kw], [pos]
    merged.append((cs, ce, ckws, cpos))
 
    return [
        {
            "chunk_index":      idx,
            "char_start":       ws,
            "char_end":         we,
            "chunk_text":       text[ws:we],
            "keywords_found":   sorted(set(kws)),
            "keyword_hit_count": len(positions),
            "char_length":      we - ws,
        }
        for idx, (ws, we, kws, positions) in enumerate(merged)
    ]
 
 
# ---------------------------------------------------------------------------
# Bucket classification
# ---------------------------------------------------------------------------
 
def classify(norm: float, low: float, high: float) -> str:
    if norm < low:
        return "LOW"
    elif norm < high:
        return "MEDIUM"
    return "HIGH"
 
 
# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------
 
def run(args: argparse.Namespace) -> None:
    manifest_path = Path(args.manifest)
    data_root     = Path(args.data_dir)
    output_dir    = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
 
    # --- Keywords ---
    csv_keywords = load_keywords_from_csv(Path(args.keywords))
    _            = load_standards_terms(Path(args.standards))   # reserved for future weighting
    # Merge DEFAULT_KEYWORDS and csv_keywords; CSV weights override defaults for same phrase
    kw_map: dict[str, float] = {}
    for kw, weight in DEFAULT_KEYWORDS:
        kw_map[kw] = weight
    # for kw, weight in csv_keywords:
    #     kw_map[kw] = weight   # CSV takes precedence
    all_keywords: list[tuple[str, float]] = list(kw_map.items())
    query_terms  = build_query_terms(all_keywords)
    log.info("Keywords: %d phrases → %d BM25 query terms", len(all_keywords), len(query_terms))
 
    # --- Manifest + path resolution ---
    records  = load_manifest(manifest_path)
    resolve_solicitation_paths(records, data_root)
 
    found      = [r for r in records if not r.missing]
    missing    = [r for r in records if r.missing]
    mismatches = [r for r in found   if r.location_mismatch]
    log.info("Resolved: %d found, %d missing, %d location mismatches",
             len(found), len(missing), len(mismatches))
 
    if not found:
        log.error("No solicitation directories could be resolved. Exiting.")
        sys.exit(1)
 
    # --- Text extraction (one blob per solicitation; folder may have multiple files) ---
    sol_texts:  list[str]       = []
    sol_tokens: list[list[str]] = []
 
    extraction_failures: list[str] = []
 
    for rec in found:
        files = collect_files_from_dir(rec.resolved_path)
        if not files:
            log.warning("No documents found inside %s", rec.resolved_path)
            extraction_failures.append(rec.solicitation_id)
            sol_texts.append("")
            sol_tokens.append([])
            continue
 
        log.info("Extracting  %s  (%d file(s))", rec.solicitation_id, len(files))

        # Skip if already extracted
        existing = output_dir / 'extracted_txt' / (rec.solicitation_id + ".txt")
        if existing.exists():
            try:
                log.info("  → Already extracted: %s", existing.name)
                sol_texts.append(existing.read_text(encoding="utf-8", errors="replace"))
                sol_tokens.append(make_ngrams(tokenize(sol_texts[-1])))
                continue
            except:
                log.warning("  → Already extracted, but failed to read: %s", existing.name)
                extraction_failures.append(rec.solicitation_id)
                sol_texts.append("")
                sol_tokens.append([])
                continue

        parts = []
        for f in files:
            text = extract_text(f)
            if text.strip():
                parts.append(text)
            else:
                log.warning("  → No text from %s", f.name)
 
        combined = "\n\n".join(parts)
 
        if not combined.strip():
            log.warning("EXTRACTION FAILED — no text recovered: %s", rec.solicitation_id)
            extraction_failures.append(rec.solicitation_id)
            sol_texts.append("")
            sol_tokens.append([])
            continue
 
        # Always persist extracted text for inspection and caching
        out = save_as_txt(rec.solicitation_id, combined, output_dir)
        log.info("  → Saved extracted text: %s", out.name)
 
        sol_texts.append(combined)
        sol_tokens.append(make_ngrams(tokenize(combined)))
 
    # --- BM25 scoring ---
    bm25        = BM25(k1=1.5, b=0.75).fit(sol_tokens)
    raw_scores  = bm25.score_all(query_terms)
    sorted_scores = sorted(raw_scores)
    p95_idx  = int(len(sorted_scores) * 0.95)
    ceiling  = sorted_scores[p95_idx] if sorted_scores[p95_idx] > 0 else max(sorted_scores, default=1.0)
    log.info("Normalization ceiling (p95): %.4f  (max raw: %.4f)", ceiling, max(raw_scores, default=0))
    norm_scores = [min(s / ceiling, 1.0) for s in raw_scores]
 
    # --- Result assembly ---
    results = []
    counts  = Counter()
 
    for i, rec in enumerate(found):
        text   = sol_texts[i]
        norm   = norm_scores[i]
        raw    = raw_scores[i]
 
        # Skip scoring for documents where extraction completely failed
        if rec.solicitation_id in extraction_failures:
            log.warning("  %-36s  EXTRACTION_FAILED — excluded from scoring", rec.solicitation_id)
            results.append({
                "solicitation_id":       rec.solicitation_id,
                "csv_compliant":         rec.csv_compliant,
                "actual_directory":      rec.actual_dir,
                "location_mismatch":     rec.location_mismatch,
                "error":                 "EXTRACTION_FAILED",
                "bm25_raw_score":        None,
                "bm25_normalized_score": None,
                "bucket":                "EXTRACTION_FAILED",
                "has_508_content":       None,
                "chunk_count":           0,
                "total_chars_extracted": 0,
                "keyword_hit_summary":   {},
                "chunks":                [],
                "llm_evaluated":         False,
                "llm_determination":     None,
            })
            counts["EXTRACTION_FAILED"] += 1
            continue
 
        bucket = classify(norm, args.low, args.high)
        counts[bucket] += 1
 
        chunks = extract_relevant_chunks(text, all_keywords, window_chars=args.window)
 
        kw_hits: Counter = Counter()
        for chunk in chunks:
            for kw in chunk["keywords_found"]:
                kw_hits[kw] += 1
 
        mismatch_tag = "  ⚠ LOCATION MISMATCH" if rec.location_mismatch else ""
        log.info("  %-36s  score=%.3f  %-6s  chunks=%d%s",
                 rec.solicitation_id, norm, bucket, len(chunks), mismatch_tag)
 
        results.append({
            # Identity
            "solicitation_id":   rec.solicitation_id,
            "csv_compliant":     rec.csv_compliant,
            "actual_directory":  rec.actual_dir,
            "location_mismatch": rec.location_mismatch,
            # Scoring
            "bm25_raw_score":        round(raw, 4),
            "bm25_normalized_score": round(norm, 4),
            "bucket":                bucket,
            # Content
            "has_508_content":       len(chunks) > 0,
            "chunk_count":           len(chunks),
            "raw_text_chars":        len(text),
            "total_chars_extracted": sum(c["char_length"] for c in chunks),
            "keyword_hit_summary":   dict(kw_hits.most_common(20)),
            "chunks":                chunks,
            # LLM stage (populated downstream)
            "llm_evaluated":    False,
            "llm_determination": None,
        })
 
    # Append NOT_FOUND rows so every manifest entry appears in the output
    for rec in missing:
        results.append({
            "solicitation_id":       rec.solicitation_id,
            "csv_compliant":         rec.csv_compliant,
            "actual_directory":      None,
            "location_mismatch":     False,
            "error":                 "NOT_FOUND",
            "bm25_raw_score":        None,
            "bm25_normalized_score": None,
            "bucket":                "NOT_FOUND",
            "has_508_content":       None,
            "chunk_count":           0,
            "total_chars_extracted": 0,
            "keyword_hit_summary":   {},
            "chunks":                [],
            "llm_evaluated":         False,
            "llm_determination":     None,
        })
 
    # --- results.json ---
    json_out = output_dir / "results.json"
    with open(json_out, "w", encoding="utf-8") as f:
        json.dump(
            {
                "meta": {
                    "total_in_manifest":    len(records),
                    "resolved":             len(found),
                    "missing":              len(missing),
                    "location_mismatches":  len(mismatches),
                    "bucket_counts":        dict(counts),
                    "thresholds":           {"low": args.low, "high": args.high},
                    "query_term_count":     len(query_terms),
                    "keyword_phrase_count": len(all_keywords),
                },
                "documents": results,
            },
            f,
            indent=2,
            ensure_ascii=False,
        )
    log.info("Wrote %s", json_out)
 
    # --- results.csv ---
    csv_out = output_dir / "results.csv"
    csv_fields = [
        "solicitation_id", "csv_compliant", "actual_directory",
        "location_mismatch", "bm25_raw_score", "bm25_normalized_score",
        "bucket", "has_508_content", "chunk_count",
        "raw_text_chars", "total_chars_extracted",
    ]
    with open(csv_out, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=csv_fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(results)
    log.info("Wrote %s", csv_out)
 
    # --- Summary ---
    print("\n" + "=" * 62)
    print("  Section 508 BM25 Screening Complete")
    print("=" * 62)
    print(f"  Manifest entries     : {len(records)}")
    print(f"  Resolved             : {len(found)}")
    print(f"  Missing (not found)  : {len(missing)}")
    print(f"  Location mismatches  : {len(mismatches)}")
    print(f"  Extraction failures  : {counts['EXTRACTION_FAILED']}")
    print(f"  HIGH  (≥{args.high})          : {counts['HIGH']}")
    print(f"  MEDIUM ({args.low}–{args.high})       : {counts['MEDIUM']}")
    print(f"  LOW   (<{args.low})           : {counts['LOW']}")
    print(f"  Output               : {output_dir.resolve()}")
    print("=" * 62 + "\n")
 
    if mismatches:
        print("  ⚠  Location mismatches (CSV label ≠ actual directory):")
        for r in mismatches:
            expected = "compliant" if r.csv_compliant else "non_compliant"
            print(f"     {r.solicitation_id}  CSV→{expected}  disk→{r.actual_dir}")
        print()
 
    if missing:
        print("  ✗  Not found in either directory:")
        for r in missing:
            print(f"     {r.solicitation_id}")
        print()
 
    if extraction_failures:
        print("  ✗  Extraction failed (directory found but no text recovered):")
        for sid in extraction_failures:
            print(f"     {sid}")
        print()
 
 
# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Section 508 BM25 screener — CSV manifest + solicitation_data/ tree"
    )
    manifest = "data/parser_data.csv"
    subset = 'data/compliant__subset_medium_to_low_no_chunks.csv'
    # 'data/test.csv'
    parser.add_argument(
        "--manifest", default= 'data/test.csv',
        help="CSV file with columns: solicitation_id, compliant",
    )
   
    parser.add_argument(
        "--data-dir", default="../solicitation_data", dest="data_dir",
        help="Root dir containing compliant/ and non_compliant/ (default: solicitation_data)",
    )
    parser.add_argument("--standards",  default="../data/508_standards.txt")
 
    parser.add_argument("--keywords",   default="../data/claude_generated/keyword_patterns.csv")  

    parser.add_argument("--output-dir", default="output_dir", dest="output_dir")
    parser.add_argument("--low",    type=float, default=0.25)
    parser.add_argument("--high",   type=float, default=0.60)
    parser.add_argument("--window", type=int,   default=1500,
                        help="Context window chars per keyword hit (default: 1500)")
    return parser.parse_args()


if __name__ == "__main__":
    run(parse_args())