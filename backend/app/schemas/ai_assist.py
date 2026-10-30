"""Schemas for Gemini AI Assistant and Facility Intelligence."""
from __future__ import annotations

from datetime import datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field


CriticalityTier = Literal["TIER_1_ELEVATED", "TIER_2_MODERATE", "TIER_3_NOMINAL"]
InterventionCategory = Literal[
    "WATER_CONSERVATION",
    "POWER_GRID",
    "ENERGY_EFFICIENCY",
    "TERRAIN_CIVIL",
    "STATUTORY_COMPLIANCE",
]
InterventionPriority = Literal["HIGH", "MODERATE", "STANDARD"]

InspectionMode = Literal[
    "MEITY_OVERSIGHT",
    "SPCB_ENVIRONMENTAL",
    "CGWA_WATER",
    "CEA_GRID",
    "URBAN_RECEPTOR",
]


class AiIntervention(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(min_length=1, max_length=100)
    title: str = Field(min_length=1, max_length=300)
    category: InterventionCategory
    priority: InterventionPriority
    timeframe: str = Field(min_length=1, max_length=100)
    responsibleStakeholder: str = Field(min_length=1, max_length=200)
    expectedBenefit: str = Field(min_length=1, max_length=500)
    statutoryBasis: str = Field(min_length=1, max_length=300)
    rationale: str = Field(min_length=1, max_length=2000)


class AiComplianceRequirement(BaseModel):
    model_config = ConfigDict(extra="ignore")

    item: str = Field(min_length=1, max_length=300)
    authority: str = Field(min_length=1, max_length=200)
    mandatory: bool = True
    notes: str = Field(min_length=1, max_length=1000)


class SubstationTelemetry(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: str = Field(default="Regional Substation")
    distanceKm: float = Field(default=2.5, ge=0)
    voltageKv: float = Field(default=220, ge=0)
    operator: str = Field(default="State Transmission Utility")
    status: Literal["OPTIMAL", "ACCEPTABLE", "CONSTRAINED"] = "OPTIMAL"


class PopulationTelemetry(BaseModel):
    model_config = ConfigDict(extra="ignore")

    population1km: int = Field(default=8500, ge=0)
    population5km: int = Field(default=125000, ge=0)
    densityPerKm2: float = Field(default=5000, ge=0)
    densityBand: Literal["ULTRA_HIGH", "HIGH", "MODERATE", "LOW"] = "HIGH"
    bufferAlert: str = Field(default="Standard human receptor screening buffer")
    dataSource: str = Field(default="WorldPop 100m SDI & Census of India Baseline")


class AiInfrastructureTelemetry(BaseModel):
    model_config = ConfigDict(extra="ignore")

    substation: SubstationTelemetry = Field(default_factory=SubstationTelemetry)
    population: PopulationTelemetry = Field(default_factory=PopulationTelemetry)


class MinistryAssessment(BaseModel):
    model_config = ConfigDict(extra="ignore")

    departmentPerspective: str = Field(default="Ministry Oversight & Resource Posture")
    statutoryRiskScore: int = Field(default=45, ge=0, le=100)
    complianceStatus: Literal["COMPLIANT_NOMINAL", "ACTION_REQUIRED_MODERATE", "URGENT_INTERVENTION_CRITICAL"] = "ACTION_REQUIRED_MODERATE"
    officialDirective: str = Field(default="Review groundwater recharge logs and verify DG stack height during next CTO renewal.")
    statutoryGaps: list[str] = Field(default_factory=list)
    keyRegulatoryActs: list[str] = Field(default_factory=list)


class FacilityAiAssistRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    focus_area: str | None = Field(default=None, max_length=200)
    custom_prompt: str | None = Field(default=None, max_length=2000)
    force_model: str | None = Field(default=None, max_length=100)
    inspection_mode: InspectionMode | None = Field(default="MEITY_OVERSIGHT")


class FacilityAiAssistResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    facilityId: str
    facilityName: str
    modelUsed: str
    status: Literal["live_ai", "fallback_deterministic"]
    criticalityTier: CriticalityTier
    criticalityLabel: str
    vulnerabilityOverview: str
    stateRegulatoryBody: str
    stateDiscom: str
    ministryAssessment: MinistryAssessment | None = None
    interventions: list[AiIntervention]
    complianceChecklist: list[AiComplianceRequirement]
    infrastructureTelemetry: AiInfrastructureTelemetry
    focusArea: str | None = None
    customPrompt: str | None = None
    inspectionMode: str | None = "MEITY_OVERSIGHT"
    generatedAt: datetime
    disclaimer: str


class AiServiceStatus(BaseModel):
    model_config = ConfigDict(extra="ignore")

    configured: bool
    primaryModel: str
    fallbackModels: list[str]
    activeKeyMasked: str
