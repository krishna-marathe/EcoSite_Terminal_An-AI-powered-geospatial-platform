"""Normalized public data-centre registry models.

These tables contain reviewed public facts and generalized coordinates only.
Restricted operator-submitted geometry belongs to a later private workflow and
must never be added to these models.
"""

from __future__ import annotations

from uuid import uuid4

from sqlalchemy import Boolean, CheckConstraint, Float, ForeignKey, Integer, JSON, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from .projects import Base, utc_timestamp


OWNERSHIP_CATEGORIES = ("private", "government", "ppp", "other", "unknown")
FACILITY_TYPES = ("colocation", "hyperscale", "enterprise", "edge", "government", "other")
STATE_CODES = ("IN-MH", "IN-TG", "IN-KA", "IN-TN")
LOCATION_PRECISIONS = ("locality", "district")
CAPACITY_UNITS = ("MW", "MVA")
CAPACITY_TYPES = ("it_load", "total_power", "power_capacity", "power_capacity_unspecified")
SOURCE_CLASSES = (
    "government", "operator", "operator_factsheet", "filing", "certification",
    "news", "industry_publication", "directory",
)
VERIFICATION_STATUSES = ("government_verified", "public_operator_confirmed", "credible_public_report")


def _quoted(values: tuple[str, ...]) -> str:
    return ", ".join(f"'{value}'" for value in values)


