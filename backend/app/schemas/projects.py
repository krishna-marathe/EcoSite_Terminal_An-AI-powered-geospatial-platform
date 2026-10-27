from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

Archetype = Literal["enterprise", "colocation", "hyperscale", "edge", "other"]
Stage = Literal["concept", "feasibility", "design", "construction", "operational"]
Status = Literal["active", "archived"]


class ProjectCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    name: str = Field(min_length=1, max_length=200)
    organization_label: str = Field(min_length=1, max_length=200)
    archetype: Archetype
    stage: Stage = "concept"


class ProjectPatch(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    expected_revision: int = Field(ge=1, strict=True)
    name: str | None = Field(default=None, min_length=1, max_length=200)
    organization_label: str | None = Field(default=None, min_length=1, max_length=200)
    archetype: Archetype | None = None
    stage: Stage | None = None
    status: Status | None = None

    @model_validator(mode="after")
    def require_changes(self):
        changes = self.model_fields_set - {"expected_revision"}
        if not changes or any(getattr(self, field) is None for field in changes):
            raise ValueError("Supply at least one non-null project field to update.")
        return self


class ProjectRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    name: str
    organization_label: str
    archetype: Archetype
    stage: Stage
    revision: int
    status: Status
    created_at: datetime
    updated_at: datetime


class ProjectPage(BaseModel):
    items: list[ProjectRead]
    total: int
    page: int
    page_size: int
