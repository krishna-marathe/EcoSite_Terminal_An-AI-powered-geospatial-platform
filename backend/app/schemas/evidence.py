from __future__ import annotations

from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

DocumentType = Literal[
    "DPR",
    "UTILITY_APPLICATION",
    "UTILITY_SANCTION",
    "WATER_ALLOCATION",
    "WATER_STUDY",
    "PLANNING",
    "ENVIRONMENTAL_NOC",
    "OTHER",
]
Visibility = Literal["PROJECT_TEAM", "RESTRICTED_REVIEWER", "PUBLIC_SUMMARY"]
Confidentiality = Literal["public", "aggregated_confidential", "confidential"]
ScopeType = Literal["CAMPUS", "PHASE", "SITE", "CONNECTION"]
AssertionStatus = Literal[
    "DECLARED",
    "DOCUMENTED",
    "VERIFIED_WITHIN_SCOPE",
    "EXPIRED",
    "SUPERSEDED",
    "CONFLICTING",
    "MISSING",
]
VerificationMethod = Literal[
    "UNVERIFIED",
    "EXTRACTED_RULE_BASED",
    "EXTRACTED_MODEL",
    "SIMULATED_REVIEW",
    "INDEPENDENT_REVIEW",
]
ReviewOutcome = Literal["APPROVED", "REJECTED", "FLAGGED_CONFLICT", "SIMULATED_VERIFICATION"]
FindingSeverity = Literal["info", "warning", "blocker"]


class EvidenceArtifactCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    site_id: UUID | None = None
    document_type: DocumentType
    filename: str = Field(min_length=1, max_length=255)
    mime_type: str = Field(min_length=3, max_length=100)
    file_size_bytes: int = Field(ge=0)
    sha256: str = Field(min_length=64, max_length=64)
    issuer: str | None = Field(default=None, max_length=200)
    reference: str | None = Field(default=None, max_length=300)
    issued_on: str | None = Field(default=None, max_length=32)
    valid_until: str | None = Field(default=None, max_length=32)
    visibility: Visibility = "PROJECT_TEAM"
    confidentiality: Confidentiality = "confidential"
    synthetic_demo: bool = False
    uploaded_by: str = Field(min_length=1, max_length=200)


class EvidenceArtifactPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    site_id: UUID | None = None
    document_type: DocumentType | None = None
    issuer: str | None = Field(default=None, max_length=200)
    reference: str | None = Field(default=None, max_length=300)
    issued_on: str | None = Field(default=None, max_length=32)
    valid_until: str | None = Field(default=None, max_length=32)
    visibility: Visibility | None = None
    confidentiality: Confidentiality | None = None
    status: Literal["active", "archived"] | None = None
    expected_revision: int = Field(ge=1)


class EvidenceArtifactRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    site_id: str | None
    document_type: str
    filename: str
    mime_type: str
    file_size_bytes: int
    sha256: str
    issuer: str | None
    reference: str | None
    issued_on: str | None
    valid_until: str | None
    visibility: str
    confidentiality: str
    synthetic_demo: bool
    uploaded_by: str
    uploaded_at: str
    status: str
    revision: int


class AssertionEvidenceLinkInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    artifact_id: UUID
    page_number: int | None = Field(default=None, ge=1)


class AssertionEvidenceLinkRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    artifact_id: str
    filename: str
    document_type: str
    page_number: int | None
    sha256: str
    synthetic_demo: bool


class AssertionReviewCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    reviewer_id: str = Field(min_length=1, max_length=200)
    review_status: ReviewOutcome
    is_simulated: bool = True
    notes: str = Field(min_length=1, max_length=2000)


class AssertionReviewRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    assertion_id: str
    reviewer_id: str
    review_status: str
    is_simulated: bool
    notes: str
    reviewed_at: str


class AssertionCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    site_id: UUID | None = None
    phase_id: UUID | None = None
    field_key: str = Field(min_length=1, max_length=100)
    value: str = Field(min_length=1, max_length=500)
    numeric_value: float | None = None
    unit: str = Field(min_length=1, max_length=40)
    scope_type: ScopeType = "CAMPUS"
    scope_detail: str | None = Field(default=None, max_length=200)
    status: AssertionStatus = "DECLARED"
    verification_method: VerificationMethod = "UNVERIFIED"
    asserted_by: str = Field(min_length=1, max_length=200)
    effective_from: str | None = Field(default=None, max_length=32)
    effective_to: str | None = Field(default=None, max_length=32)
    supersedes_assertion_id: UUID | None = None
    evidence_links: list[AssertionEvidenceLinkInput] = []


class AssertionPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    value: str | None = Field(default=None, min_length=1, max_length=500)
    numeric_value: float | None = None
    unit: str | None = Field(default=None, min_length=1, max_length=40)
    scope_type: ScopeType | None = None
    scope_detail: str | None = Field(default=None, max_length=200)
    status: AssertionStatus | None = None
    verification_method: VerificationMethod | None = None
    effective_from: str | None = Field(default=None, max_length=32)
    effective_to: str | None = Field(default=None, max_length=32)
    supersedes_assertion_id: UUID | None = None
    status_record: Literal["active", "archived"] | None = None
    evidence_links: list[AssertionEvidenceLinkInput] | None = None
    expected_revision: int = Field(ge=1)


class AssertionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    site_id: str | None
    phase_id: str | None
    field_key: str
    value: str
    numeric_value: float | None
    unit: str
    scope_type: str
    scope_detail: str | None
    status: str
    verification_method: str
    asserted_by: str
    asserted_at: str
    effective_from: str | None
    effective_to: str | None
    supersedes_assertion_id: str | None
    status_record: str
    revision: int
    evidence_links: list[AssertionEvidenceLinkRead] = []
    reviews: list[AssertionReviewRead] = []


class AuditFinding(BaseModel):
    severity: FindingSeverity
    code: str
    message: str
    entity_type: Literal["artifact", "assertion", "project"]
    entity_id: str | None = None


class EvidenceAuditReport(BaseModel):
    project_id: str
    audited_at: str
    artifact_count: int
    assertion_count: int
    has_synthetic_evidence: bool
    has_unreviewed_extractions: bool
    comparative_assertion_blocked: bool
    blocking_reasons: list[str]
    findings: list[AuditFinding]