class FacilityOperator(Base):
    __tablename__ = "facility_operators"
    __table_args__ = (
        CheckConstraint("length(trim(name)) BETWEEN 1 AND 200", name="ck_facility_operators_name"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String(200), unique=True)
    canonical_name: Mapped[str] = mapped_column(String(200), unique=True)
    created_at: Mapped[str] = mapped_column(String(32), default=utc_timestamp)
    updated_at: Mapped[str] = mapped_column(String(32), default=utc_timestamp)


class PublicFacilityRecord(Base):
    __tablename__ = "public_facilities"
    __table_args__ = (
        CheckConstraint(f"ownership_category IN ({_quoted(OWNERSHIP_CATEGORIES)})", name="ck_public_facilities_ownership"),
        CheckConstraint(f"facility_type IN ({_quoted(FACILITY_TYPES)})", name="ck_public_facilities_type"),
        CheckConstraint(f"state_code IN ({_quoted(STATE_CODES)})", name="ck_public_facilities_state"),
        CheckConstraint(f"location_precision IN ({_quoted(LOCATION_PRECISIONS)})", name="ck_public_facilities_precision"),
        CheckConstraint("public_longitude BETWEEN -180 AND 180", name="ck_public_facilities_longitude"),
        CheckConstraint("public_latitude BETWEEN -90 AND 90", name="ck_public_facilities_latitude"),
        CheckConstraint("operational_since IS NULL OR operational_since BETWEEN 1990 AND 2100", name="ck_public_facilities_operational_since"),
        CheckConstraint("visibility = 'PUBLIC'", name="ck_public_facilities_visibility"),
        CheckConstraint("temporal_class = 'STATIC_VERSIONED'", name="ck_public_facilities_temporal"),
    )

    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    operator_id: Mapped[str] = mapped_column(ForeignKey("facility_operators.id", ondelete="RESTRICT"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    ownership_category: Mapped[str] = mapped_column(String(20))
    facility_type: Mapped[str] = mapped_column(String(20), index=True)
    state_code: Mapped[str] = mapped_column(String(5), index=True)
    state_name: Mapped[str] = mapped_column(String(100))
    city: Mapped[str] = mapped_column(String(100), index=True)
    locality: Mapped[str] = mapped_column(String(200))
    public_longitude: Mapped[float] = mapped_column(Float)
    public_latitude: Mapped[float] = mapped_column(Float)
    location_precision: Mapped[str] = mapped_column(String(20))
    operational_since: Mapped[int | None] = mapped_column(Integer, nullable=True)
    registry_version: Mapped[str] = mapped_column(String(64))
    visibility: Mapped[str] = mapped_column(String(24), default="PUBLIC")
    temporal_class: Mapped[str] = mapped_column(String(24), default="STATIC_VERSIONED")
    created_at: Mapped[str] = mapped_column(String(32), default=utc_timestamp)
    updated_at: Mapped[str] = mapped_column(String(32), default=utc_timestamp)


class FacilityAlias(Base):
    __tablename__ = "facility_aliases"
    __table_args__ = (
        UniqueConstraint("facility_id", "normalized_alias", name="uq_facility_aliases_facility_alias"),
        CheckConstraint("alias_type IN ('former_name', 'operator_name', 'campus_name', 'other')", name="ck_facility_aliases_type"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    facility_id: Mapped[str] = mapped_column(ForeignKey("public_facilities.id", ondelete="CASCADE"), index=True)
    alias: Mapped[str] = mapped_column(String(200))
    normalized_alias: Mapped[str] = mapped_column(String(200))
    alias_type: Mapped[str] = mapped_column(String(20))
    created_at: Mapped[str] = mapped_column(String(32), default=utc_timestamp)


class FacilityCapacityDisclosure(Base):
    __tablename__ = "facility_capacity_disclosures"
    __table_args__ = (
        CheckConstraint("value > 0", name="ck_facility_capacity_value"),
        CheckConstraint(f"unit IN ({_quoted(CAPACITY_UNITS)})", name="ck_facility_capacity_unit"),
        CheckConstraint(f"capacity_type IN ({_quoted(CAPACITY_TYPES)})", name="ck_facility_capacity_type"),
        CheckConstraint("length(trim(scope)) BETWEEN 1 AND 100", name="ck_facility_capacity_scope"),
        UniqueConstraint("facility_id", "ordinal", name="uq_facility_capacity_ordinal"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    facility_id: Mapped[str] = mapped_column(ForeignKey("public_facilities.id", ondelete="CASCADE"), index=True)
    ordinal: Mapped[int] = mapped_column(Integer)
    value: Mapped[float] = mapped_column(Float)
    unit: Mapped[str] = mapped_column(String(8))
    capacity_type: Mapped[str] = mapped_column(String(40))
    scope: Mapped[str] = mapped_column(String(100))
    visibility: Mapped[str] = mapped_column(String(24), default="PUBLIC")
    temporal_class: Mapped[str] = mapped_column(String(24), default="STATIC_VERSIONED")
    created_at: Mapped[str] = mapped_column(String(32), default=utc_timestamp)


class FacilitySource(Base):
    __tablename__ = "facility_sources"
    __table_args__ = (
        CheckConstraint(f"source_class IN ({_quoted(SOURCE_CLASSES)})", name="ck_facility_sources_class"),
        CheckConstraint("evidence_class = 'DOCUMENTED'", name="ck_facility_sources_evidence"),
        CheckConstraint("visibility = 'PUBLIC'", name="ck_facility_sources_visibility"),
        UniqueConstraint("facility_id", "url", "retrieved_at", name="uq_facility_sources_retrieval"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    facility_id: Mapped[str] = mapped_column(ForeignKey("public_facilities.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(300))
    publisher: Mapped[str] = mapped_column(String(200))
    url: Mapped[str] = mapped_column(String(1000))
    source_class: Mapped[str] = mapped_column(String(32))
    retrieved_at: Mapped[str] = mapped_column(String(10))
    evidence_class: Mapped[str] = mapped_column(String(30), default="DOCUMENTED")
    visibility: Mapped[str] = mapped_column(String(24), default="PUBLIC")
    created_at: Mapped[str] = mapped_column(String(32), default=utc_timestamp)


class FacilityVerification(Base):
    __tablename__ = "facility_verifications"
    __table_args__ = (
        CheckConstraint(f"status IN ({_quoted(VERIFICATION_STATUSES)})", name="ck_facility_verifications_status"),
        CheckConstraint("date(expires_at) > date(verified_at)", name="ck_facility_verifications_order"),
        CheckConstraint("julianday(expires_at) - julianday(verified_at) <= 90", name="ck_facility_verifications_window"),
        UniqueConstraint("facility_id", "verified_at", "source_id", name="uq_facility_verifications_event"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    facility_id: Mapped[str] = mapped_column(ForeignKey("public_facilities.id", ondelete="CASCADE"), index=True)
    source_id: Mapped[str] = mapped_column(ForeignKey("facility_sources.id", ondelete="RESTRICT"), index=True)
    status: Mapped[str] = mapped_column(String(40))
    verified_at: Mapped[str] = mapped_column(String(10), index=True)
    expires_at: Mapped[str] = mapped_column(String(10), index=True)
    created_at: Mapped[str] = mapped_column(String(32), default=utc_timestamp)


class PublicFacilitySnapshot(Base):
    __tablename__ = "public_facility_snapshots"
    __table_args__ = (
        UniqueConstraint("facility_id", "registry_version", name="uq_public_facility_snapshot_version"),
        CheckConstraint("approval_basis IN ('reviewed_public_seed', 'ministry_review')", name="ck_public_facility_snapshot_basis"),
        CheckConstraint("visibility = 'PUBLIC'", name="ck_public_facility_snapshot_visibility"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    facility_id: Mapped[str] = mapped_column(ForeignKey("public_facilities.id", ondelete="RESTRICT"), index=True)
    verification_id: Mapped[str] = mapped_column(ForeignKey("facility_verifications.id", ondelete="RESTRICT"), index=True)
    registry_version: Mapped[str] = mapped_column(String(64))
    payload: Mapped[dict] = mapped_column(JSON)
    payload_sha256: Mapped[str] = mapped_column(String(64))
    approval_basis: Mapped[str] = mapped_column(String(32))
    approved_by: Mapped[str] = mapped_column(String(200))
    approved_at: Mapped[str] = mapped_column(String(32))
    is_current: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    visibility: Mapped[str] = mapped_column(String(24), default="PUBLIC")
    created_at: Mapped[str] = mapped_column(String(32), default=utc_timestamp)

