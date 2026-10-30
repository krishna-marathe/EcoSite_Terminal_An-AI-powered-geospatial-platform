"""Private operator-submission and ministry-review API schemas."""
from __future__ import annotations

from typing import Any, Literal

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, HttpUrl, TypeAdapter, model_validator

from .public_facilities import CapacityDisclosure, FacilityType, PublicVerification, StateCode


class ExactPointGeometry(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: Literal["Point"]
    coordinates: tuple[float, float]

    @model_validator(mode="after")
    def valid_coordinates(self):
        longitude, latitude = self.coordinates
        if not (-180 <= longitude <= 180 and -90 <= latitude <= 90):
            raise ValueError("Exact coordinates must be valid longitude/latitude")
        return self


class SubmissionEvidence(BaseModel):
    model_config = ConfigDict(extra="forbid")

    evidenceType: Literal["source_url", "document_reference"]
    title: str = Field(min_length=1, max_length=300)
    reference: str = Field(min_length=1, max_length=1000)
    fileSha256: str | None = Field(default=None, pattern=r"^[a-f0-9]{64}$")

    @model_validator(mode="after")
    def traceable_reference(self):
        if self.evidenceType == "source_url":
            TypeAdapter(HttpUrl).validate_python(self.reference)
        return self


class SubmissionCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    facilityName: str = Field(min_length=1, max_length=200)
    operatorOrganisationId: str = Field(min_length=1, max_length=100)
    facilityType: FacilityType
    stateCode: StateCode
    city: str = Field(min_length=1, max_length=120)
    locality: str = Field(min_length=1, max_length=200)
    exactGeometry: ExactPointGeometry
    capacityDisclosures: list[CapacityDisclosure] = Field(default_factory=list)
    evidence: list[SubmissionEvidence] = Field(default_factory=list)


class SubmissionPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    expectedRevision: int = Field(ge=1, strict=True)
    facilityName: str | None = Field(default=None, min_length=1, max_length=200)
    facilityType: FacilityType | None = None
    stateCode: StateCode | None = None
    city: str | None = Field(default=None, min_length=1, max_length=120)
    locality: str | None = Field(default=None, min_length=1, max_length=200)
    exactGeometry: ExactPointGeometry | None = None
    capacityDisclosures: list[CapacityDisclosure] | None = None
    evidence: list[SubmissionEvidence] | None = None

    @model_validator(mode="after")
    def has_changes(self):
        if self.model_fields_set == {"expectedRevision"}:
            raise ValueError("At least one revision field is required")
        return self


class SubmissionTransition(BaseModel):
    model_config = ConfigDict(extra="forbid")
    expectedRevision: int = Field(ge=1, strict=True)


class SubmissionRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    status: str
    revision: int = Field(ge=1)
    facilityName: str
    operatorOrganisationId: str
    facilityType: FacilityType
    stateCode: StateCode
    city: str
    locality: str
    exactGeometry: ExactPointGeometry
    capacityDisclosures: list[CapacityDisclosure]
    evidence: list[SubmissionEvidence]
    createdAt: AwareDatetime
    updatedAt: AwareDatetime
    submittedAt: AwareDatetime | None
    assignedReviewerId: str | None


class ReviewQueueItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    status: str
    revision: int
    facilityName: str
    operatorOrganisationId: str
    stateCode: StateCode
    city: str
    submittedAt: AwareDatetime | None
    assignedReviewerId: str | None


class ReviewQueueRead(BaseModel):
    items: list[ReviewQueueItem]
    page: int
    pageSize: int
    total: int


class PublicSnapshotProposal(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(pattern=r"^[a-z0-9-]+$", min_length=3, max_length=100)
    name: str
    operator: str
    ownershipCategory: Literal["private", "government", "ppp", "other", "unknown"]
    facilityType: FacilityType
    stateCode: StateCode
    state: str
    city: str
    locality: str
    publicCoordinates: tuple[float, float]
    locationPrecision: Literal["locality", "district"]
    operationalSince: int | None = Field(default=None, ge=1990, le=2100)
    capacityDisclosures: list[CapacityDisclosure]
    verification: PublicVerification


class ReviewActionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    expectedRevision: int = Field(ge=1, strict=True)
    action: Literal["request_information", "reject", "approve"]
    reason: str = Field(min_length=1, max_length=2000)
    requestedFields: list[str] = Field(default_factory=list, max_length=50)
    publicSnapshot: PublicSnapshotProposal | None = None


class ReviewDecisionRead(BaseModel):
    action: str
    reason: str | None
    decidedAt: AwareDatetime
    decidedBy: str


class ReviewResultRead(BaseModel):
    submissionId: str
    status: str
    revision: int
    decision: ReviewDecisionRead
    publishedFacilityId: str | None = None
    publicSnapshotVersion: int | None = None
