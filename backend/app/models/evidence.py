from __future__ import annotations

from uuid import uuid4

from sqlalchemy import Boolean, CheckConstraint, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .projects import Base, utc_timestamp

DOCUMENT_TYPES = (
    "'DPR', 'UTILITY_APPLICATION', 'UTILITY_SANCTION', 'WATER_ALLOCATION', "
    "'WATER_STUDY', 'PLANNING', 'ENVIRONMENTAL_NOC', 'OTHER'"
)
VISIBILITIES = "'PROJECT_TEAM', 'RESTRICTED_REVIEWER', 'PUBLIC_SUMMARY'"
CONFIDENTIALITIES = "'public', 'aggregated_confidential', 'confidential'"
ASSERTION_SCOPES = "'CAMPUS', 'PHASE', 'SITE', 'CONNECTION'"
ASSERTION_STATUSES = (
    "'DECLARED', 'DOCUMENTED', 'VERIFIED_WITHIN_SCOPE', 'EXPIRED', "
    "'SUPERSEDED', 'CONFLICTING', 'MISSING'"
)
VERIFICATION_METHODS = (
    "'UNVERIFIED', 'EXTRACTED_RULE_BASED', 'EXTRACTED_MODEL', "
    "'SIMULATED_REVIEW', 'INDEPENDENT_REVIEW'"
)
REVIEW_STATUSES = "'APPROVED', 'REJECTED', 'FLAGGED_CONFLICT', 'SIMULATED_VERIFICATION'"


class EvidenceArtifact(Base):
    __tablename__ = "evidence_artifacts"
    __table_args__ = (
        CheckConstraint("revision >= 1", name="ck_evidence_artifacts_revision"),
        CheckConstraint("status IN ('active', 'archived')", name="ck_evidence_artifacts_status"),
        CheckConstraint(f"document_type IN ({DOCUMENT_TYPES})", name="ck_evidence_artifacts_type"),
        CheckConstraint(f"visibility IN ({VISIBILITIES})", name="ck_evidence_artifacts_visibility"),
        CheckConstraint(f"confidentiality IN ({CONFIDENTIALITIES})", name="ck_evidence_artifacts_confidentiality"),
        CheckConstraint("file_size_bytes >= 0", name="ck_evidence_artifacts_size"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="RESTRICT"), index=True)
    site_id: Mapped[str | None] = mapped_column(ForeignKey("candidate_sites.id", ondelete="RESTRICT"), nullable=True, index=True)
    document_type: Mapped[str] = mapped_column(String(50), index=True)
    filename: Mapped[str] = mapped_column(String(255))
    mime_type: Mapped[str] = mapped_column(String(100))
    file_size_bytes: Mapped[int] = mapped_column(Integer)
    sha256: Mapped[str] = mapped_column(String(64), index=True)
    issuer: Mapped[str | None] = mapped_column(String(200), nullable=True)
    reference: Mapped[str | None] = mapped_column(String(300), nullable=True)
    issued_on: Mapped[str | None] = mapped_column(String(32), nullable=True)
    valid_until: Mapped[str | None] = mapped_column(String(32), nullable=True)
    visibility: Mapped[str] = mapped_column(String(30), default="PROJECT_TEAM")
    confidentiality: Mapped[str] = mapped_column(String(30), default="confidential")
    synthetic_demo: Mapped[bool] = mapped_column(Boolean, default=False)
    uploaded_by: Mapped[str] = mapped_column(String(200))
    uploaded_at: Mapped[str] = mapped_column(String(32), default=utc_timestamp)
    status: Mapped[str] = mapped_column(String(20), default="active", index=True)
    revision: Mapped[int] = mapped_column(default=1)

    assertion_links: Mapped[list[AssertionEvidenceLink]] = relationship(
        "AssertionEvidenceLink", back_populates="artifact", cascade="all, delete-orphan"
    )


