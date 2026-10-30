"""EcoSite India — Document Intelligence & Extraction Package.

Independent AI/ML module for document taxonomy, parsing, classification,
candidate field extraction, and evaluation.
"""

from ml.service import (
    DocumentIntelligenceService,
    extract_candidates_from_bytes,
    extract_candidates_from_file,
)
from ml.contracts.schemas import (
    ExtractionCandidate,
    ReviewStatus,
    PhaseScope,
    DocumentClassificationResult,
)
from ml.contracts.taxonomy import (
    DocumentType,
    DocumentSubtype,
    FieldKey,
)

__version__ = "0.1.0"

__all__ = [
    "DocumentIntelligenceService",
    "extract_candidates_from_file",
    "extract_candidates_from_bytes",
    "ExtractionCandidate",
    "ReviewStatus",
    "PhaseScope",
    "DocumentClassificationResult",
    "DocumentType",
    "DocumentSubtype",
    "FieldKey",
    "__version__",
]
