from datetime import date, datetime
from typing import Annotated, Literal
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field, model_validator

Positive = Annotated[float, Field(gt=0, allow_inf_nan=False, strict=True)]
Water = Annotated[float, Field(ge=0, allow_inf_nan=False, strict=True)]
Pue = Annotated[float, Field(ge=1, allow_inf_nan=False, strict=True)]

class PhaseCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    sequence: int = Field(gt=0, strict=True)
    name: str = Field(min_length=1, max_length=200)
    commissioning_date: date
    cumulative_it_mw: Positive
    cumulative_facility_peak_mw: Positive
    design_pue: Pue
    average_water_kld: Water
    peak_summer_water_kld: Water
    cooling_type: str = Field(min_length=1, max_length=100)

    @model_validator(mode="after")
    def consistent(self):
        if self.cumulative_facility_peak_mw < self.cumulative_it_mw:
            raise ValueError("Facility peak MW must be at least IT MW.")
        if self.peak_summer_water_kld < self.average_water_kld:
            raise ValueError("Peak-summer water must be at least average water.")
        return self

class PhasePatch(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    expected_revision: int = Field(gt=0, strict=True)
    name: str | None = Field(default=None, min_length=1, max_length=200)
    commissioning_date: date | None = None
    cumulative_it_mw: Positive | None = None
    cumulative_facility_peak_mw: Positive | None = None
    design_pue: Pue | None = None
    average_water_kld: Water | None = None
    peak_summer_water_kld: Water | None = None
    cooling_type: str | None = Field(default=None, min_length=1, max_length=100)
    status: Literal["active", "archived"] | None = None

    @model_validator(mode="after")
    def nonempty(self):
        fields = self.model_fields_set - {"expected_revision"}
        if not fields or any(getattr(self, key) is None for key in fields):
            raise ValueError("Supply non-null changed fields.")
        return self

class PhaseRead(PhaseCreate):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    project_id: UUID
    revision: int
    status: Literal["active", "archived"]
    created_at: datetime
    updated_at: datetime
    warnings: list[str]