class Assertion(Base):
    __tablename__ = "assertions"
    __table_args__ = (
        CheckConstraint("revision >= 1", name="ck_assertions_revision"),
        CheckConstraint("status_record IN ('active', 'archived')", name="ck_assertions_status_record"),
        CheckConstraint(f"scope_type IN ({ASSERTION_SCOPES})", name="ck_assertions_scope"),
        CheckConstraint(f"status IN ({ASSERTION_STATUSES})", name="ck_assertions_status"),
        CheckConstraint(f"verification_method IN ({VERIFICATION_METHODS})", name="ck_assertions_verification"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="RESTRICT"), index=True)
    site_id: Mapped[str | None] = mapped_column(ForeignKey("candidate_sites.id", ondelete="RESTRICT"), nullable=True, index=True)
    phase_id: Mapped[str | None] = mapped_column(ForeignKey("project_phases.id", ondelete="RESTRICT"), nullable=True, index=True)
    field_key: Mapped[str] = mapped_column(String(100), index=True)
    value: Mapped[str] = mapped_column(String(500))
    numeric_value: Mapped[float | None] = mapped_column(nullable=True)
    unit: Mapped[str] = mapped_column(String(40))
    scope_type: Mapped[str] = mapped_column(String(30), default="CAMPUS")
    scope_detail: Mapped[str | None] = mapped_column(String(200), nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="DECLARED", index=True)
    verification_method: Mapped[str] = mapped_column(String(30), default="UNVERIFIED")
    asserted_by: Mapped[str] = mapped_column(String(200))
    asserted_at: Mapped[str] = mapped_column(String(32), default=utc_timestamp)
    effective_from: Mapped[str | None] = mapped_column(String(32), nullable=True)
    effective_to: Mapped[str | None] = mapped_column(String(32), nullable=True)
    supersedes_assertion_id: Mapped[str | None] = mapped_column(ForeignKey("assertions.id", ondelete="SET NULL"), nullable=True)
    status_record: Mapped[str] = mapped_column(String(20), default="active", index=True)
    revision: Mapped[int] = mapped_column(default=1)

    artifact_links: Mapped[list[AssertionEvidenceLink]] = relationship(
        "AssertionEvidenceLink", back_populates="assertion", cascade="all, delete-orphan"
    )
    reviews: Mapped[list[AssertionReview]] = relationship(
        "AssertionReview", back_populates="assertion", cascade="all, delete-orphan", order_by="AssertionReview.reviewed_at"
    )


class AssertionEvidenceLink(Base):
    __tablename__ = "assertion_evidence_links"
    __table_args__ = (
        CheckConstraint("page_number IS NULL OR page_number >= 1", name="ck_assertion_evidence_page"),
    )

    assertion_id: Mapped[str] = mapped_column(ForeignKey("assertions.id", ondelete="CASCADE"), primary_key=True)
    artifact_id: Mapped[str] = mapped_column(ForeignKey("evidence_artifacts.id", ondelete="RESTRICT"), primary_key=True, index=True)
    page_number: Mapped[int | None] = mapped_column(Integer, nullable=True)

    assertion: Mapped[Assertion] = relationship("Assertion", back_populates="artifact_links")
    artifact: Mapped[EvidenceArtifact] = relationship("EvidenceArtifact", back_populates="assertion_links")


class AssertionReview(Base):
    __tablename__ = "assertion_reviews"
    __table_args__ = (
        CheckConstraint(f"review_status IN ({REVIEW_STATUSES})", name="ck_assertion_reviews_status"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    assertion_id: Mapped[str] = mapped_column(ForeignKey("assertions.id", ondelete="CASCADE"), index=True)
    reviewer_id: Mapped[str] = mapped_column(String(200))
    review_status: Mapped[str] = mapped_column(String(30))
    is_simulated: Mapped[bool] = mapped_column(Boolean, default=True)
    notes: Mapped[str] = mapped_column(String(2000))
    reviewed_at: Mapped[str] = mapped_column(String(32), default=utc_timestamp)

    assertion: Mapped[Assertion] = relationship("Assertion", back_populates="reviews")
