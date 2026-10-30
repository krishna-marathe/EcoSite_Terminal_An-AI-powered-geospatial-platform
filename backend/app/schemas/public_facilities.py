"""Public-only schemas for the operational data-centre registry.

These models deliberately contain generalized public coordinates only. Private
submission geometry belongs to a separate future ministry/operator contract.
"""
from __future__ import annotations

from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, model_validator


StateCode = Literal["IN-MH", "IN-TG", "IN-KA", "IN-TN"]
FacilityType = Literal["colocation", "hyperscale", "enterprise", "edge", "government", "other"]


class PublicSource(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=300)
    publisher: str = Field(min_length=1, max_length=200)
    url: HttpUrl
    sourceClass: Literal[
        "government",
        "operator",
        "operator_factsheet",
        "filing",
        "certification",
        "news",
        "industry_publication",
        "directory",
    ]
    retrievedAt: date


class PublicVerification(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: Literal["government_verified", "public_operator_confirmed", "credible_public_report"]
    verifiedAt: date
    expiresAt: date
    source: PublicSource

    @model_validator(mode="after")
    def valid_window(self):
        if self.expiresAt <= self.verifiedAt:
            raise ValueError("Verification expiry must follow verification date")
        if (self.expiresAt - self.verifiedAt).days > 90:
            raise ValueError("Operational verification may not exceed 90 days")
        return self


class CapacityDisclosure(BaseModel):
    model_config = ConfigDict(extra="forbid")

    value: float = Field(gt=0)
    unit: Literal["MW", "MVA"]
    capacityType: Literal["it_load", "total_power", "power_capacity", "power_capacity_unspecified"]
    scope: str = Field(min_length=1, max_length=100)


class PublicFacility(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(pattern=r"^[a-z0-9-]+$", min_length=3, max_length=100)
    name: str = Field(min_length=1, max_length=200)
    operator: str = Field(min_length=1, max_length=200)
    ownershipCategory: Literal["private", "government", "ppp", "other", "unknown"]
    facilityType: FacilityType
    stateCode: StateCode
    state: str = Field(min_length=1, max_length=100)
    city: str = Field(min_length=1, max_length=120)
    locality: str = Field(min_length=1, max_length=200)
    publicCoordinates: tuple[float, float]
    locationPrecision: Literal["locality", "district"]
    operationalSince: int | None = Field(default=None, ge=1990, le=2100)
    capacityDisclosures: list[CapacityDisclosure]
    verification: PublicVerification

    @model_validator(mode="after")
    def valid_public_location(self):
        longitude, latitude = self.publicCoordinates
        if not (-180 <= longitude <= 180 and -90 <= latitude <= 90):
            raise ValueError("Public coordinates must be valid longitude/latitude")
        return self


class PublicRegistry(BaseModel):
    model_config = ConfigDict(extra="forbid")

    registryVersion: str = Field(min_length=1, max_length=100)
    scope: list[StateCode]
    note: str
    facilities: list[PublicFacility]

    @model_validator(mode="after")
    def unique_facilities(self):
        ids = [facility.id for facility in self.facilities]
        if len(ids) != len(set(ids)):
            raise ValueError("Public facility IDs must be unique")
        return self


class PublicFacilityPage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[PublicFacility]
    page: int = Field(ge=1)
    pageSize: int = Field(ge=1, le=100)
    total: int = Field(ge=0)
    registryVersion: str
    asOf: date


class PublicFacilitySummary(BaseModel):
    model_config = ConfigDict(extra="forbid")

    registryVersion: str
    asOf: date
    operationalFacilityCount: int = Field(ge=0)
    operatorCount: int = Field(ge=0)
    byState: dict[StateCode, int]
    capacityAggregation: Literal["disabled_mixed_measurement_boundaries"]


class ErrorField(BaseModel):
    path: str
    message: str


class ApiErrorDetail(BaseModel):
    code: str
    message: str
    details: dict[str, object] = Field(default_factory=dict)
    requestId: str


class ApiError(BaseModel):
    error: ApiErrorDetail
