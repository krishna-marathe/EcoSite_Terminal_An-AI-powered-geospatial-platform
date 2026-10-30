"""Private operator registration, ministry review and publication linkage."""

from __future__ import annotations

from uuid import uuid4

from sqlalchemy import CheckConstraint, ForeignKey, Index, Integer, JSON, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from .projects import Base, utc_timestamp


class OperatorOrganisation(Base):
    __tablename__ = "operator_organisations"
    __table_args__ = (
        CheckConstraint("status IN ('pending', 'verified', 'suspended')", name="ck_operator_organisations_status"),
        CheckConstraint("length(trim(name)) BETWEEN 1 AND 200", name="ck_operator_organisations_name"),
    )

    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    registration_number: Mapped[str | None] = mapped_column(String(100), nullable=True, unique=True)
    facility_operator_id: Mapped[str | None] = mapped_column(
        ForeignKey("facility_operators.id", ondelete="SET NULL"), nullable=True, index=True
    )
    status: Mapped[str] = mapped_column(String(16), default="pending", index=True)
    created_at: Mapped[str] = mapped_column(String(32), default=utc_timestamp)
    updated_at: Mapped[str] = mapped_column(String(32), default=utc_timestamp)


class FacilitySubmission(Base):
    __tablename__ = "facility_submissions"
    __table_args__ = (
        CheckConstraint(
            "status IN ('draft', 'submitted', 'under_review', 'information_requested', "
            "'resubmitted', 'approved', 'rejected', 'withdrawn')",
            name="ck_facility_submissions_status",
        ),
        CheckConstraint("current_revision >= 1", name="ck_facility_submissions_revision"),
        Index("ix_facility_submissions_queue", "status", "submitted_at"),
    )

    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    operator_organisation_id: Mapped[str] = mapped_column(
        ForeignKey("operator_organisations.id", ondelete="RESTRICT"), index=True
    )
    status: Mapped[str] = mapped_column(String(24), default="draft", index=True)
    current_revision: Mapped[int] = mapped_column(Integer, default=1)
    assigned_reviewer_id: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    submitted_at: Mapped[str | None] = mapped_column(String(32), nullable=True)
    decided_at: Mapped[str | None] = mapped_column(String(32), nullable=True)
    created_at: Mapped[str] = mapped_column(String(32), default=utc_timestamp)
    updated_at: Mapped[str] = mapped_column(String(32), default=utc_timestamp)


