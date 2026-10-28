from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional
from uuid import UUID
from pydantic import BaseModel, Field

from backend.app.schemas.commitments import PhaseReadinessFinding, ReadinessStatus


class SiteComparisonDimension(BaseModel):
    title: str
    metrics: Dict[str, Any]
    status: Literal["READY", "ATTENTION_REQUIRED", "HIGH_RISK", "UNKNOWN", "NOT_APPLICABLE"]
    notes: List[str] = Field(default_factory=list)


class CandidateSiteComparisonItem(BaseModel):
    site_id: str
    site_name: str
    area_ha: float
    state_code: str
    district: Optional[str] = None
    boundary_screening_status: str
    resource_readiness: SiteComparisonDimension
    environmental_exposure: SiteComparisonDimension
    regulatory_readiness: SiteComparisonDimension
    evidence_completeness: SiteComparisonDimension


class SiteComparisonResponse(BaseModel):
    project_id: str
    project_name: str
    evaluated_at: str
    sites: List[CandidateSiteComparisonItem]
    epistemic_disclaimer: str = (
        "Independent 4-dimension comparison. Does not compute a black-box composite score. "
        "Missing data represents UNKNOWN/UNVERIFIED risk rather than safety."
    )


class SitePassportSection(BaseModel):
    section_id: str
    title: str
    status: str
    data: Dict[str, Any]
    findings: List[PhaseReadinessFinding] = Field(default_factory=list)


class SiteReadinessPassport(BaseModel):
    passport_id: str
    generated_at: str
    project_id: str
    project_name: str
    archetype: str
    site_id: str
    site_name: str
    state_code: str
    district: Optional[str] = None
    parcel_area_ha: float
    boundary_source: str
    boundary_screening_status: str
    sections: List[SitePassportSection]
    statutory_checklist: List[Dict[str, Any]]
    epistemic_disclaimer: str = (
        "Official Pre-Investment Screening Dossier. This passport compiles evidence records "
        "for preliminary screening only and does not constitute a legal approval, official clearance, "
        "or verified spare utility capacity reservation."
    )
