# EcoSite India — Document Intelligence & Extraction (ml/)

**Owner:** Samarth (AI/ML Agent)
**Contract Reference:** `docs/contracts/API_CONTRACTS.md` Section 4
**Date:** 27 October 2026
**Status:** ML-0 & ML-2 Baseline Validation Complete

---

## 1. Overview & Boundaries

The `ml/` package provides independent document intelligence for EcoSite India:
- Multi-format document parsing (**PDF**, **DOCX**, and **TXT**) with zero external runtime dependencies.
- Regulatory and utility document taxonomy for Indian data centre infrastructure.
- Lightweight, deterministic document classification with explicit confidence evaluation and abstention logic.
- Candidate field extraction returning structured objects adhering strictly to `API_CONTRACTS.md` Section 4 (`ExtractionCandidate`).
- Standardized unit normalization (MW, MVA, kV, KLD, hectares, ISO dates).
- Synthetic labelled datasets and genuinely held-out evaluation benchmark suite.

### Strict Governance Rules
1. **Never writes directly to the EcoSite database** — outputs structured candidates for backend ingestion and human review.
2. **Review status is always `PENDING`** — ML extraction candidates are never marked `GOVERNMENT_VERIFIED` or treated as legal approvals.
3. **Missing or unsupported evidence remains unverified** — missing facts produce no candidates rather than fabricated assumptions.
4. **No unapproved external heavy ML dependencies** — runs seamlessly on Python 3.11 standard library with native PDF stream decoding and OpenXML ZIP parsing.

---

## 2. ML-2 Validation Audit & Leakage Analysis

### 2.1 Audit for Train/Test Leakage & Template Similarity
- In the initial ML-0 synthetic fixtures (`ml/data/synthetic/fixtures`), templates followed predictable structures:
  `Sanctioned Grid Load: 50.0 MW`, `Ref: ... Date: ...`.
- Prototype keywords in `TAXONOMY_PROTOTYPES` directly mirrored synthetic text phrases, resulting in artificial 100% classification accuracy on the in-sample synthetic set.
- To rigorously test generalization, a **genuinely held-out benchmark** (`ml/data/held_out/`) was introduced with:
  - Unseen states and authorities (Uttar Pradesh PVVNL, Gujarat Dholera DICDL).
  - Alternative volumetric engineering units (`cum/day`, `cubic meters per day`).
  - Genuinely missing fields (feasibility letters without committed MW/MVA).
  - Internal contradictions across chapters (Campus Master Plan vs Phase 1 Operational Restriction).
  - Severely degraded OCR layout with merged words and no whitespace.
  - Out-of-domain residential lease agreements with domestic utility terms.

### 2.2 False Positive Categorization (Initial 83.8% Precision)
The 6 false positives in the baseline were audited into three distinct failure modes:
1. **Regex Word-Boundary Overmatching:**
   The unanchored pattern `(?:Ref|...):?` matched the prefix of standard body prose `"With reference to your application"`, capturing `"erence"` as a false document reference number.
   *Fix:* Added word boundary `\b` and negative lookahead for prose patterns (`"with reference"`, `"in reference"`).
2. **Incoming Applicant Citation Conflation:**
   Sanction letters cite prior incoming applications (e.g. `"Your Online Application Ref: TSSPDCL/HT/APP/2026/0419"`). The extractor captured this citation as the document's own issuing order number.
   *Fix:* Added negative lookbehind/filter for `"your application"` citations.
3. **Date Semantic Conflation:**
   Dates such as `"Commercial Operation Date: 15-12-2027"` were extracted as `application_date` because of generic date matching.
   *Fix:* Disambiguated Commercial Operation Dates (CoD) from application/sanction dates.

*Result:* Following targeted regex hardening, original benchmark extraction precision improved from **83.8%** to **93.9%** (F1 increased from **0.9118** to **0.9688**). The remaining 2 non-matching extractions in the DPR were genuine facts (`230 kV` and `DPR-CHE-2026-REV3`) unlisted in the original ground-truth annotation.

---

## 3. Classifier Confidence & Abstention Evaluation

### 3.1 Confidence Scoring Mechanics
The classifier uses a heuristic term-frequency / indicator score mapped through an exponential saturation curve:
$$\text{confidence} = \min(0.98, \max(0.20, 1.0 - e^{-\text{raw\_score} / 12.0}))$$

**Empirical Reality:**
This is an uncalibrated heuristic confidence measure, not a Bayesian posterior probability.
- High indicator matches (e.g., PVVNL sanction with EHV, substation, and MW) produce raw scores $> 15$, yielding confidence $\approx 0.85 - 0.88$.
- Sparse or borderline documents produce confidence $\approx 0.65 - 0.70$.
- Scores below the cutline ($0.35$) trigger deliberate **abstention** $\to$ the document is categorized as `OTHER` with confidence $< 0.35$, and extraction is safely bypassed.

### 3.2 Abstention on Edge Cases
- **Residential Tenancy Agreement:** Contains "BESCOM" and "domestic water", but the presence of domain-exclusion terms ("lease agreement", "rent", "tenant") immediately forces classification to `OTHER` ($\text{conf} = 0.1500$) with zero false-positive extractions.
- **Malformed OCR Noise:** Severely merged tokens without whitespace fail tokenization, yielding a raw score below threshold ($\text{conf} = 0.2953 < 0.35$). The classifier abstains rather than emitting a false high-confidence prediction.

