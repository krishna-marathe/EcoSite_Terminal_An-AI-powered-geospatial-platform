"""Restricted ministry operational-dashboard schemas."""
from __future__ import annotations

from typing import Literal

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field

from .environmental_monitoring import MetricKey
from .public_facilities import StateCode


class FacilityFreshnessRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    facilityId: str
    facilityName: str
    stateCode: StateCode
    metric: MetricKey | Literal["all"]
    status: str
    observedAt: AwareDatetime | None
    ageSeconds: int | None = Field(default=None, ge=0)
    sourceId: str | None
    reason: str | None


class MinistrySourceHealthRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    sourceId: str
    provider: str
    status: str
    lastCheckedAt: AwareDatetime | None
    lastSuccessAt: AwareDatetime | None
    staleFacilityCount: int = Field(ge=0)
    failedRunCount: int = Field(ge=0)


class MinistryStateSummaryRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    stateCode: StateCode
    facilityCount: int = Field(ge=0)
    currentFacilityCount: int = Field(ge=0)
    staleFacilityCount: int = Field(ge=0)
    unavailableFacilityCount: int = Field(ge=0)


class MinistryOverviewRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    generatedAt: AwareDatetime
    facilityCount: int = Field(ge=0)
    states: list[MinistryStateSummaryRead]
    sourceHealth: list[MinistrySourceHealthRead]
    freshnessQueue: list[FacilityFreshnessRead]


class MinistryFreshnessQueueRead(BaseModel):
    generatedAt: AwareDatetime
    items: list[FacilityFreshnessRead]
    total: int = Field(ge=0)


class MinistryFacilitySummaryRead(BaseModel):
    generatedAt: AwareDatetime
    facilityId: str
    facilityName: str
    stateCode: StateCode
    metrics: list[FacilityFreshnessRead]
