"""
Resource Outlook API router.

Exposes read-only facility resource stress assessments and regional electricity/reservoir
outlooks backed by vetted historical backtest models (ML-F2.1 and ML-F3.4).

Follows strict epistemic constraints:
- Missing WUE or commitments are marked UNKNOWN; never fabricated.
- Documented-but-unverified sanctions are not counted as independently verified firm capacity.
- Annual PPA matching is separated from firm clean power; grid fossil % is never inferred without dispatch data.
- Matched period comparisons for Bhatsa drawdown; storage context is kept separate from allocated supply.
- All historical outputs are labeled HISTORICAL BACKTEST; live 2026 status is CURRENT FORECAST UNAVAILABLE.
"""

from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional
from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, ConfigDict, Field

from ml.resource_outlook.stress_engine import (
    EvidenceType,
    FacilityResourceRequest,
    ResourceOutlook,
    ResourceParameter,
    ResourceStatus,
    ResourceStressEngine,
)
from ..schemas.public_facilities import PublicFacility
from ..services.public_facilities import PublicFacilityNotFound, PublicFacilityService
from ..data.benchmarks import INDUSTRY_BENCHMARKS


router = APIRouter(prefix="/resource-outlook", tags=["Resource stress outlook"])
engine = ResourceStressEngine()


class FacilityEvaluationInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    facility_id: str = Field(default="custom-dc", min_length=1, max_length=100)
    facility_name: str = Field(default="Evaluated Facility", min_length=1, max_length=200)
    location_district: str = Field(default="Navi Mumbai", min_length=1, max_length=120)
    service_basin: Optional[str] = Field(default=None, max_length=120)
    it_capacity_mw: float = Field(gt=0, description="IT load capacity in MW")
    pue: float = Field(ge=1.0, le=3.0, description="Power Usage Effectiveness (>= 1.0)")
    wue: Optional[float] = Field(default=None, ge=0.0, description="Water Usage Effectiveness in L/kWh or null if unknown")
    sanctioned_grid_mw: Optional[float] = Field(default=None, ge=0.0, description="Sanctioned grid capacity in MW")
    sanctioned_evidence_type: Literal[
        "MEASURED_ACTUAL", "DOCUMENTED_COMMITMENT", "OPERATOR_ASSUMPTION", "UNKNOWN"
    ] = "DOCUMENTED_COMMITMENT"
    water_allocation_kld: Optional[float] = Field(default=None, ge=0.0, description="Documented water allocation in kL/day")
    water_evidence_type: Literal[
        "MEASURED_ACTUAL", "DOCUMENTED_COMMITMENT", "OPERATOR_ASSUMPTION", "UNKNOWN"
    ] = "DOCUMENTED_COMMITMENT"
    water_source_type: Optional[str] = Field(default="MUNICIPAL_PIPED", max_length=100)
    renewable_ppa_pct: Optional[float] = Field(default=None, ge=0.0, le=100.0, description="Annual renewable PPA off-take match %")
    cooling_system_type: Optional[str] = Field(default="EVAPORATIVE_OR_HYBRID", max_length=100)
    is_synthetic: bool = False


def _get_facility(request: Request, facility_id: str) -> PublicFacility:
    from .public_facilities import get_public_facility_service, _service
    from ..services.public_facility_sqlalchemy import PublicRegistryDataError
    try:
        service = get_public_facility_service(request)
        fac = service.get_facility(facility_id)
        if isinstance(fac, dict):
            return PublicFacility.model_validate(fac)
        return fac
    except (PublicRegistryDataError, Exception):
        try:
            json_svc = _service()
            fac = json_svc.get_facility(facility_id)
            if isinstance(fac, dict):
                return PublicFacility.model_validate(fac)
            return fac
        except Exception as e:
            if isinstance(e, PublicFacilityNotFound):
                raise
            raise PublicFacilityNotFound(f"Facility {facility_id} not found in public registry.")


