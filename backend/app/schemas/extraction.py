"""Pydantic schemas for document file upload and extraction workflows.

Matches API_CONTRACTS.md Section 4 ExtractionCandidate wire format.
"""

from typing import Any, Dict, List, Literal, Optional, Union
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from backend.app.schemas.evidence import Confidentiality, Visibility


class ArtifactContentUpload(BaseModel):
    """Payload for uploading document bytes as base64."""
    model_config = ConfigDict(extra="forbid")

    content_base64: str = Field(min_length=1, max_length=36_000_000, description="Base64 encoded file content (max ~25 MiB decoded)")


class ArtifactDirectUpload(BaseModel):
    """Combined upload payload registering artifact and storing bytes in one step."""
    model_config = ConfigDict(extra="forbid")

    filename: str = Field(min_length=1, max_length=255)
    document_type: str = Field(min_length=1, max_length=50)
    content_base64: str = Field(min_length=1, max_length=36_000_000, description="Base64 encoded file content (max ~25 MiB decoded)")
    site_id: Optional[UUID] = None
    issuer: Optional[str] = Field(default=None, max_length=200)
    reference: Optional[str] = Field(default=None, max_length=300)
    issued_on: Optional[str] = Field(default=None, max_length=32)
    valid_until: Optional[str] = Field(default=None, max_length=32)
    visibility: Visibility = "PROJECT_TEAM"
    confidentiality: Confidentiality = "confidential"
    synthetic_demo: bool = False
    uploaded_by: str = Field(default="local-user", min_length=1, max_length=200)


class ExtractionCandidatePayload(BaseModel):
    """Structured extraction candidate matching API_CONTRACTS.md Section 4."""
    model_config = ConfigDict(extra="allow")

    extraction_id: str
    document_id: str
    document_type: str
    page_number: int = Field(ge=1)
    field_key: str
    raw_text: str
    normalized_value: Union[float, int, str, None] = None
    unit: Optional[str] = None
    phase_scope: Optional[str] = "UNKNOWN"
    method: str = "RULE_BASED"
    model_version: Optional[str] = None
    confidence: Optional[float] = None
    review_status: str = "PENDING"
    assertion_id: Optional[str] = None


class ExtractionRunResponse(BaseModel):
    """Response returned by POST /evidence/{id}/extract and GET /evidence/{id}/extractions."""
    model_config = ConfigDict(extra="allow")

    artifact_id: str
    filename: str
    file_format: str
    page_count: int
    status: str
    document_type: str
    classification: Dict[str, Any]
    candidate_count: int
    extraction_candidates: List[ExtractionCandidatePayload]
    warnings: List[str] = []


class ExtractionCandidateConfirmRequest(BaseModel):
    """Human review request confirming an extraction candidate into an assertion."""
    model_config = ConfigDict(extra="forbid")

    reviewer_id: str = Field(min_length=1, max_length=200)
    notes: str = Field(min_length=1, max_length=2000)
    target_site_id: Optional[UUID] = None
    target_phase_id: Optional[UUID] = None
    modified_value: Optional[str] = Field(default=None, max_length=500)
    modified_numeric_value: Optional[float] = None
    modified_unit: Optional[str] = Field(default=None, max_length=40)
    is_simulated: bool = True
    review_outcome: Optional[Literal["APPROVED", "SIMULATED_VERIFICATION"]] = None


class ExtractionCandidateRejectRequest(BaseModel):
    """Rejection payload for a proposed extraction candidate."""
    model_config = ConfigDict(extra="forbid")

    reviewer_id: str = Field(min_length=1, max_length=200)
    notes: str = Field(min_length=1, max_length=2000)


class DirectExtractionConfirmRequest(ExtractionCandidateConfirmRequest):
    """Top-level confirmation schema requiring artifact_id."""
    model_config = ConfigDict(extra="forbid")

    artifact_id: UUID
