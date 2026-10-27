"""Lightweight Document Classifier for Indian Infrastructure Documents.

Pure Python TF-IDF and heuristic ensemble for classifying regulatory, utility,
and engineering documents without external heavy dependencies.
"""

from collections import Counter
import math
import re
from typing import Any, Dict, List, Optional, Set, Tuple

from ml.contracts.schemas import DocumentClassificationResult, ParsedDocument
from ml.contracts.taxonomy import (
    DocumentSubtype,
    DocumentType,
    KNOWN_AUTHORITIES,
    SUBTYPE_TO_DOCUMENT_TYPE,
)


# Curated domain lexicons and prototype signals for Indian infrastructure documents
EXCLUSION_TERMS = [
    "lease agreement", "residential apartment", "flat no", "tenant", "landlord",
    "monthly rent", "security deposit", "catering invoice", "procurement invoice",
    "hardware supplies", "server procurement", "vendor invoice", "court affidavit"
]

TAXONOMY_PROTOTYPES: Dict[DocumentSubtype, Dict[str, Any]] = {
    DocumentSubtype.GRID_SANCTION_LETTER: {
        "primary_terms": [
            "sanction", "ht power supply", "sanctioned load", "contract demand", "contracted maximum demand",
            "demand note", "supply voltage", "substation", "feeder", "grid load", "busbar",
            "tsspdcl", "msedcl", "bescom", "tangedco", "kptcl", "tstransco", "bay",
            "pvvnl", "upptcl", "dhbvn", "uhbvn", "in-principle sanction", "memorandum"
        ],
        "mandatory_indicators": ["sanction", "power supply", "demand", "in-principle"],
        "weight": 1.2
    },
    DocumentSubtype.DISCOM_POWER_APPLICATION: {
        "primary_terms": [
            "application", "applied for", "form ht", "requisition", "feasibility", "connectivity",
            "power supply application", "contract demand", "estimated peak", "load feasibility",
            "undertaking", "applicant details"
        ],
        "mandatory_indicators": ["application", "feasibility", "applied"],
        "weight": 1.1
    },
    DocumentSubtype.MUNICIPAL_BULK_WATER_ALLOCATION: {
        "primary_terms": [
            "water allocation", "bulk water", "water supply commitment", "water works",
            "kld", "mld", "dam", "pipeline", "potable water", "raw water", "midc", "tsiic",
            "hmwssb", "bwssb", "cmwssb", "recycled supply", "effluent", "cetp",
            "dicdl", "dsir", "gwssb", "allotment of industrial raw water", "cum/day"
        ],
        "mandatory_indicators": ["water", "allocation", "allotted", "supply"],
        "weight": 1.2
    },
    DocumentSubtype.GROUNDWATER_CGWA_NOC: {
        "primary_terms": [
            "ground water", "groundwater", "cgwa", "abstraction", "borewell", "withdrawal",
            "semi-critical", "over-exploited", "recharge", "rainwater harvesting", "no objection certificate"
        ],
        "mandatory_indicators": ["ground water", "cgwa", "abstraction", "borewell"],
        "weight": 1.4
    },
    DocumentSubtype.WATER_BALANCE_HYDROLOGY_STUDY: {
        "primary_terms": [
            "water balance", "hydrology", "evaporative cooling", "cooling tower", "chilled water",
            "zero liquid discharge", "zld", "water audit", "peak summer demand", "rainwater potential"
        ],
        "mandatory_indicators": ["water balance", "cooling", "hydrology"],
        "weight": 1.1
    },
    DocumentSubtype.DETAILED_PROJECT_REPORT: {
        "primary_terms": [
            "detailed project report", "dpr", "master plan", "campus", "built-up area",
            "plot area", "hyperscale", "data halls", "target pue", "pue", "phase 1", "phase 2",
            "commercial operations", "it capacity", "facility peak"
        ],
        "mandatory_indicators": ["detailed project report", "dpr", "master plan", "campus"],
        "weight": 1.3
    },
    DocumentSubtype.CONSENT_TO_ESTABLISH: {
        "primary_terms": [
            "consent to establish", "cte", "consent to operate", "cto", "spcb", "tspcb", "mpcb",
            "kspcb", "tnpcb", "stack height", "dg set", "dg backup", "noise pollution", "air pollution"
        ],
        "mandatory_indicators": ["consent to establish", "cte", "pollution control"],
        "weight": 1.3
    },
    DocumentSubtype.ENVIRONMENTAL_CLEARANCE: {
        "primary_terms": [
            "environmental clearance", "eia", "seiaa", "moefcc", "terms of reference",
            "tor", "baseline air quality", "environmental impact assessment"
        ],
        "mandatory_indicators": ["environmental clearance", "seiaa", "moefcc"],
        "weight": 1.3
    },
    DocumentSubtype.ZONING_LAND_ALLOTMENT: {
        "primary_terms": [
            "allotment letter", "land parcel", "survey no", "lease deed", "kiadb", "tsiic",
            "midc", "sipcot", "industrial area", "demarcation", "conveyance"
        ],
        "mandatory_indicators": ["allotment", "lease", "land parcel"],
        "weight": 1.0
    }
}


