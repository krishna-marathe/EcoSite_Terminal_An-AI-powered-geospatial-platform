from __future__ import annotations

from uuid import uuid4

from sqlalchemy import Boolean, CheckConstraint, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .projects import Base, utc_timestamp


POWER_COMMITMENT_TYPES = (
    "'GRID_SANCTION', 'GRID_ENERGIZED', 'GRID_ALLOCATION_PROPOSED', 'GRID_REQUESTED', "
    "'CAPTIVE_RENEWABLE', 'UNKNOWN_AVAILABILITY'"
)
POWER_COMMITMENT_STATUSES = (
    "'REQUESTED', 'PROPOSED', 'SANCTIONED', 'ENERGIZED', 'EXPIRED', 'CANCELLED', 'UNKNOWN'"
)
WATER_SOURCE_TYPES = (
    "'MUNICIPAL_PIPED', 'INDUSTRIAL_RECYCLED', 'SURFACE_WATER_IRRIGATION', "
    "'GROUNDWATER_NOC', 'RAINWATER_HARVESTING', 'UNKNOWN'"
)
WATER_COMMITMENT_STATUSES = (
    "'PROPOSED', 'ALLOCATED', 'OPERATIONAL', 'EXPIRED', 'CANCELLED', 'UNKNOWN'"
)
RESOURCE_SCOPE_TYPES = "'CAMPUS', 'PHASE', 'SITE'"
VERIFICATION_STATES = "'UNVERIFIED', 'DOCUMENTED', 'VERIFIED', 'SIMULATED'"


class PowerCommitment(Base):
    __tablename__ = "power_commitments"
    __table_args__ = (
        CheckConstraint("revision >= 1", name="ck_power_commitments_revision"),
        CheckConstraint("status_record IN ('active', 'archived')", name="ck_power_commitments_status_record"),
        CheckConstraint("capacity_mw >= 0", name="ck_power_commitments_capacity"),
        CheckConstraint(f"commitment_type IN ({POWER_COMMITMENT_TYPES})", name="ck_power_commitments_type"),
        CheckConstraint(f"status IN ({POWER_COMMITMENT_STATUSES})", name="ck_power_commitments_status"),
        CheckConstraint(f"scope_type IN ({RESOURCE_SCOPE_TYPES})", name="ck_power_commitments_scope"),
        CheckConstraint(f"verification_state IN ({VERIFICATION_STATES})", name="ck_power_commitments_verification"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="RESTRICT"), index=True)
    site_id: Mapped[str | None] = mapped_column(ForeignKey("candidate_sites.id", ondelete="RESTRICT"), nullable=True, index=True)
    phase_id: Mapped[str | None] = mapped_column(ForeignKey("project_phases.id", ondelete="RESTRICT"), nullable=True, index=True)
    scope_type: Mapped[str] = mapped_column(String(20), default="CAMPUS")
    commitment_type: Mapped[str] = mapped_column(String(40), default="GRID_SANCTION")
    capacity_mw: Mapped[float] = mapped_column(Float)
    status: Mapped[str] = mapped_column(String(30), default="PROPOSED", index=True)
    utility_provider: Mapped[str | None] = mapped_column(String(200), nullable=True)
    substation_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    voltage_kv: Mapped[float | None] = mapped_column(Float, nullable=True)
    effective_date: Mapped[str | None] = mapped_column(String(32), nullable=True)
    expiry_date: Mapped[str | None] = mapped_column(String(32), nullable=True)
    evidence_artifact_id: Mapped[str | None] = mapped_column(ForeignKey("evidence_artifacts.id", ondelete="SET NULL"), nullable=True, index=True)
    assertion_id: Mapped[str | None] = mapped_column(ForeignKey("assertions.id", ondelete="SET NULL"), nullable=True, index=True)
    is_synthetic: Mapped[bool] = mapped_column(Boolean, default=False)
    verification_state: Mapped[str] = mapped_column(String(30), default="UNVERIFIED")
    notes: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    revision: Mapped[int] = mapped_column(Integer, default=1)
    status_record: Mapped[str] = mapped_column(String(10), default="active", index=True)
    created_at: Mapped[str] = mapped_column(String(32), default=utc_timestamp)
    updated_at: Mapped[str] = mapped_column(String(32), default=utc_timestamp)


class WaterCommitment(Base):
    __tablename__ = "water_commitments"
    __table_args__ = (
        CheckConstraint("revision >= 1", name="ck_water_commitments_revision"),
        CheckConstraint("status_record IN ('active', 'archived')", name="ck_water_commitments_status_record"),
        CheckConstraint("allocated_kld >= 0", name="ck_water_commitments_quantity"),
        CheckConstraint(f"source_type IN ({WATER_SOURCE_TYPES})", name="ck_water_commitments_source"),
        CheckConstraint(f"status IN ({WATER_COMMITMENT_STATUSES})", name="ck_water_commitments_status"),
        CheckConstraint(f"scope_type IN ({RESOURCE_SCOPE_TYPES})", name="ck_water_commitments_scope"),
        CheckConstraint(f"verification_state IN ({VERIFICATION_STATES})", name="ck_water_commitments_verification"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="RESTRICT"), index=True)
    site_id: Mapped[str | None] = mapped_column(ForeignKey("candidate_sites.id", ondelete="RESTRICT"), nullable=True, index=True)
    phase_id: Mapped[str | None] = mapped_column(ForeignKey("project_phases.id", ondelete="RESTRICT"), nullable=True, index=True)
    scope_type: Mapped[str] = mapped_column(String(20), default="CAMPUS")
    source_type: Mapped[str] = mapped_column(String(40), default="MUNICIPAL_PIPED")
    allocated_kld: Mapped[float] = mapped_column(Float)
    status: Mapped[str] = mapped_column(String(30), default="PROPOSED", index=True)
    authority_issuer: Mapped[str | None] = mapped_column(String(200), nullable=True)
    allocation_reference: Mapped[str | None] = mapped_column(String(300), nullable=True)
    effective_date: Mapped[str | None] = mapped_column(String(32), nullable=True)
    expiry_date: Mapped[str | None] = mapped_column(String(32), nullable=True)
    evidence_artifact_id: Mapped[str | None] = mapped_column(ForeignKey("evidence_artifacts.id", ondelete="SET NULL"), nullable=True, index=True)
    assertion_id: Mapped[str | None] = mapped_column(ForeignKey("assertions.id", ondelete="SET NULL"), nullable=True, index=True)
    is_synthetic: Mapped[bool] = mapped_column(Boolean, default=False)
    verification_state: Mapped[str] = mapped_column(String(30), default="UNVERIFIED")
    notes: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    revision: Mapped[int] = mapped_column(Integer, default=1)
    status_record: Mapped[str] = mapped_column(String(10), default="active", index=True)
    created_at: Mapped[str] = mapped_column(String(32), default=utc_timestamp)
    updated_at: Mapped[str] = mapped_column(String(32), default=utc_timestamp)
