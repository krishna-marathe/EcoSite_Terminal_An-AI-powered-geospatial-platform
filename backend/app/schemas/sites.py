from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from ..geometry import validate_polygon


class SiteCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    name: str = Field(min_length=1, max_length=200)
    geometry: dict
    state_code: str = Field(pattern=r"^IN-[A-Z]{2}$")
    district: str | None = Field(default=None, min_length=1, max_length=100)

    @field_validator("geometry")
    @classmethod
    def polygon(cls, value):
        validate_polygon(value)
        return value


class SitePatch(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    expected_revision: int = Field(ge=1, strict=True)
    name: str | None = Field(default=None, min_length=1, max_length=200)
    geometry: dict | None = None
    state_code: str | None = Field(default=None, pattern=r"^IN-[A-Z]{2}$")
    district: str | None = Field(default=None, min_length=1, max_length=100)
    status: Literal["active", "archived"] | None = None

    @model_validator(mode="after")
    def changes(self):
        changed = self.model_fields_set - {"expected_revision"}
        if not changed or any(getattr(self, field) is None for field in changed - {"district"}):
            raise ValueError("Supply non-null changed fields; only district may be cleared.")
        if "geometry" in changed:
            validate_polygon(self.geometry)
        return self


class SiteRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    project_id: UUID
    name: str
    geometry: dict
    area_ha: float
    state_code: str
    district: str | None
    geometry_hash: str
    boundary_sha256: str
    boundary_source: str
    boundary_screening: dict
    revision: int
    status: Literal["active", "archived"]
    created_at: datetime
    updated_at: datetime