class FacilitySubmissionRevision(Base):
    __tablename__ = "facility_submission_revisions"
    __table_args__ = (
        UniqueConstraint("submission_id", "revision", name="uq_facility_submission_revisions_number"),
        CheckConstraint("revision >= 1", name="ck_facility_submission_revisions_number"),
        CheckConstraint("facility_type IN ('colocation', 'hyperscale', 'enterprise', 'edge', 'government', 'other')", name="ck_facility_submission_revisions_type"),
        CheckConstraint("ownership_category IN ('private', 'government', 'ppp', 'other', 'unknown')", name="ck_facility_submission_revisions_ownership"),
        CheckConstraint("state_code IN ('IN-MH', 'IN-TG', 'IN-KA', 'IN-TN')", name="ck_facility_submission_revisions_state"),
        CheckConstraint("actor_role IN ('operator', 'ministry_reviewer', 'system')", name="ck_facility_submission_revisions_actor"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    submission_id: Mapped[str] = mapped_column(ForeignKey("facility_submissions.id", ondelete="CASCADE"), index=True)
    revision: Mapped[int] = mapped_column(Integer)
    facility_name: Mapped[str] = mapped_column(String(200))
    facility_type: Mapped[str] = mapped_column(String(20))
    ownership_category: Mapped[str] = mapped_column(String(20))
    state_code: Mapped[str] = mapped_column(String(5))
    city: Mapped[str] = mapped_column(String(100))
    locality: Mapped[str] = mapped_column(String(200))
    operational_since: Mapped[int | None] = mapped_column(Integer, nullable=True)
    capacity_disclosures: Mapped[list] = mapped_column(JSON, default=list)
    actor_id: Mapped[str] = mapped_column(String(100))
    actor_role: Mapped[str] = mapped_column(String(24))
    change_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[str] = mapped_column(String(32), default=utc_timestamp)


class SubmissionExactGeometry(Base):
    __tablename__ = "submission_exact_geometries"
    __table_args__ = (
        UniqueConstraint("revision_id", name="uq_submission_exact_geometries_revision"),
        CheckConstraint("geometry_type IN ('Point', 'Polygon', 'MultiPolygon')", name="ck_submission_exact_geometries_type"),
        CheckConstraint("visibility = 'OPERATOR_PRIVATE'", name="ck_submission_exact_geometries_visibility"),
        CheckConstraint("length(geometry_sha256) = 64", name="ck_submission_exact_geometries_hash"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    revision_id: Mapped[str] = mapped_column(
        ForeignKey("facility_submission_revisions.id", ondelete="CASCADE"), index=True
    )
    geometry_type: Mapped[str] = mapped_column(String(20))
    geometry_json: Mapped[dict] = mapped_column(JSON)
    geometry_sha256: Mapped[str] = mapped_column(String(64))
    visibility: Mapped[str] = mapped_column(String(24), default="OPERATOR_PRIVATE")
    created_at: Mapped[str] = mapped_column(String(32), default=utc_timestamp)


class SubmissionEvidence(Base):
    __tablename__ = "submission_evidence"
    __table_args__ = (
        CheckConstraint("evidence_class IN ('DECLARED', 'DOCUMENTED', 'AUTHORITY_VERIFIED')", name="ck_submission_evidence_class"),
        CheckConstraint("visibility IN ('OPERATOR_PRIVATE', 'MINISTRY', 'REGULATOR_RESTRICTED')", name="ck_submission_evidence_visibility"),
        CheckConstraint("storage_path IS NOT NULL OR external_url IS NOT NULL", name="ck_submission_evidence_location"),
        CheckConstraint("file_size_bytes IS NULL OR file_size_bytes >= 0", name="ck_submission_evidence_size"),
        CheckConstraint("sha256 IS NULL OR length(sha256) = 64", name="ck_submission_evidence_hash"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    revision_id: Mapped[str] = mapped_column(
        ForeignKey("facility_submission_revisions.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(300))
    evidence_type: Mapped[str] = mapped_column(String(100))
    storage_path: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    external_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    sha256: Mapped[str | None] = mapped_column(String(64), nullable=True)
    content_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    file_size_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    issuer: Mapped[str | None] = mapped_column(String(200), nullable=True)
    issued_at: Mapped[str | None] = mapped_column(String(32), nullable=True)
    evidence_class: Mapped[str] = mapped_column(String(30))
    visibility: Mapped[str] = mapped_column(String(24), default="OPERATOR_PRIVATE")
    created_at: Mapped[str] = mapped_column(String(32), default=utc_timestamp)


class ReviewEvent(Base):
    __tablename__ = "review_events"
    __table_args__ = (
        CheckConstraint(
            "action IN ('assign', 'start_review', 'request_information', 'resubmit', 'approve', 'reject', 'withdraw', 'comment')",
            name="ck_review_events_action",
        ),
        CheckConstraint("actor_role IN ('operator', 'ministry_reviewer', 'system')", name="ck_review_events_actor"),
        Index("ix_review_events_submission_time", "submission_id", "created_at"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    submission_id: Mapped[str] = mapped_column(ForeignKey("facility_submissions.id", ondelete="CASCADE"), index=True)
    revision_id: Mapped[str] = mapped_column(
        ForeignKey("facility_submission_revisions.id", ondelete="RESTRICT"), index=True
    )
    action: Mapped[str] = mapped_column(String(32))
    actor_id: Mapped[str] = mapped_column(String(100))
    actor_role: Mapped[str] = mapped_column(String(24))
    from_status: Mapped[str] = mapped_column(String(24))
    to_status: Mapped[str] = mapped_column(String(24))
    reason: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    requested_fields: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[str] = mapped_column(String(32), default=utc_timestamp)


class PublicationSnapshot(Base):
    """Immutable approval linkage to the existing public snapshot store."""

    __tablename__ = "publication_snapshots"
    __table_args__ = (
        UniqueConstraint("submission_id", "publication_version", name="uq_publication_snapshots_version"),
        UniqueConstraint("public_snapshot_id", name="uq_publication_snapshots_public_snapshot"),
        CheckConstraint("publication_version >= 1", name="ck_publication_snapshots_version"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    submission_id: Mapped[str] = mapped_column(ForeignKey("facility_submissions.id", ondelete="RESTRICT"), index=True)
    revision_id: Mapped[str] = mapped_column(
        ForeignKey("facility_submission_revisions.id", ondelete="RESTRICT"), index=True
    )
    review_event_id: Mapped[str] = mapped_column(ForeignKey("review_events.id", ondelete="RESTRICT"), unique=True)
    public_facility_id: Mapped[str] = mapped_column(ForeignKey("public_facilities.id", ondelete="RESTRICT"), index=True)
    public_snapshot_id: Mapped[str] = mapped_column(
        ForeignKey("public_facility_snapshots.id", ondelete="RESTRICT"), index=True
    )
    publication_version: Mapped[int] = mapped_column(Integer)
    payload_sha256: Mapped[str] = mapped_column(String(64))
    published_by: Mapped[str] = mapped_column(String(100))
    published_at: Mapped[str] = mapped_column(String(32))


class AuditEvent(Base):
    __tablename__ = "audit_events"
    __table_args__ = (
        CheckConstraint("actor_role IN ('operator', 'ministry_reviewer', 'system')", name="ck_audit_events_actor"),
        Index("ix_audit_events_entity_time", "entity_type", "entity_id", "occurred_at"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    submission_id: Mapped[str | None] = mapped_column(
        ForeignKey("facility_submissions.id", ondelete="SET NULL"), nullable=True, index=True
    )
    actor_id: Mapped[str] = mapped_column(String(100))
    actor_role: Mapped[str] = mapped_column(String(24))
    action: Mapped[str] = mapped_column(String(100))
    entity_type: Mapped[str] = mapped_column(String(100))
    entity_id: Mapped[str] = mapped_column(String(100))
    request_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)
    occurred_at: Mapped[str] = mapped_column(String(32))

