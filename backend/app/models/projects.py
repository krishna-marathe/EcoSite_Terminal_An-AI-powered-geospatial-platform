from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import CheckConstraint, String
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def utc_timestamp():
    return datetime.now(timezone.utc).isoformat()


class Base(DeclarativeBase):
    pass


class Project(Base):
    __tablename__ = "projects"
    __table_args__ = (
        CheckConstraint("revision >= 1", name="ck_projects_revision"),
        CheckConstraint("status IN ('active', 'archived')", name="ck_projects_status"),
        CheckConstraint("archetype IN ('enterprise', 'colocation', 'hyperscale', 'edge', 'other')", name="ck_projects_archetype"),
        CheckConstraint("stage IN ('concept', 'feasibility', 'design', 'construction', 'operational')", name="ck_projects_stage"),
        CheckConstraint("length(trim(name)) BETWEEN 1 AND 200", name="ck_projects_name"),
        CheckConstraint("length(trim(organization_label)) BETWEEN 1 AND 200", name="ck_projects_organization"),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String(200))
    organization_label: Mapped[str] = mapped_column(String(200))
    archetype: Mapped[str] = mapped_column(String(20))
    stage: Mapped[str] = mapped_column(String(20), default="concept")
    revision: Mapped[int] = mapped_column(default=1)
    status: Mapped[str] = mapped_column(String(10), default="active", index=True)
    created_at: Mapped[str] = mapped_column(String(32), default=utc_timestamp)
    updated_at: Mapped[str] = mapped_column(String(32), default=utc_timestamp)
