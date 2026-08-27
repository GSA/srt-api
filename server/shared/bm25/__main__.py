#!/usr/bin/env python3
"""
BM25 + ML Model — Section 508 Compliance Predictor

David's two-stage pipeline:
  1. BM25 screener: scores document, extracts keyword-anchored chunks
  2. ML model (Logistic Regression + TF-IDF): makes final compliance prediction

Accepts JSON via stdin: {"text": "document text here"}
Returns JSON via stdout with prediction, confidence, BM25 evidence.
"""

import json
import math
import re
import string
import sys
import os
from collections import Counter
from pathlib import Path

import numpy as np
import joblib
from scipy.sparse import hstack, csr_matrix

try:
    from stop_words import get_stop_words
    STOPWORDS = set(get_stop_words('en'))
except ImportError:
    STOPWORDS = set('a an the is are was were be been being have has had do does did will would shall should may might can could'.split())

# ── Key indicators (must match training) ──────────────────────────────────────

KEY_INDICATORS = [
    "section 508", "852.239-75", "352.239-79", "352.239-73", "352.239-70",
    "wcag", "vpat", "rehabilitation act", "accessibility notice",
]

# ── Keywords (from David's DEFAULT_KEYWORDS) ──────────────────────────────────

DEFAULT_KEYWORDS = [
    ("section 508", 10.0),
    ("508 compliance", 5.0),
    ("508 conformance", 3.0),
    ("rehabilitation act", 3.0),
    ("vpat", 2.5),
    ("wcag", 2.0),
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

# ── Tokenization ──────────────────────────────────────────────────────────────

def tokenize(text):
    text = text.lower()
    text = text.translate(str.maketrans(string.punctuation, " " * len(string.punctuation)))
    return [t for t in text.split() if t and t not in STOPWORDS and len(t) > 1]


def make_ngrams(tokens, max_n=3):
    ngrams = list(tokens)
    for n in range(2, max_n + 1):
        for i in range(len(tokens) - n + 1):
            ngrams.append("_".join(tokens[i:i + n]))
    return ngrams


# ── BM25 ──────────────────────────────────────────────────────────────────────

class BM25:
    def __init__(self, k1=1.5, b=0.75):
        self.k1 = k1
        self.b = b

    def fit(self, corpus_tokens):
        self._n = len(corpus_tokens)
        self._doc_freqs = [Counter(toks) for toks in corpus_tokens]
        self._df = Counter()
        total_len = 0
        for freq in self._doc_freqs:
            total_len += sum(freq.values())
            for term in freq:
                self._df[term] += 1
        self._avgdl = total_len / self._n if self._n else 1.0
        return self

    def score(self, doc_idx, query_terms):
        freq = self._doc_freqs[doc_idx]
        dl = sum(freq.values())
        score = 0.0
        for term, weight in query_terms:
            if term not in freq:
                continue
            tf = freq[term]
            df = self._df.get(term, 0)
            idf = math.log((self._n - df + 0.5) / (df + 0.5) + 1)
            tf_norm = (tf * (self.k1 + 1)) / (
                tf + self.k1 * (1 - self.b + self.b * dl / self._avgdl)
            )
            score += idf * tf_norm * weight
        return score


def build_query_terms(keywords):
    seen = {}
    for kw, weight in keywords:
        for term in make_ngrams(tokenize(kw)):
            if term not in seen or weight > seen[term]:
                seen[term] = weight
    return list(seen.items())


# ── Keyword chunking ──────────────────────────────────────────────────────────

def extract_chunks(text, keywords, window_chars=1500):
    hits = []
    for kw, _weight in keywords:
        pattern = re.compile(re.escape(kw), re.IGNORECASE)
        for m in pattern.finditer(text):
            hits.append((m.start(), m.end(), kw))

    if not hits:
        return []

    hits.sort(key=lambda x: x[0])

    windows = []
    for start, end, kw in hits:
        ws = max(0, start - window_chars // 2)
        we = min(len(text), end + window_chars // 2)
        windows.append((ws, we, kw))

    merged = []
    cs, ce, ckws = windows[0][0], windows[0][1], [windows[0][2]]
    for ws, we, kw in windows[1:]:
        if ws <= ce:
            ce = max(ce, we)
            ckws.append(kw)
        else:
            merged.append((cs, ce, ckws))
            cs, ce, ckws = ws, we, [kw]
    merged.append((cs, ce, ckws))

    return [
        {
            "chunk_index": idx,
            "char_start": ws,
            "char_end": we,
            "chunk_text": text[ws:we],
            "keywords_found": sorted(set(kws)),
            "keyword_hit_count": len(kws),
            "char_length": we - ws,
        }
        for idx, (ws, we, kws) in enumerate(merged)
    ]


# ── Structured features (must match training exactly) ─────────────────────────

def structured_features(bm25_result):
    """Build the same structured feature vector as train_508_model.py"""
    kw = bm25_result.get("keyword_hits", {})
    return [
        bm25_result.get("bm25_normalized_score", 0.0),
        bm25_result.get("bm25_raw_score", 0.0),
        min(len(bm25_result.get("chunks", [])), 20),
        min(bm25_result.get("total_chars", 0) / 100000, 5.0),
        sum(kw.get(k, 0) for k in KEY_INDICATORS),
        1.0 if bm25_result.get("bucket") == "HIGH" else 0.0,
        1.0 if bm25_result.get("bucket") == "MEDIUM" else 0.0,
        1.0 if bm25_result.get("bucket") == "LOW" else 0.0,
        0.0,  # location_mismatch — always false for manual upload
        *[min(kw.get(k, 0), 10) for k in KEY_INDICATORS],
    ]


# ── BM25 scoring ─────────────────────────────────────────────────────────────

def run_bm25(text, low_threshold=0.25, high_threshold=0.60):
    """Run BM25 scoring and chunk extraction."""
    tokens = make_ngrams(tokenize(text))
    bm25 = BM25()
    bm25.fit([tokens])
    query_terms = build_query_terms(DEFAULT_KEYWORDS)
    raw_score = bm25.score(0, query_terms)

    # Normalize (using 100 as ceiling — will be overridden by ML model anyway)
    normalized = min(raw_score / 100.0, 1.0)

    if normalized < low_threshold:
        bucket = "LOW"
    elif normalized < high_threshold:
        bucket = "MEDIUM"
    else:
        bucket = "HIGH"

    # Keyword hits
    keyword_hits = {}
    for kw, _weight in DEFAULT_KEYWORDS:
        count = len(re.findall(re.escape(kw), text, re.IGNORECASE))
        if count > 0:
            keyword_hits[kw] = count

    # Chunks
    chunks = extract_chunks(text, DEFAULT_KEYWORDS)

    return {
        "bm25_raw_score": round(raw_score, 4),
        "bm25_normalized_score": round(normalized, 4),
        "bucket": bucket,
        "has_508_content": len(keyword_hits) > 0,
        "keyword_hits": keyword_hits,
        "chunks": chunks[:5],
        "total_chars": len(text),
    }


# ── ML Model prediction ──────────────────────────────────────────────────────

def predict_with_model(text, bm25_result, model_path):
    """Load David's trained model and predict compliance."""
    bundle = joblib.load(model_path)
    model = bundle["model"]
    vectorizer = bundle["vectorizer"]
    scaler = bundle["scaler"]
    threshold = bundle["threshold"]

    # Build TF-IDF text (same as training: use chunks if available, else sample raw text)
    if bm25_result["chunks"]:
        tfidf_text = " ".join(c["chunk_text"] for c in bm25_result["chunks"])
    else:
        # Sample beginning, middle, end (same as train script)
        sample_chars = 5000
        if len(text) <= sample_chars * 3:
            tfidf_text = text
        else:
            mid = len(text) // 2
            tfidf_text = " ".join([
                text[:sample_chars],
                text[mid:mid + sample_chars],
                text[-sample_chars:],
            ])

    # TF-IDF transform
    X_tfidf = vectorizer.transform([tfidf_text])

    # Structured features
    X_struct_raw = np.array([structured_features(bm25_result)])
    X_struct = csr_matrix(scaler.transform(X_struct_raw))

    # Combine
    X = hstack([X_tfidf, X_struct])

    # Predict
    prob = model.predict_proba(X)[0, 1]
    prediction = "compliant" if prob >= threshold else "non_compliant"

    return {
        "prediction": prediction,
        "probability": round(float(prob), 4),
        "threshold": round(float(threshold), 4),
        "source": "bm25_ml_model",
    }


# ── Main ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    try:
        input_data = json.loads(sys.stdin.read())
        text = input_data.get("text", "")

        if not text or len(text.strip()) < 10:
            print(json.dumps({
                "bm25": {"bucket": "LOW", "bm25_normalized_score": 0, "keyword_hits": {}, "chunks": []},
                "ml_prediction": {"prediction": "non_compliant", "probability": 0, "source": "empty_document"}
            }))
            sys.exit(0)

        # Stage 1: BM25 screening
        bm25_result = run_bm25(text)

        # Stage 2: ML model prediction
        model_path = Path(__file__).parent / "508_compliance_model.joblib"
        if model_path.exists():
            ml_result = predict_with_model(text, bm25_result, str(model_path))
        else:
            # Fallback to BM25 bucket if model not available
            ml_result = {
                "prediction": "compliant" if bm25_result["bucket"] == "HIGH" else "non_compliant",
                "probability": bm25_result["bm25_normalized_score"],
                "threshold": 0.5,
                "source": "bm25_fallback_no_model",
            }

        print(json.dumps({
            "bm25": bm25_result,
            "ml_prediction": ml_result,
        }))

    except Exception as e:
        print(json.dumps({
            "error": str(e),
            "bm25": {"bucket": "MEDIUM", "bm25_normalized_score": 0, "keyword_hits": {}, "chunks": []},
            "ml_prediction": {"prediction": "non_compliant", "probability": 0, "source": "error"}
        }))
        sys.exit(1)