def _build_request_from_public_facility(facility: PublicFacility) -> FacilityResourceRequest:
    """Builds a deterministic FacilityResourceRequest from public facility disclosures."""
    it_load_mw = None
    power_cap_mw = None
    for disc in facility.capacityDisclosures:
        if disc.unit == "MW":
            if disc.capacityType == "it_load":
                it_load_mw = disc.value
            elif disc.capacityType in ("power_capacity", "total_power", "power_capacity_unspecified"):
                power_cap_mw = disc.value

    if it_load_mw is not None:
        it_val = it_load_mw
        it_type = EvidenceType.DOCUMENTED_COMMITMENT
        citation = f"Public disclosure from {facility.operator} ({facility.verification.source.title})"
    elif power_cap_mw is not None:
        it_val = round(power_cap_mw / 1.35, 2)
        it_type = EvidenceType.OPERATOR_ASSUMPTION
        citation = f"Derived from total power capacity {power_cap_mw} MW at assumed 1.35 PUE"
    else:
        it_val = 10.0
        it_type = EvidenceType.UNKNOWN
        citation = "Default placeholder; IT capacity unstated"

    matched_pue = None
    matched_wue = None
    matched_re = None
    op_lower = facility.operator.lower()

    for bmk in INDUSTRY_BENCHMARKS:
        bmk_op = bmk.get("operator", "").lower()
        if bmk_op in op_lower or op_lower in bmk_op:
            metric = bmk.get("metric", "")
            if metric in ("measured_operating_pue", "design_pue") and matched_pue is None:
                matched_pue = bmk.get("value")
            elif metric == "wue_liters_per_kwh" and matched_wue is None:
                matched_wue = bmk.get("value")
            elif metric in ("datacenter_renewable_share_percent", "company_wide_renewable_matching_percent") and matched_re is None:
                matched_re = bmk.get("value")

    pue_val = matched_pue or 1.35
    pue_type = EvidenceType.DOCUMENTED_COMMITMENT if matched_pue else EvidenceType.OPERATOR_ASSUMPTION

    wue_param = None
    if matched_wue is not None:
        wue_param = ResourceParameter(value=matched_wue, unit="L/kWh", evidence_type=EvidenceType.DOCUMENTED_COMMITMENT)
    else:
        wue_param = ResourceParameter(value=None, unit="L/kWh", evidence_type=EvidenceType.UNKNOWN, notes="Unpublished by operator")

    sanction_mw = power_cap_mw or (it_val * 1.35)
    sanc_param = ResourceParameter(
        value=sanction_mw,
        unit="MW",
        evidence_type=EvidenceType.DOCUMENTED_COMMITMENT if power_cap_mw else EvidenceType.OPERATOR_ASSUMPTION,
        source_citation=citation,
    )

    ppa_param = None
    if matched_re is not None:
        ppa_param = ResourceParameter(value=matched_re, unit="%", evidence_type=EvidenceType.DOCUMENTED_COMMITMENT)

    return FacilityResourceRequest(
        facility_id=facility.id,
        facility_name=facility.name,
        location_district=facility.city or facility.state,
        it_capacity_mw=ResourceParameter(value=it_val, unit="MW", evidence_type=it_type, source_citation=citation),
        pue=ResourceParameter(value=pue_val, unit="ratio", evidence_type=pue_type),
        wue=wue_param,
        sanctioned_grid_mw=sanc_param,
        water_allocation_kld=None,
        renewable_ppa_pct=ppa_param,
    )


@router.get("/facility/{facility_id}")
def get_facility_resource_outlook(request: Request, facility_id: str) -> Dict[str, Any]:
    """Evaluates resource stress outlook for a registered public facility."""
    try:
        facility = _get_facility(request, facility_id)
    except PublicFacilityNotFound:
        raise HTTPException(status_code=404, detail="Public facility not found")

    eval_req = _build_request_from_public_facility(facility)
    outlook = engine.evaluate_facility(eval_req)
    return outlook.to_dict()