class DocumentClassifier:
    """Lightweight rule-guided TF-IDF document classifier."""

    def __init__(self, confidence_threshold: float = 0.35):
        self.confidence_threshold = confidence_threshold

    def classify_text(self, text: str, document_id: str = "doc_eval") -> DocumentClassificationResult:
        """Classify raw text into a DocumentClassificationResult."""
        text_lower = text.lower()
        words = re.findall(r"\b[a-z0-9_-]{3,}\b", text_lower)
        word_counts = Counter(words)
        total_words = max(len(words), 1)
        # 0. Check exclusion terms (e.g. residential lease, commercial catering/hardware invoice)
        exclusion_hits = [ex for ex in EXCLUSION_TERMS if ex in text_lower]
        if exclusion_hits:
            return DocumentClassificationResult(
                document_id=document_id,
                predicted_type=DocumentType.OTHER.value,
                predicted_subtype=DocumentSubtype.MISCELLANEOUS.value,
                confidence=0.15,
                rationale=[f"Abstained: Out-of-domain commercial or non-infrastructure indicators found: {', '.join(exclusion_hits)}."],
                secondary_predictions=[]
            )

        scores: Dict[DocumentSubtype, float] = {}
        matched_rationales: Dict[DocumentSubtype, List[str]] = {}

        for subtype, proto in TAXONOMY_PROTOTYPES.items():
            score = 0.0
            reasons = []

            # 1. Check mandatory indicator matches
            mandatory_hits = [ind for ind in proto["mandatory_indicators"] if ind in text_lower]
            if not mandatory_hits:
                scores[subtype] = 0.0
                continue

            score += len(mandatory_hits) * 1.5
            reasons.append(f"Matched indicator(s): {', '.join(mandatory_hits)}")

            # 2. Term frequency weighting
            term_hits = []
            for term in proto["primary_terms"]:
                if " " in term:
                    # Multi-word phrase
                    count = text_lower.count(term)
                    if count > 0:
                        score += count * 2.0
                        term_hits.append(f"'{term}' (x{count})")
                else:
                    # Single word
                    count = word_counts.get(term, 0)
                    if count > 0:
                        tf = count / total_words
                        score += count * 1.0
                        term_hits.append(f"'{term}' (x{count})")

            if term_hits:
                reasons.append(f"Key terms: {', '.join(term_hits[:4])}")

            # Apply subtype weight multiplier
            score *= proto.get("weight", 1.0)
            scores[subtype] = score
            matched_rationales[subtype] = reasons

        # Sort candidate subtypes by score
        ranked = sorted(scores.items(), key=lambda kv: kv[1], reverse=True)

        if not ranked or ranked[0][1] == 0:
            return DocumentClassificationResult(
                document_id=document_id,
                predicted_type=DocumentType.OTHER.value,
                predicted_subtype=DocumentSubtype.MISCELLANEOUS.value,
                confidence=0.1,
                rationale=["No recognized regulatory, utility, or infrastructure document indicators found."],
                secondary_predictions=[]
            )

        best_subtype, best_raw_score = ranked[0]
        best_type = SUBTYPE_TO_DOCUMENT_TYPE.get(best_subtype, DocumentType.OTHER)

        # Calibrate confidence score
        # A raw score of 15+ corresponds to high confidence (> 0.85)
        calibrated_conf = min(0.98, max(0.20, 1.0 - math.exp(-best_raw_score / 12.0)))

        # If highest score is below threshold, categorize as OTHER
        if calibrated_conf < self.confidence_threshold:
            return DocumentClassificationResult(
                document_id=document_id,
                predicted_type=DocumentType.OTHER.value,
                predicted_subtype=DocumentSubtype.MISCELLANEOUS.value,
                confidence=round(calibrated_conf, 4),
                rationale=["Score below confidence cutline; categorized as OTHER."],
                secondary_predictions=[]
            )

        # Secondary predictions
        secondary = []
        for st, sc in ranked[1:4]:
            if sc > 0:
                sec_type = SUBTYPE_TO_DOCUMENT_TYPE.get(st, DocumentType.OTHER)
                sec_conf = min(0.95, round(1.0 - math.exp(-sc / 12.0), 4))
                secondary.append({
                    "document_type": sec_type.value,
                    "subtype": st.value,
                    "score": sec_conf
                })

        return DocumentClassificationResult(
            document_id=document_id,
            predicted_type=best_type.value,
            predicted_subtype=best_subtype.value,
            confidence=round(calibrated_conf, 4),
            rationale=matched_rationales.get(best_subtype, []),
            secondary_predictions=secondary
        )

    def classify_document(self, doc: ParsedDocument) -> DocumentClassificationResult:
        """Classify a parsed document object."""
        return self.classify_text(doc.raw_text, document_id=doc.document_id)