---

## 4. Benchmark Performance Metrics

Run the comprehensive benchmark evaluation via:
```powershell
backend\.venv\Scripts\python.exe -m ml.evaluation.run_eval
```

### 4.1 Original Synthetic Benchmark vs. Genuinely Held-Out Benchmark

| Evaluation Metric | Original Synthetic Benchmark | Genuinely Held-Out Benchmark |
|---|---|---|
| **Overall Classification Accuracy** | **100.0%** | **66.7%** (Abstains on OCR noise & preliminary feasibility) |
| **Overall Classification Macro F1** | **1.0000** | **0.5833** |
| **Candidate Extraction Precision** | **93.9%** | **95.2%** (1 false positive across all documents) |
| **Candidate Extraction Recall** | **100.0%** (31/31) | **74.1%** (20/27; skips uncommitted capacity) |
| **Candidate Extraction F1** | **0.9688** | **0.8333** |
| **Page Attribution Accuracy** | **100.0%** | **100.0%** (Every candidate accurately 1-indexed) |

### 4.2 Per-Class Breakdown (Held-Out Benchmark)

| Document Class | Precision | Recall | F1-Score | Support |
|---|---|---|---|---|
| `WATER_ALLOCATION` | 100.0% | 100.0% | 1.0000 | 1 |
| `UTILITY_SANCTION` | 66.7% | 66.7% | 0.6667 | 3 |
| `OTHER` (Abstention) | 50.0% | 100.0% | 0.6667 | 1 |
| `UTILITY_APPLICATION` | 0.0% | 0.0% | 0.0000 | 1 |

---

## 5. Parser Limitations & Safe Input Verification

Tested via `ml/tests/test_parsers.py`:
1. **Truncated/Corrupt PDF Streams:** Handled gracefully via try/except blocks; returns `ParsedDocument` with safe fallback text rather than throwing unhandled exceptions.
2. **Corrupted DOCX Zip Archives:** Catches bad zip headers or missing `word/document.xml`, returns safe fallback with `metadata["corrupted"] = True`.
3. **Empty Input Bytes:** Returns a clean `ParsedPage(page_number=1, text="")`.
4. **Page Attribution:** Exact multi-page boundaries verified across PDF, DOCX, and text formats.

---

## 6. Inference Entry Point & Backend Integration

The module exposes a top-level callable inference service in `ml/service.py` (and imported at `ml` root):

```python
from ml import extract_candidates_from_file, extract_candidates_from_bytes

# Option A: From local file path (PDF, DOCX, TXT)
result = extract_candidates_from_file("path/to/sanction_letter.pdf")

# Option B: From raw uploaded bytes (e.g., inside FastAPI upload endpoint)
result = extract_candidates_from_bytes(file_bytes, filename="sanction_letter.pdf")
```

### Exact Output JSON Structure:
```json
{
  "document_id": "550e8400-e29b-41d4-a716-446655440000",
  "filename": "TSSPDCL_Grid_Sanction_FabCity_Phase1.pdf",
  "file_format": "PDF",
  "page_count": 1,
  "status": "SUCCESS",
  "classification": {
    "document_id": "550e8400-e29b-41d4-a716-446655440000",
    "predicted_type": "UTILITY_SANCTION",
    "predicted_subtype": "GRID_SANCTION_LETTER",
    "confidence": 0.8841,
    "rationale": [
      "Matched indicator(s): sanction, power supply, demand",
      "Key terms: 'sanction' (x2), 'ht power supply' (x1), 'sanctioned load' (x1)"
    ],
    "secondary_predictions": []
  },
  "candidate_count": 7,
  "extraction_candidates": [
    {
      "document_id": "550e8400-e29b-41d4-a716-446655440000",
      "document_type": "UTILITY_SANCTION",
      "page_number": 1,
      "field_key": "sanctioned_grid_mw",
      "raw_text": "2. Sanctioned Grid Load: 50.0 MW",
      "normalized_value": 50.0,
      "unit": "MW",
      "phase_scope": "PHASE_1",
      "method": "RULE_BASED",
      "model_version": "0.1.0",
      "confidence": 0.92,
      "review_status": "PENDING"
    }
  ],
  "warnings": []
}
```

### Integration Invariants & Status Codes:
- `SUCCESS`: Valid infrastructure document with candidate fields extracted.
- `ABSTAINED`: Out-of-domain commercial or non-infrastructure text (e.g., residential lease or vendor invoice). Extraction is safely bypassed; `candidate_count = 0`.
- `EMPTY_DOCUMENT`: Zero-byte input payload.
- `UNSUPPORTED_FORMAT`: File extension or magic bytes not recognized.
- `DEGRADED`: Corrupted PDF stream or DOCX archive; returns partial text if salvageable without crashing.
- **Review Status Guarantee**: Every candidate item strictly carries `"review_status": "PENDING"`.

---

## 7. Running Tests

Run the complete 40-test unit suite:
```powershell
backend\.venv\Scripts\python.exe -B -m unittest discover -s ml/tests -v
```
All 40 unit tests pass in $< 0.1\text{s}$.
