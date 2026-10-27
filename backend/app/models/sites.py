from uuid import uuid4

from sqlalchemy import CheckConstraint, ForeignKey, JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from .projects import Base, utc_timestamp


class CandidateSite(Base):
    __tablename__ = "candidate_sites"
    __table_args__ = (
        CheckConstraint("revision >= 1", name="ck_sites_revision"),
        CheckConstraint("status IN ('active', 'archived')", name="ck_sites_status"),
        CheckConstraint("area_ha > 0", name="ck_sites_area"),
        CheckConstraint("length(trim(name)) BETWEEN 1 AND 200", name="ck_sites_name"),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="RESTRICT"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    geometry: Mapped[dict] = mapped_column(JSON)
    area_ha: Mapped[float]
    state_code: Mapped[str] = mapped_column(String(5))
    district: Mapped[str | None] = mapped_column(String(100), nullable=True)
    geometry_hash: Mapped[str] = mapped_column(String(64))
    boundary_sha256: Mapped[str] = mapped_column(String(64))
    boundary_source: Mapped[str] = mapped_column(String(500))
    boundary_screening: Mapped[dict] = mapped_column(JSON, default=dict, server_default="{}")
    revision: Mapped[int] = mapped_column(default=1)
    status: Mapped[str] = mapped_column(String(10), default="active")
    created_at: Mapped[str] = mapped_column(String(32), default=utc_timestamp)
    updated_at: Mapped[str] = mapped_column(String(32), default=utc_timestamp)
