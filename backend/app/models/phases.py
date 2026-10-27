from datetime import date
from uuid import uuid4
from sqlalchemy import CheckConstraint, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from .projects import Base, utc_timestamp

class ProjectPhase(Base):
    __tablename__ = "project_phases"
    __table_args__ = (
        UniqueConstraint("project_id", "sequence", name="uq_phase_sequence"),
        CheckConstraint("sequence > 0 AND revision > 0", name="ck_phase_sequence_revision"),
        CheckConstraint("cumulative_it_mw > 0 AND cumulative_facility_peak_mw >= cumulative_it_mw", name="ck_phase_loads"),
        CheckConstraint("design_pue >= 1 AND average_water_kld >= 0 AND peak_summer_water_kld >= average_water_kld", name="ck_phase_resources"),
        CheckConstraint("status IN ('active','archived')", name="ck_phase_status"),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="RESTRICT"), index=True)
    sequence: Mapped[int]
    name: Mapped[str] = mapped_column(String(200))
    commissioning_date: Mapped[date]
    cumulative_it_mw: Mapped[float]
    cumulative_facility_peak_mw: Mapped[float]
    design_pue: Mapped[float]
    average_water_kld: Mapped[float]
    peak_summer_water_kld: Mapped[float]
    cooling_type: Mapped[str] = mapped_column(String(100))
    revision: Mapped[int] = mapped_column(default=1)
    status: Mapped[str] = mapped_column(String(10), default="active")
    created_at: Mapped[str] = mapped_column(String(32), default=utc_timestamp)
    updated_at: Mapped[str] = mapped_column(String(32), default=utc_timestamp)

    @property
    def warnings(self):
        if abs(self.cumulative_facility_peak_mw / self.cumulative_it_mw - self.design_pue) > 0.05 + 1e-9:
            return ["Design PUE differs from facility peak MW / IT MW by more than 0.05. Review assumptions; peak demand and design PUE may use different operating conditions."]
        return []
