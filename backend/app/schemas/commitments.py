from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


PowerCommitmentType = Literal[
    "GRID_SANCTION",
    "GRID_ENERGIZED",
    "GRID_ALLOCATION_PROPOSED",
    "GRID_REQUESTED",
    "CAPTIVE_RENEWABLE",
    "UNKNOWN_AVAILABILITY",
]

PowerCommitmentStatus = Literal[
    "REQUESTED",
    "PROPOSED",
    "SANCTIONED",
    "ENERGIZED",
    "EXPIRED",
    "CANCELLED",
    "UNKNOWN",
]

WaterSourceType = Literal[
    "MUNICIPAL_PIPED",
    "INDUSTRIAL_RECYCLED",
    "SURFACE_WATER_IRRIGATION",
    "GROUNDWATER_NOC",
    "RAINWATER_HARVESTING",
    "UNKNOWN",
]

WaterCommitmentStatus = Literal[
    "PROPOSED",
    "ALLOCATED",
    "OPERATIONAL",
    "EXPIRED",
    "CANCELLED",
    "UNKNOWN",
]

ResourceScopeType = Literal["CAMPUS", "PHASE", "SITE"]
VerificationState = Literal["UNVERIFIED", "DOCUMENTED", "VERIFIED", "SIMULATED"]
ReadinessStatus = Literal["MET", "PARTIAL", "UNCOMMITTED", "UNKNOWN", "INSUFFICIENT_DATA"]


class PowerCommitmentCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    site_id: Optional[UUID] = None
    phase_id: Optional[UUID] = None
    scope_type: ResourceScopeType = "CAMPUS"
    commitment_type: PowerCommitmentType = "GRID_SANCTION"
    capacity_mw: float = Field(ge=0, description="Committed or proposed capacity in MW")
    status: PowerCommitmentStatus = "PROPOSED"
    utility_provider: Optional[str] = Field(default=None, max_length=200)
    substation_name: Optional[str] = Field(default=None, max_length=200)
    voltage_kv: Optional[float] = Field(default=None, ge=0)
    effective_date: Optional[str] = Field(default=None, max_length=32)
    expiry_date: Optional[str] = Field(default=None, max_length=32)
    evidence_artifact_id: Optional[UUID] = None
    assertion_id: Optional[UUID] = None
    is_synthetic: bool = False
    verification_state: VerificationState = "UNVERIFIED"
    notes: Optional[str] = Field(default=None, max_length=2000)


class PowerCommitmentUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    expected_revision: int = Field(ge=1)
    capacity_mw: Optional[float] = Field(default=None, ge=0)
    status: Optional[PowerCommitmentStatus] = None
    commitment_type: Optional[PowerCommitmentType] = None
    utility_provider: Optional[str] = Field(default=None, max_length=200)
    substation_name: Optional[str] = Field(default=None, max_length=200)
    voltage_kv: Optional[float] = Field(default=None, ge=0)
    effective_date: Optional[str] = Field(default=None, max_length=32)
    expiry_date: Optional[str] = Field(default=None, max_length=32)
    verification_state: Optional[VerificationState] = None
    notes: Optional[str] = Field(default=None, max_length=2000)


class PowerCommitmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    site_id: Optional[str] = None
    phase_id: Optional[str] = None
    scope_type: ResourceScopeType
    commitment_type: PowerCommitmentType
    capacity_mw: float
    status: PowerCommitmentStatus
    utility_provider: Optional[str] = None
    substation_name: Optional[str] = None
    voltage_kv: Optional[float] = None
    effective_date: Optional[str] = None
    expiry_date: Optional[str] = None
    evidence_artifact_id: Optional[str] = None
    assertion_id: Optional[str] = None
    is_synthetic: bool
    verification_state: VerificationState
    notes: Optional[str] = None
    revision: int
    status_record: str
    created_at: str
    updated_at: str


class PowerCommitmentListResponse(BaseModel):
    total: int
    items: List[PowerCommitmentRead]


class WaterCommitmentCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    site_id: Optional[UUID] = None
    phase_id: Optional[UUID] = None
    scope_type: ResourceScopeType = "CAMPUS"
    source_type: WaterSourceType = "MUNICIPAL_PIPED"
    allocated_kld: float = Field(ge=0, description="Allocated or proposed quantity in KLD")
    status: WaterCommitmentStatus = "PROPOSED"
    authority_issuer: Optional[str] = Field(default=None, max_length=200)
    allocation_reference: Optional[str] = Field(default=None, max_length=300)
    effective_date: Optional[str] = Field(default=None, max_length=32)
    expiry_date: Optional[str] = Field(default=None, max_length=32)
    evidence_artifact_id: Optional[UUID] = None
    assertion_id: Optional[UUID] = None
    is_synthetic: bool = False
    verification_state: VerificationState = "UNVERIFIED"
    notes: Optional[str] = Field(default=None, max_length=2000)


class WaterCommitmentUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    expected_revision: int = Field(ge=1)
    allocated_kld: Optional[float] = Field(default=None, ge=0)
    status: Optional[WaterCommitmentStatus] = None
    source_type: Optional[WaterSourceType] = None
    authority_issuer: Optional[str] = Field(default=None, max_length=200)
    allocation_reference: Optional[str] = Field(default=None, max_length=300)
    effective_date: Optional[str] = Field(default=None, max_length=32)
    expiry_date: Optional[str] = Field(default=None, max_length=32)
    verification_state: Optional[VerificationState] = None
    notes: Optional[str] = Field(default=None, max_length=2000)


class WaterCommitmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    site_id: Optional[str] = None
    phase_id: Optional[str] = None
    scope_type: ResourceScopeType
    source_type: WaterSourceType
    allocated_kld: float
    status: WaterCommitmentStatus
    authority_issuer: Optional[str] = None
    allocation_reference: Optional[str] = None
    effective_date: Optional[str] = None
    expiry_date: Optional[str] = None
    evidence_artifact_id: Optional[str] = None
    assertion_id: Optional[str] = None
    is_synthetic: bool
    verification_state: VerificationState
    notes: Optional[str] = None
    revision: int
    status_record: str
    created_at: str
    updated_at: str


class WaterCommitmentListResponse(BaseModel):
    total: int
    items: List[WaterCommitmentRead]


class PhaseReadinessFinding(BaseModel):
    code: str
    domain: Literal["POWER", "WATER", "CROSS_CUTTING"]
    severity: Literal["CRITICAL", "WARNING", "INFO"]
    message: str


class PhasePowerReadiness(BaseModel):
    phase_sequence: int
    demand_mw: Optional[float]
    incremental_demand_mw: Optional[float]
    verified_capacity_mw: float = 0.0
    documented_capacity_mw: float = 0.0
    qualifying_firm_capacity_mw: float
    proposed_capacity_mw: float
    unverified_capacity_mw: float
    power_gap_mw: Optional[float]
    power_surplus_mw: float
    status: ReadinessStatus
    qualifying_commitments_count: int
    total_commitments_count: int


class PhaseWaterReadiness(BaseModel):
    phase_sequence: int
    peak_summer_demand_kld: Optional[float]
    average_demand_kld: Optional[float]
    verified_allocated_kld: float = 0.0
    documented_allocated_kld: float = 0.0
    qualifying_firm_allocated_kld: float
    proposed_kld: float
    unverified_kld: float
    water_gap_kld: Optional[float]
    water_surplus_kld: float
    status: ReadinessStatus
    qualifying_commitments_count: int
    total_commitments_count: int


class PhaseReadinessSummary(BaseModel):
    phase_id: str
    phase_sequence: int
    phase_name: str
    commissioning_date: str
    cooling_type: str
    design_pue: float
    power: PhasePowerReadiness
    water: PhaseWaterReadiness
    findings: List[PhaseReadinessFinding]


class CampusReadinessSummary(BaseModel):
    total_phases: int
    total_cumulative_it_mw: Optional[float]
    total_cumulative_facility_peak_mw: Optional[float]
    total_qualifying_firm_power_mw: float
    overall_power_gap_mw: Optional[float]
    overall_power_status: ReadinessStatus
    total_peak_summer_water_kld: Optional[float]
    total_qualifying_firm_water_kld: float
    overall_water_gap_kld: Optional[float]
    overall_water_status: ReadinessStatus
    critical_findings_count: int
    warning_findings_count: int


class ProjectReadinessReport(BaseModel):
    project_id: str
    project_name: str
    evaluated_at: str
    campus_summary: CampusReadinessSummary
    phases: List[PhaseReadinessSummary]
    all_findings: List[PhaseReadinessFinding]