@router.post("/evaluate")
def evaluate_custom_resource_outlook(body: FacilityEvaluationInput) -> Dict[str, Any]:
    """Evaluates resource stress outlook for arbitrary facility parameters."""
    req = FacilityResourceRequest(
        facility_id=body.facility_id,
        facility_name=body.facility_name,
        location_district=body.location_district,
        service_basin=body.service_basin,
        it_capacity_mw=ResourceParameter(
            value=body.it_capacity_mw,
            unit="MW",
            evidence_type=EvidenceType.DOCUMENTED_COMMITMENT,
            is_synthetic=body.is_synthetic,
        ),
        pue=ResourceParameter(
            value=body.pue,
            unit="ratio",
            evidence_type=EvidenceType.DOCUMENTED_COMMITMENT,
            is_synthetic=body.is_synthetic,
        ),
        wue=ResourceParameter(
            value=body.wue,
            unit="L/kWh",
            evidence_type=EvidenceType.DOCUMENTED_COMMITMENT if body.wue is not None else EvidenceType.UNKNOWN,
            is_synthetic=body.is_synthetic,
        ) if body.wue is not None else ResourceParameter(value=None, unit="L/kWh", evidence_type=EvidenceType.UNKNOWN),
        sanctioned_grid_mw=ResourceParameter(
            value=body.sanctioned_grid_mw,
            unit="MW",
            evidence_type=EvidenceType(body.sanctioned_evidence_type),
            is_synthetic=body.is_synthetic,
        ) if body.sanctioned_grid_mw is not None else None,
        water_allocation_kld=ResourceParameter(
            value=body.water_allocation_kld,
            unit="kL/day",
            evidence_type=EvidenceType(body.water_evidence_type),
            is_synthetic=body.is_synthetic,
        ) if body.water_allocation_kld is not None else None,
        water_source_type=body.water_source_type,
        renewable_ppa_pct=ResourceParameter(
            value=body.renewable_ppa_pct,
            unit="%",
            evidence_type=EvidenceType.DOCUMENTED_COMMITMENT,
            is_synthetic=body.is_synthetic,
        ) if body.renewable_ppa_pct is not None else None,
        cooling_system_type=body.cooling_system_type,
    )
    outlook = engine.evaluate_facility(req)
    return outlook.to_dict()


@router.get("/regional-summary")
def get_regional_forecast_summary() -> Dict[str, Any]:
    """Returns vetted historical backtest summaries and live forecast status notice."""
    return {
        "status": "HISTORICAL_BACKTEST",
        "live_operational_forecast": "CURRENT_FORECAST_UNAVAILABLE",
        "notice": (
            "All regional forecasting models reflect vetted historical backtest performance on 2023-2024 observations. "
            "Live 2026 predictions are currently unavailable. Do not use for legal compliance determinations."
        ),
        "electricity": {
            "region": "Maharashtra State Electricity Grid (SLDC/CEA)",
            "selected_model": engine.elec_model_name,
            "evaluation_horizon": engine.elec_horizon,
            "forecast_origin": engine.elec_origin,
            "data_cutoff": engine.elec_data_cutoff,
            "model_mae_mw": engine.elec_mae_mw,
            "model_mape_pct": engine.elec_mape_pct,
            "state_peak_demand_met_mw": engine.regional_peak_met_mw,
            "uncertainty": {
                "nominal_coverage": "80%",
                "empirical_coverage_pct": engine.elec_coverage_pct,
                "q10_offset_mw": engine.elec_q10_offset,
                "q90_offset_mw": engine.elec_q90_offset,
            },
        },
        "reservoir": {
            "reservoir": engine.water_target_reservoir,
            "service_area": "Thane / Mumbai Metropolitan Region (MMR)",
            "gross_capacity_mcm": engine.water_capacity_mcm,
            "selected_model": engine.water_model_name,
            "evaluation_horizon": engine.water_horizon,
            "forecast_origin": engine.water_origin,
            "data_cutoff": engine.water_data_cutoff,
            "model_mae_mcm": engine.water_mae_mcm,
            "model_mape_pct": engine.water_mape_pct,
            "dry_season_drawdown_mcm": engine.bhatsa_dry_season_drawdown_mcm,
            "dry_season_minimum_storage_mcm": engine.bhatsa_dry_season_min_mcm,
            "daily_municipal_capacity_kld": engine.bhatsa_daily_municipal_capacity_kld,
        },
    }
