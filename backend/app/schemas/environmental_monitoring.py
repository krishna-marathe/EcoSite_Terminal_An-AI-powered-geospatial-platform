"""Public response schemas for cached environmental monitoring context."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import (
    AwareDatetime,
    BaseModel,
    ConfigDict,
    Field,
    HttpUrl,
    TypeAdapter,
    field_validator,
    model_validator,
)

_URL_ADAPTER = TypeAdapter(HttpUrl)
DEFAULT_PROVENANCE_URL = "https://data.gov.in"

from .public_facilities import StateCode


MetricKey = Literal[
    "aqi",
    "pm25",
    "pm10",
    "no2",
    "so2",
    "co",
    "o3",
    "temperature",
    "relative_humidity",
    "rainfall",
    "wind_speed",
    "wind_direction",
    "groundwater_depth",
    "groundwater_assessment",
]
Availability = Literal["AVAILABLE", "PARTIAL", "STALE", "SOURCE_UNAVAILABLE", "NOT_COVERED", "UNKNOWN"]
ObservationQuality = Literal["preliminary", "validated", "unknown"]
RangeValue = Literal["24h", "7d", "30d", "90d", "1y"]
IntervalValue = Literal["auto", "raw", "hour", "day"]
EvidenceClass = Literal[
    "measured",
    "authority_verified",
    "operator_declared",
    "documented_public",
    "derived",
    "modelled",
    "unavailable",
]
TemporalClass = Literal["stable", "periodic", "near_real_time", "live_private", "derived"]


class StationContext(BaseModel):
    model_config = ConfigDict(extra="forbid")

    stationId: str = Field(min_length=1, max_length=200)
    name: str = Field(min_length=1, max_length=300)
    provider: str = Field(min_length=1, max_length=300)
    sourceId: str = Field(min_length=1, max_length=100)
    publicCoordinates: tuple[float, float]
    stationType: str = Field(min_length=1, max_length=100)
    distanceKm: float = Field(ge=0)
    selectionMethod: Literal["nearest_eligible", "same_district", "manual_authority_mapping"]
    effectiveAt: AwareDatetime

    @model_validator(mode="after")
    def valid_public_location(self):
        longitude, latitude = self.publicCoordinates
        if not (-180 <= longitude <= 180 and -90 <= latitude <= 90):
            raise ValueError("Station coordinates must be valid longitude/latitude")
        return self


class EnvironmentalProvenance(BaseModel):
    model_config = ConfigDict(extra="forbid")

    sourceId: str = Field(min_length=1, max_length=100)
    provider: str = Field(min_length=1, max_length=300)
    dataset: str = Field(min_length=1, max_length=300)
    sourceUrl: HttpUrl
    retrievedAt: AwareDatetime
    evidenceClass: EvidenceClass
    temporalClass: TemporalClass
    visibility: Literal["public"]

    @field_validator("sourceUrl", mode="before")
    @classmethod
    def validate_source_url(cls, v: Any) -> Any:
        if isinstance(v, HttpUrl):
            return v
        if not v or not isinstance(v, str):
            return DEFAULT_PROVENANCE_URL
        url_str = v.strip()
        if not url_str:
            return DEFAULT_PROVENANCE_URL
        try:
            _URL_ADAPTER.validate_python(url_str)
            return url_str
        except Exception:
            return DEFAULT_PROVENANCE_URL



class CurrentEnvironmentalMetric(BaseModel):
    model_config = ConfigDict(extra="forbid")

    metric: MetricKey
    displayName: str
    value: float | str | None
    unit: str
    originalValue: float | str | None
    originalUnit: str | None
    availability: Availability
    quality: ObservationQuality
    observedAt: AwareDatetime | None
    publishedAt: AwareDatetime | None
    retrievedAt: AwareDatetime | None
    freshUntil: AwareDatetime | None
    qualityFlags: list[str]
    station: StationContext | None
    provenance: EnvironmentalProvenance | None
    contextNotice: str

    @model_validator(mode="after")
    def unavailable_has_no_invented_value(self):
        if self.availability in {"SOURCE_UNAVAILABLE", "NOT_COVERED"} and self.value is not None:
            raise ValueError("Unavailable environmental metrics must not invent a value")
        return self


class EnvironmentalCurrentResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    facilityId: str
    generatedAt: AwareDatetime
    metrics: list[CurrentEnvironmentalMetric]


class EnvironmentalPoint(BaseModel):
    model_config = ConfigDict(extra="forbid")

    timestamp: AwareDatetime
    value: float | str | None
    originalValue: float | str | None = None
    originalUnit: str | None = None
    minimum: float | None
    maximum: float | None
    sampleCount: int = Field(ge=0)
    coverageFraction: float = Field(ge=0, le=1)
    qualityFlags: list[str]


class EnvironmentalSeries(BaseModel):
    model_config = ConfigDict(extra="forbid")

    metric: MetricKey
    displayName: str
    unit: str
    availability: Availability
    quality: ObservationQuality
    coverageFraction: float = Field(ge=0, le=1)
    expectedSampleCount: int = Field(ge=0)
    validSampleCount: int = Field(ge=0)
    station: StationContext | None
    provenance: EnvironmentalProvenance | None
    points: list[EnvironmentalPoint]
    contextNotice: str


class EnvironmentalRangeResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    facilityId: str
    range: RangeValue
    interval: Literal["raw", "hour", "day"]
    from_: AwareDatetime = Field(alias="from", serialization_alias="from")
    to: AwareDatetime
    generatedAt: AwareDatetime
    series: list[EnvironmentalSeries]


class EnvironmentalSummaryMetric(BaseModel):
    model_config = ConfigDict(extra="forbid")

    metric: MetricKey
    displayName: str
    unit: str
    availability: Availability
    coveredFacilityCount: int = Field(ge=0)
    currentFacilityCount: int = Field(ge=0)
    staleFacilityCount: int = Field(ge=0)
    unavailableFacilityCount: int = Field(ge=0)
    minimum: float | None
    maximum: float | None
    mean: float | None
    aggregationMethod: str
    contextNotice: str


class SourceHealth(BaseModel):
    model_config = ConfigDict(extra="forbid")

    sourceId: str
    status: Literal["NOT_CONNECTED", "CONNECTED", "STALE", "SOURCE_UNAVAILABLE"]
    lastCheckedAt: AwareDatetime | None
    lastSuccessAt: AwareDatetime | None


class EnvironmentalStateSummaryResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    stateCode: StateCode
    range: RangeValue
    generatedAt: AwareDatetime
    facilityCount: int = Field(ge=0)
    coveredFacilityCount: int = Field(ge=0)
    metrics: list[EnvironmentalSummaryMetric]
    sourceHealth: list[SourceHealth]


class RegulatoryWaterParameter(BaseModel):
    model_config = ConfigDict(extra="ignore")

    parameter_name: str
    consented_quantity: float | None = None
    actual_quantity: float | None = None
    unit: str
    status: str


class RegulatoryWaterObservation(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    reporting_facility: str
    operator: str
    site_code: str
    state: str
    district: str
    locality: str
    regulatory_authority: str
    document_type: str
    identification_number: str
    proposal_number: str | None = None
    reporting_period: str
    measurement_boundary: str
    parameters: list[RegulatoryWaterParameter]
    water_source: str
    cooling_configuration: str
    wastewater_management: str
    source_document: str
    source_url: str
    page_or_reference: str
    site_match_status: str
    cross_site_prohibition: str


class RegulatoryWaterRegistryResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    registry_version: str
    generated_at: str
    description: str
    epistemic_guards: list[str]
    count: int
    observations: list[RegulatoryWaterObservation]
