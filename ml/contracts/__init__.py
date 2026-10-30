"""ML Contracts package.

Exports schemas, taxonomy, and enums matching backend API contracts.
"""

from ml.contracts.taxonomy import (
    DocumentType,
    DocumentSubtype,
    FieldKey,
    SUBTYPE_TO_DOCUMENT_TYPE,
    FIELD_CANONICAL_UNITS,
    KNOWN_AUTHORITIES,
)
from ml.contracts.schemas import (
    ExtractionCandidate,
    PhaseScope,
    ExtractionMethod,
    ReviewStatus,
    DocumentClassificationResult,
    ParsedPage,
    ParsedDocument,
    GroundTruthAnnotation,
)

__all__ = [
    "DocumentType",
    "DocumentSubtype",
    "FieldKey",
    "SUBTYPE_TO_DOCUMENT_TYPE",
    "FIELD_CANONICAL_UNITS",
    "KNOWN_AUTHORITIES",
    "ExtractionCandidate",
    "PhaseScope",
    "ExtractionMethod",
    "ReviewStatus",
    "DocumentClassificationResult",
    "ParsedPage",
    "ParsedDocument",
    "GroundTruthAnnotation",
]
