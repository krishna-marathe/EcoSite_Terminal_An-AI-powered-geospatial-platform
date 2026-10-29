"""Public response schema for the facility environmental risk score."""
from __future__ import annotations

from typing import Literal

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, HttpUrl, model_validator

RiskBand = Literal["low", "moderate", "high", "critical", "unknown"]


class RiskParameter(BaseModel):
    model_config = ConfigDict(extra="forbid")

    key: str = Field(min_length=1, max_length=100)
    label: str = Field(min_length=1, max_length=200)
    unit: str = Field(min_length=1, max_length=40)
    weight: float = Field(ge=0, le=1)
    value: float | None
    score: float | None = Field(default=None, ge=0, le=100)
    status: Literal["AVAILABLE", "UNAVAILABLE"]
    note: str
    reason: str | None = None
    observedAt: AwareDatetime | None = None
    provider: str | None = None
    sourceUrl: HttpUrl | None = None
    quality: str | None = None
    detail: dict[str, object] = Field(default_factory=dict)

    @model_validator(mode="after")
    def unavailable_has_no_score(self):
        if self.status == "UNAVAILABLE":
            if self.value is not None or self.score is not None:
                raise ValueError("An unavailable risk parameter must not carry a value or score")
            if not self.reason:
                raise ValueError("An unavailable risk parameter must explain why")
        return self


class RiskScoreResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    facilityId: str
    score: float | None = Field(default=None, ge=0, le=100)
    band: RiskBand
    coverage: float = Field(ge=0, le=1)
    availableWeight: float = Field(ge=0, le=1)
    confidence: Literal["high", "medium", "low"]
    scoreVersion: str
    generatedAt: AwareDatetime
    parameters: list[RiskParameter]
    notes: list[str]
    providerErrors: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def unknown_band_has_no_score(self):
        if self.score is None and self.band != "unknown":
            raise ValueError("A missing score must report the unknown band")
        if self.score is not None and self.band == "unknown":
            raise ValueError("A score must report its band")
        return self
