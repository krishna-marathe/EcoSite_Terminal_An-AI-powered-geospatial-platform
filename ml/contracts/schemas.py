"""Data transfer objects and schemas matching EcoSite India API Contracts.

Specifically matches API_CONTRACTS.md Section 4: ExtractionCandidate.
"""

from dataclasses import asdict, dataclass, field
from datetime import date
from enum import Enum
from typing import Any, Dict, List, Optional, Union
import uuid

from ml.contracts.taxonomy import DocumentType, DocumentSubtype, FieldKey


class PhaseScope(str, Enum):
    """Scope of extraction candidate across project phases."""
    PHASE_1 = "PHASE_1"
    PHASE_2 = "PHASE_2"
    PHASE_3 = "PHASE_3"
    CAMPUS_WIDE = "CAMPUS_WIDE"
    UNKNOWN = "UNKNOWN"


class ExtractionMethod(str, Enum):
    """Method used to extract candidate values."""
    RULE_BASED = "RULE_BASED"
    HEURISTIC = "HEURISTIC"
    ML_MODEL = "ML_MODEL"
    HYBRID = "HYBRID"


class ReviewStatus(str, Enum):
    """Review status of candidate extraction.

    IMPORTANT: As per AGENTS.md and API_CONTRACTS.md, extraction outputs must
    ALWAYS default to PENDING. ML models never grant verified status.
    """
    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"
    REJECTED = "REJECTED"
    MODIFIED = "MODIFIED"


@dataclass
class ExtractionCandidate:
    """Extraction candidate schema matching API_CONTRACTS.md Section 4."""
    document_id: str
    document_type: str
    page_number: int
    field_key: str
    raw_text: str
    normalized_value: Union[float, int, str, None]
    unit: Optional[str] = None
    phase_scope: Optional[str] = PhaseScope.UNKNOWN.value
    method: str = ExtractionMethod.RULE_BASED.value
    model_version: Optional[str] = None
    confidence: Optional[float] = None
    review_status: str = ReviewStatus.PENDING.value

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary matching backend wire format."""
        return {
            "document_id": self.document_id,
            "document_type": self.document_type,
            "page_number": self.page_number,
            "field_key": self.field_key,
            "raw_text": self.raw_text,
            "normalized_value": self.normalized_value,
            "unit": self.unit,
            "phase_scope": self.phase_scope,
            "method": self.method,
            "model_version": self.model_version,
            "confidence": round(self.confidence, 4) if self.confidence is not None else None,
            "review_status": self.review_status,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ExtractionCandidate":
        """Instantiate from dictionary."""
        return cls(
            document_id=str(data["document_id"]),
            document_type=str(data["document_type"]),
            page_number=int(data["page_number"]),
            field_key=str(data["field_key"]),
            raw_text=str(data["raw_text"]),
            normalized_value=data.get("normalized_value"),
            unit=data.get("unit"),
            phase_scope=data.get("phase_scope", PhaseScope.UNKNOWN.value),
            method=data.get("method", ExtractionMethod.RULE_BASED.value),
            model_version=data.get("model_version"),
            confidence=data.get("confidence"),
            review_status=data.get("review_status", ReviewStatus.PENDING.value),
        )


@dataclass
class DocumentClassificationResult:
    """Classification prediction for a document."""
    document_id: str
    predicted_type: str  # DocumentType string
    predicted_subtype: Optional[str] = None  # DocumentSubtype string
    confidence: float = 0.0
    rationale: List[str] = field(default_factory=list)
    secondary_predictions: List[Dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "document_id": self.document_id,
            "predicted_type": self.predicted_type,
            "predicted_subtype": self.predicted_subtype,
            "confidence": round(self.confidence, 4),
            "rationale": self.rationale,
            "secondary_predictions": self.secondary_predictions,
        }


@dataclass
class ParsedPage:
    """Single page parsed from a PDF, DOCX, or text file."""
    page_number: int
    text: str
    char_count: int = 0
    tables: List[List[List[str]]] = field(default_factory=list)

    def __post_init__(self):
        if self.char_count == 0:
            self.char_count = len(self.text)


@dataclass
class ParsedDocument:
    """Standardized parsed document representation across formats."""
    document_id: str
    filename: str
    file_format: str  # "PDF", "DOCX", "TXT"
    page_count: int
    pages: List[ParsedPage]
    raw_text: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)

    def __post_init__(self):
        if not self.raw_text and self.pages:
            self.raw_text = "\n\n--- [Page Break] ---\n\n".join(p.text for p in self.pages)


@dataclass
class GroundTruthAnnotation:
    """Ground truth annotations for evaluation of classification and extraction."""
    document_id: str
    filename: str
    true_document_type: str
    true_document_subtype: str
    jurisdiction: str
    issuing_authority: str
    expected_fields: List[Dict[str, Any]]  # List of expected candidate specs

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
