"""ORM metadata for the compatibility-only synthetic facility table."""

from sqlalchemy import Integer, Text
from sqlalchemy.dialects.sqlite import REAL
from sqlalchemy.orm import Mapped, mapped_column

from .projects import Base


class LegacyFacility(Base):
    """Historical demo/planning payload; never use as the public registry."""

    __tablename__ = "facilities"

    id: Mapped[str] = mapped_column(Text, primary_key=True, nullable=True)
    name: Mapped[str] = mapped_column(Text)
    type: Mapped[str] = mapped_column(Text)
    state: Mapped[str] = mapped_column(Text)
    district: Mapped[str] = mapped_column(Text)
    longitude: Mapped[float] = mapped_column(REAL)
    latitude: Mapped[float] = mapped_column(REAL)
    risk_score: Mapped[int] = mapped_column(Integer)
    risk_level: Mapped[str] = mapped_column(Text)
    payload: Mapped[str] = mapped_column(Text)
    updated_at: Mapped[str] = mapped_column(Text)

