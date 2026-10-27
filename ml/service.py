"""Inference and extraction service entry point for EcoSite India document intelligence.

Provides a unified, robust, zero-dependency interface for backend and CLI consumers
to parse local PDF/DOCX/TXT files or byte streams, classify document types, and return
structured ExtractionCandidate records strictly adhering to API_CONTRACTS.md Section 4.
"""

import json
from pathlib import Path
from typing import Any, Dict, List, Optional, Union
import uuid

from ml.classifiers.classifier import DocumentClassifier
from ml.contracts.schemas import (
    DocumentClassificationResult,
    ExtractionCandidate,
    ParsedDocument,
    ReviewStatus,
)
from ml.contracts.taxonomy import DocumentType
from ml.extractors.extractor import CandidateExtractor
from ml.parsers.unified_parser import DocumentParser

SUPPORTED_EXTENSIONS = {".pdf", ".docx", ".doc", ".txt", ".md"}


class DocumentIntelligenceService:
    """Production-grade document extraction service with safe input validation."""

    def __init__(
        self,
        parser: Optional[DocumentParser] = None,
        classifier: Optional[DocumentClassifier] = None,
        extractor: Optional[CandidateExtractor] = None,
        model_version: str = "0.1.0",
    ):
        self.parser = parser or DocumentParser()
        self.classifier = classifier or DocumentClassifier()
        self.extractor = extractor or CandidateExtractor(self.classifier)
        self.model_version = model_version

    def process_file(
        self,
        file_path: Union[str, Path],
        document_id: Optional[str] = None,
        document_type_hint: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Process a local document file and return validated extraction candidates."""
        path = Path(file_path)
        if not path.exists():
            return self._build_error_response(
                document_id=document_id or path.stem,
                filename=path.name,
                error_code="FILE_NOT_FOUND",
                message=f"File not found at path: {path}",
            )

        if document_id is None:
            document_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, path.name))

        ext = path.suffix.lower()
        if ext not in SUPPORTED_EXTENSIONS:
            return self._build_error_response(
                document_id=document_id,
                filename=path.name,
                error_code="UNSUPPORTED_FORMAT",
                message=f"Unsupported file format '{ext}'. Supported extensions: {sorted(list(SUPPORTED_EXTENSIONS))}",
            )

        try:
            file_bytes = path.read_bytes()
        except Exception as e:
            return self._build_error_response(
                document_id=document_id,
                filename=path.name,
                error_code="READ_ERROR",
                message=f"Failed to read file: {e}",
            )

        return self.process_bytes(
            data=file_bytes,
            filename=path.name,
            document_id=document_id,
            document_type_hint=document_type_hint,
        )

    def process_bytes(
        self,
        data: bytes,
        filename: str,
        document_id: Optional[str] = None,
        document_type_hint: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Process raw document bytes and return validated extraction candidates."""
        if document_id is None:
            document_id = str(uuid.uuid4())

        # Check empty payload
        if len(data) == 0:
            return self._build_empty_response(document_id, filename)

        # Check file extension
        ext = Path(filename).suffix.lower()
        if ext and ext not in SUPPORTED_EXTENSIONS:
            # If magic bytes don't match PDF or ZIP, reject
            if not data.startswith(b"%PDF") and not data.startswith(b"PK\x03\x04"):
                return self._build_error_response(
                    document_id=document_id,
                    filename=filename,
                    error_code="UNSUPPORTED_FORMAT",
                    message=f"Unsupported format '{ext}'. Supported: {sorted(list(SUPPORTED_EXTENSIONS))}",
                )

        warnings: List[str] = []

        # 1. Parse document
        try:
            parsed_doc = self.parser.parse_bytes(data, filename=filename, document_id=document_id)
        except Exception as e:
            return self._build_error_response(
                document_id=document_id,
                filename=filename,
                error_code="PARSE_FAILED",
                message=f"Document parsing failed: {e}",
            )

        if parsed_doc.metadata.get("corrupted", False):
            warnings.append(f"Document archive/stream was corrupted: {parsed_doc.metadata.get('error', 'unknown error')}")

        # Check for empty text
        if not parsed_doc.raw_text.strip():
            warnings.append("Parsed document contains zero readable text characters.")

        # 2. Classification
        if document_type_hint and document_type_hint in {t.value for t in DocumentType}:
            cls_result = DocumentClassificationResult(
                document_id=document_id,
                predicted_type=document_type_hint,
                predicted_subtype=None,
                confidence=1.0,
                rationale=["Caller-provided explicit document type hint."]
            )
        else:
            cls_result = self.classifier.classify_document(parsed_doc)

        # 3. Extraction
        raw_candidates = self.extractor.extract_candidates(
            parsed_doc,
            document_type=cls_result.predicted_type
        )

        # 4. Strictly enforce API_CONTRACTS.md format and pending review status
        formatted_candidates: List[Dict[str, Any]] = []
        for cand in raw_candidates:
            cand.model_version = self.model_version
            cand.review_status = ReviewStatus.PENDING.value  # Strict invariant
            formatted_candidates.append(cand.to_dict())

        if parsed_doc.metadata.get("corrupted", False):
            status = "DEGRADED"
        elif cls_result.predicted_type == DocumentType.OTHER.value:
            status = "ABSTAINED"
            warnings.append("Document classified as OTHER / out-of-domain. Candidate extraction was bypassed.")
        else:
            status = "SUCCESS"

        return {
            "document_id": document_id,
            "filename": filename,
            "file_format": parsed_doc.file_format,
            "page_count": parsed_doc.page_count,
            "status": status,
            "classification": cls_result.to_dict(),
            "candidate_count": len(formatted_candidates),
            "extraction_candidates": formatted_candidates,
            "warnings": warnings,
        }

    def _build_empty_response(self, document_id: str, filename: str) -> Dict[str, Any]:
        return {
            "document_id": document_id,
            "filename": filename,
            "file_format": Path(filename).suffix.lstrip(".").upper() or "UNKNOWN",
            "page_count": 0,
            "status": "EMPTY_DOCUMENT",
            "classification": {
                "document_id": document_id,
                "predicted_type": DocumentType.OTHER.value,
                "predicted_subtype": None,
                "confidence": 0.0,
                "rationale": ["Document payload is completely empty (0 bytes)."],
                "secondary_predictions": []
            },
            "candidate_count": 0,
            "extraction_candidates": [],
            "warnings": ["Empty file payload received."],
        }

    def _build_error_response(
        self, document_id: str, filename: str, error_code: str, message: str
    ) -> Dict[str, Any]:
        return {
            "document_id": document_id,
            "filename": filename,
            "file_format": Path(filename).suffix.lstrip(".").upper() or "UNKNOWN",
            "page_count": 0,
            "status": "ERROR",
            "error_code": error_code,
            "message": message,
            "candidate_count": 0,
            "extraction_candidates": [],
            "warnings": [message],
        }


# Global default service instance
_default_service = DocumentIntelligenceService()


def extract_candidates_from_file(
    file_path: Union[str, Path],
    document_id: Optional[str] = None,
    document_type_hint: Optional[str] = None,
) -> Dict[str, Any]:
    """Top-level callable entry point accepting local PDF/DOCX/TXT path."""
    return _default_service.process_file(
        file_path=file_path,
        document_id=document_id,
        document_type_hint=document_type_hint,
    )


def extract_candidates_from_bytes(
    data: bytes,
    filename: str,
    document_id: Optional[str] = None,
    document_type_hint: Optional[str] = None,
) -> Dict[str, Any]:
    """Top-level callable entry point accepting document bytes and filename hint."""
    return _default_service.process_bytes(
        data=data,
        filename=filename,
        document_id=document_id,
        document_type_hint=document_type_hint,
    )
