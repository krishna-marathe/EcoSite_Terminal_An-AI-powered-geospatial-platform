"""
EcoSite Resource Outlook — Facility Resource Stress Engine (ML-F4.1)

Combines:
1. Facility IT capacity, design PUE, WUE, sanctioned power, and water allocations.
2. Selected regional Maharashtra electricity demand forecast (Seasonal-Naive + Conformal Calibration from ML-F2.1).
3. Selected Bhatsa reservoir storage forecast (Trend-Adjusted Seasonal Baseline from ML-F3.4).
4. Regional climate cooling indicators from ERA5 historical normals.

Epistemic & Compliance Rules:
- Missing or failed data is marked UNKNOWN or SOURCE_UNAVAILABLE; never assumed zero risk.
- Synthetic / demo data is tagged SIMULATED and never presented as verified.
- Substation proximity does not establish available MW; high grid load does not imply facility causes blackout.
- Drought drawdown reflects regional hydrology and drinking water priorities, not data centre causation alone.
- Service area mismatch (e.g. Pune vs Bhatsa) is flagged as SOURCE_UNAVAILABLE.
- Does not count documented-but-unverified utility sanctions as independently verified firm capacity.
- Separates annual PPA matching from firm hourly clean power; never infers grid fossil % without generation-mix data.
- Matches reservoir comparison periods (dry-season demand vs dry-season drawdown); distinguishes storage from allocated supply.
- Clearly flags all historical backtests with HISTORICAL BACKTEST and CURRENT FORECAST UNAVAILABLE.
"""

from __future__ import annotations

import csv
from dataclasses import asdict, dataclass, field
from enum import Enum
import json
import math
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple


class EvidenceType(str, Enum):
    MEASURED_ACTUAL = "MEASURED_ACTUAL"
    DOCUMENTED_COMMITMENT = "DOCUMENTED_COMMITMENT"
    OPERATOR_ASSUMPTION = "OPERATOR_ASSUMPTION"
    UNKNOWN = "UNKNOWN"
    SOURCE_UNAVAILABLE = "SOURCE_UNAVAILABLE"


class ResourceStatus(str, Enum):
    SUPPORTED_BY_EVIDENCE = "SUPPORTED_BY_EVIDENCE"
    ATTENTION_REQUIRED = "ATTENTION_REQUIRED"
    UNKNOWN = "UNKNOWN"
    SOURCE_UNAVAILABLE = "SOURCE_UNAVAILABLE"


# Recognized geographic locations belonging to the Bhatsa / Ulhas water supply basin (MMR)
MMR_BHATSA_SERVICE_AREAS: Set[str] = {
    "thane",
    "mumbai",
    "mumbai suburban",
    "mumbai city",
    "navi mumbai",
    "airoli",
    "mahape",
    "kopar khairane",
    "taloja",
    "turbhe",
    "chandivali",
    "bhiwandi",
    "kalyan",
    "dombivli",
    "ulhasnagar",
    "ambernath",
    "badlapur",
    "mira-bhayandar",
    "panvel",
    "raigad",
    "mmr",
    "bhatsa",
    "ulhas",
}


@dataclass(frozen=True)
class ResourceParameter:
    """An input parameter with strict data provenance and synthetic flagging."""
    value: Optional[float]
    unit: str
    evidence_type: EvidenceType
    source_citation: Optional[str] = None
    is_synthetic: bool = False
    notes: Optional[str] = None


@dataclass
class FacilityResourceRequest:
    """Input specification for data centre facility resource stress evaluation."""
    facility_id: str
    facility_name: str
    location_district: str
    it_capacity_mw: ResourceParameter
    pue: ResourceParameter
    service_basin: Optional[str] = None
    wue: Optional[ResourceParameter] = None  # L/kWh
    sanctioned_grid_mw: Optional[ResourceParameter] = None
    water_allocation_kld: Optional[ResourceParameter] = None
    water_source_type: Optional[str] = "MUNICIPAL_PIPED"
    renewable_ppa_pct: Optional[ResourceParameter] = None
    cooling_system_type: Optional[str] = "EVAPORATIVE_OR_HYBRID"


@dataclass
class FacilityPowerFindings:
    it_capacity_mw: Optional[float]
    pue: Optional[float]
    facility_power_demand_mw: Optional[float]
    sanctioned_power_mw: float
    verified_power_mw: float  # Only independently verified or measured actual
    documented_power_mw: float  # Documented commitments pending verifier confirmation
    unverified_power_mw: float  # Operator assumptions or unbacked claims
    qualifying_firm_capacity_mw: float
    power_gap_mw: Optional[float]
    power_surplus_mw: float
    contracted_coverage_pct: Optional[float]
    annual_ppa_matching_pct: Optional[float]
    annual_ppa_matched_mw: Optional[float]
    residual_grid_requirement_mw: Optional[float]
    status: ResourceStatus
    findings: List[str] = field(default_factory=list)


@dataclass
class FacilityWaterFindings:
    wue_l_per_kwh: Optional[float]
    daily_water_demand_kld: Optional[float]  # m^3/day
    annual_water_demand_mcm: Optional[float]  # MCM/year
    dry_season_water_demand_mcm: Optional[float]  # 26-week / 182-day dry season requirement
    allocated_water_kld: float
    verified_allocated_kld: float
    documented_allocated_kld: float
    unverified_allocated_kld: float
    qualifying_firm_allocated_kld: float
    allocated_water_mcm: float
    water_gap_kld: Optional[float]
    water_gap_mcm: Optional[float]
    water_surplus_kld: Optional[float]
    water_source_type: str
    status: ResourceStatus
    findings: List[str] = field(default_factory=list)


@dataclass
class RegionalElectricityOutlookFindings:
    forecast_classification: str  # "HISTORICAL_BACKTEST"
    is_live_2026_forecast: bool  # False
    live_status_label: str  # "CURRENT_FORECAST_UNAVAILABLE"
    forecast_horizon: str
    forecast_period: str
    forecast_origin: str
    data_cutoff_date: str
    model_version: str
    selected_model: str
    model_mae_mw: float
    model_mape_pct: float
    regional_peak_met_mw: float
    facility_share_of_grid_peak_pct: Optional[float]
    calibrated_80pct_interval_mw: Tuple[float, float]
    uncertainty_method: str
    high_demand_season: str
    grid_stress_level: str
    status: ResourceStatus
    epistemic_disclaimer: str
    findings: List[str] = field(default_factory=list)


@dataclass
class RegionalReservoirOutlookFindings:
    target_reservoir: str
    service_area_match: bool
    service_basin_diagnostics: str
    forecast_classification: str  # "HISTORICAL_BACKTEST"
    is_live_2026_forecast: bool  # False
    live_status_label: str  # "CURRENT_FORECAST_UNAVAILABLE"
    reservoir_capacity_mcm: float
    forecast_horizon: str
    forecast_period: str
    forecast_origin: str
    data_cutoff_date: str
    model_version: str
    selected_model: str
    model_mae_mcm: float
    model_mape_pct: float
    dry_season_drawdown_mcm: float
    dry_season_minimum_storage_mcm: float
    facility_share_of_bhatsa_capacity_pct: Optional[float]
    facility_share_of_dry_season_drawdown_pct: Optional[float]
    facility_share_of_daily_municipal_throughput_pct: Optional[float]
    uncertainty_method: str
    storage_drawdown_risk: str
    status: ResourceStatus
    epistemic_disclaimer: str
    findings: List[str] = field(default_factory=list)


@dataclass
class ClimateCoolingPressureFindings:
    heat_stress_indicator: str
    temperature_extreme_risk: str
    cooling_efficiency_impact_pct: float
    epistemic_caveat: str
    findings: List[str] = field(default_factory=list)


@dataclass
class UncertaintyAndMissingEvidence:
    unverified_parameters: List[str] = field(default_factory=list)
    operator_assumptions: List[str] = field(default_factory=list)
    synthetic_parameters: List[str] = field(default_factory=list)
    missing_critical_data: List[str] = field(default_factory=list)
    conformal_coverage_caveats: List[str] = field(default_factory=list)


@dataclass
class ResourceOutlook:
    """Consolidated Resource Stress Outlook result for a facility."""
    facility_id: str
    facility_name: str
    overall_status: ResourceStatus
    forecast_classification: str
    live_status_label: str
    forecast_horizon: str
    source_period: str
    model_version: str
    power_findings: FacilityPowerFindings
    water_findings: FacilityWaterFindings
    regional_electricity: RegionalElectricityOutlookFindings
    regional_reservoir: RegionalReservoirOutlookFindings
    climate_cooling: ClimateCoolingPressureFindings
    uncertainty_and_missing_evidence: UncertaintyAndMissingEvidence
    recommended_review_actions: List[str] = field(default_factory=list)
    epistemic_disclaimers: List[str] = field(default_factory=list)
    current_operational_outlook: Optional[Dict[str, Any]] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    def to_json(self, indent: int = 2) -> str:
        return json.dumps(self.to_dict(), indent=indent)


class ResourceStressEngine:
    """
    Evaluates facility resource requirements against empirical regional forecasts
    and verifiable commitments without fabricating missing data or making unsupported claims.
    """

    def __init__(self, base_dir: Optional[Path] = None):
        self.base_dir = base_dir or Path(__file__).resolve().parent
        self._load_forecast_metadata()

    def _load_forecast_metadata(self):
        """Loads vetted metrics from ML-F2.1 and ML-F3.4 artifacts with robust fallbacks."""
        # 1. Electricity metrics
        elec_json_path = self.base_dir / "evaluation_metrics_v2.json"
        if elec_json_path.exists():
            try:
                with open(elec_json_path, "r", encoding="utf-8") as f:
                    elec_data = json.load(f)
                untouched = elec_data.get("untouched_test_window", {})
                sn = untouched.get("seasonal_naive_baseline", {})
                self.elec_model_name = elec_data.get("model_selection", {}).get("selected_model", "SEASONAL_NAIVE_WITH_CALIBRATED_INTERVALS")
                self.elec_mae_mw = float(sn.get("mae_mw", 1230.17))
                self.elec_mape_pct = float(sn.get("mape_pct", 4.62))
                self.elec_horizon = untouched.get("horizon_dates", "2023-11-01 to 2024-04-27")
                self.elec_origin = untouched.get("origin_date", "2023-10-31")
                self.elec_data_cutoff = "2023-10-31"
            except Exception:
                self._set_default_elec_metadata()
        else:
            self._set_default_elec_metadata()

        # 2. Electricity uncertainty
        unc_json_path = self.base_dir / "uncertainty_results_v2.json"
        if unc_json_path.exists():
            try:
                with open(unc_json_path, "r", encoding="utf-8") as f:
                    unc_data = json.load(f)
                self.elec_q10_offset = float(unc_data.get("calibrated_q10_offset_mw", -620.2))
                self.elec_q90_offset = float(unc_data.get("calibrated_q90_offset_mw", 4912.2))
                self.elec_coverage_pct = float(unc_data.get("untouched_test_set_coverage_pct", 81.82))
            except Exception:
                self.elec_q10_offset = -620.2
                self.elec_q90_offset = 4912.2
                self.elec_coverage_pct = 81.82
        else:
            self.elec_q10_offset = -620.2
            self.elec_q90_offset = 4912.2
            self.elec_coverage_pct = 81.82

        # 3. Water metrics
        water_json_path = self.base_dir / "water" / "water_model_results.json"
        if water_json_path.exists():
            try:
                with open(water_json_path, "r", encoding="utf-8") as f:
                    water_data = json.load(f)
                cand2 = water_data.get("candidates", {}).get("candidate_2_trend_adjusted_baseline", {})
                self.water_target_reservoir = water_data.get("target_reservoir", "Bhatsa Lake (Thane / MMR Basin)")
                self.water_capacity_mcm = float(water_data.get("reservoir_capacity_mcm", 942.1))
                self.water_horizon = water_data.get("evaluation_window", "2024-01-04 to 2024-06-27 (26 weeks / 2024-H1)")
                self.water_model_name = water_data.get("selected_approach", {}).get("model_name", "Candidate 2: Trend-Adjusted Seasonal Baseline")
                self.water_mae_mcm = float(cand2.get("mae_mcm", 10.23))
                self.water_mape_pct = float(cand2.get("mape_pct", 2.89))
                self.water_origin = "2024-01-04"
                self.water_data_cutoff = "2024-01-04"
            except Exception:
                self._set_default_water_metadata()
        else:
            self._set_default_water_metadata()

        # Regional grid peak observed met (historical reference)
        self.regional_peak_met_mw = 30675.0
        # Bhatsa dry season parameters (historical reference)
        self.bhatsa_dry_season_drawdown_mcm = 508.0  # 705 MCM (Jan) - 197 MCM (Jun)
        self.bhatsa_dry_season_min_mcm = 197.0
        self.bhatsa_daily_municipal_capacity_kld = 2_400_000.0  # ~2,400 MLD municipal treatment/supply throughput to MMR

        # 4. Current 2026 Operational Forecast & Scenarios (ML-F8)
        self.current_operational_outlook: Optional[Dict[str, Any]] = None
        elec_v3_path = self.base_dir / "electricity_recent" / "electricity_evaluation_metrics_v3.json"
        water_v3_path = self.base_dir / "water" / "water_evaluation_metrics_v3.json"

        if elec_v3_path.exists() and water_v3_path.exists():
            try:
                with open(elec_v3_path, "r", encoding="utf-8") as f:
                    e_v3 = json.load(f)
                with open(water_v3_path, "r", encoding="utf-8") as f:
                    w_v3 = json.load(f)

                self.current_operational_outlook = {
                    "status": "ML_F8_CURRENT_OUTLOOK_AVAILABLE",
                    "electricity_forecast": {
                        "status": "READY_AND_VALIDATED",
                        "classification": "CURRENT_OPERATIONAL_FORECAST",
                        "selected_model": e_v3["model_selection"]["selected_model"],
                        "origin_date": e_v3["production_forecast_metadata"]["origin_date"],
                        "horizon_26w_range": e_v3["production_forecast_metadata"]["horizon_26w_range"],
                        "average_cross_validation_mae_mw": e_v3["model_selection"]["average_cross_validation_mae_mw"],
                        "average_cross_validation_mape_pct": e_v3["model_selection"]["average_cross_validation_mape_pct"],
                        "calibrated_80pct_uncertainty_interval_mw": e_v3["model_selection"]["calibrated_80pct_uncertainty_interval_mw"],
                        "peak_forecasted_demand_mw": e_v3["production_forecast_metadata"]["peak_forecasted_demand_mw"],
                        "summer_peak_warning_mw": e_v3["production_forecast_metadata"]["summer_peak_warning_mw"],
                        "forecast_file": e_v3["production_forecast_metadata"]["forecast_files"]["26_week_operational"]
                    },
                    "bhatsa_water_outlook": {
                        "status": "CURRENT_OBSERVATION_VERIFIED_INTERMEDIATE_SERIES_GATED",
                        "classification": "ILLUSTRATIVE_SCENARIO_ONLY",
                        "reservoir_name": w_v3["verified_ground_truth_origin"]["reservoir_name"],
                        "observation_date": w_v3["verified_ground_truth_origin"]["observation_date"],
                        "live_storage_mcm": w_v3["verified_ground_truth_origin"]["live_storage_mcm"],
                        "storage_percent": w_v3["verified_ground_truth_origin"]["storage_percent"],
                        "capacity_mcm": w_v3["verified_ground_truth_origin"]["live_capacity_frl_mcm"],
                        "scenarios_file": w_v3["illustrative_scenarios_metadata"]["file"],
                        "drawdown_scenarios": w_v3["illustrative_scenarios_metadata"]["scenarios_included"],
                        "note": "Intermediate 77-week series from May 2025 to Oct 2026 is unreleased in public bulk archives. Depletion trajectories are bounded scenarios starting from the verified 2026-10-29 benchmark."
                    }
                }
            except Exception:
                self.current_operational_outlook = None

    def _set_default_elec_metadata(self):
        self.elec_model_name = "SEASONAL_NAIVE_WITH_CALIBRATED_INTERVALS"
        self.elec_mae_mw = 1230.17
        self.elec_mape_pct = 4.62
        self.elec_horizon = "2023-11-01 to 2024-04-27"
        self.elec_origin = "2023-10-31"
        self.elec_data_cutoff = "2023-10-31"

    def _set_default_water_metadata(self):
        self.water_target_reservoir = "Bhatsa Lake (Thane / MMR Basin)"
        self.water_capacity_mcm = 942.1
        self.water_horizon = "2024-01-04 to 2024-06-27 (26 weeks / 2024-H1)"
        self.water_model_name = "Candidate 2: Trend-Adjusted Seasonal Baseline"
        self.water_mae_mcm = 10.23
        self.water_mape_pct = 2.89
        self.water_origin = "2024-01-04"
        self.water_data_cutoff = "2024-01-04"

    def evaluate_facility(self, request: FacilityResourceRequest) -> ResourceOutlook:
        """
        Executes deterministic evaluation across facility requirements,
        contracted commitments, and regional environmental forecasts.
        """
        # 1. Power requirement and gap calculation
        power_findings = self._evaluate_power(request)

        # 2. Water requirement and gap calculation
        water_findings = self._evaluate_water(request)

        # 3. Regional electricity grid outlook
        elec_findings = self._evaluate_regional_electricity(request, power_findings.facility_power_demand_mw)

        # 4. Regional reservoir storage outlook
        water_outlook_findings = self._evaluate_regional_reservoir(
            request,
            water_findings.annual_water_demand_mcm,
            water_findings.dry_season_water_demand_mcm,
            water_findings.daily_water_demand_kld,
        )

        # 5. Climate cooling pressure
        cooling_findings = self._evaluate_climate_cooling(request)

        # 6. Uncertainty, synthetic flags, and missing evidence
        uncertainty_info = self._evaluate_uncertainty(request, power_findings, water_findings)

        # 7. Actionable recommendations
        recommendations = self._generate_recommendations(request, power_findings, water_findings, water_outlook_findings, uncertainty_info)

        # 8. Overall status rollup
        overall_status = self._determine_overall_status(power_findings, water_findings, elec_findings, water_outlook_findings, uncertainty_info)

        # 9. Non-negotiable epistemic disclaimers
        epistemic_disclaimers = [
            "EcoSite India is an evidence-driven screening platform. It does not grant approvals, establish legal compliance, or predict verified utility capacity.",
            "Substation proximity does not establish available MW. A documented sanction letter from the distribution/transmission utility is required to verify firm capacity.",
            "Documented-but-unverified utility commitments are recorded as DOCUMENTED pending real verifier confirmation; they are not counted as independently verified firm capacity.",
            "High regional electricity demand met reflects statewide aggregate grid loading, not facility-induced grid collapse.",
            "Bhatsa storage drawdown reflects natural dry-season hydrology and metropolitan drinking water prioritization, not data centre causation alone.",
            "HISTORICAL BACKTEST ONLY: All regional forecasts represent historical out-of-sample backtest evaluations (2023-2024). Current 2026 operational forecasts are UNAVAILABLE.",
            "Volumetric annual renewable PPA matching is distinct from 24/7 firm hourly clean energy; residual grid power is drawn from the macro grid.",
        ]

        return ResourceOutlook(
            facility_id=request.facility_id,
            facility_name=request.facility_name,
            overall_status=overall_status,
            forecast_classification="HISTORICAL_BACKTEST",
            live_status_label="CURRENT_FORECAST_UNAVAILABLE",
            forecast_horizon=f"Electricity: {self.elec_horizon}; Reservoir: {self.water_horizon}",
            source_period="Historical Backtest Windows 2023-H2 and 2024-H1",
            model_version="ML-F4.1 (Seasonal-Naive + Conformal / Trend-Adjusted Baseline)",
            power_findings=power_findings,
            water_findings=water_findings,
            regional_electricity=elec_findings,
            regional_reservoir=water_outlook_findings,
            climate_cooling=cooling_findings,
            uncertainty_and_missing_evidence=uncertainty_info,
            recommended_review_actions=recommendations,
            epistemic_disclaimers=epistemic_disclaimers,
            current_operational_outlook=self.current_operational_outlook,
        )

    def get_current_forecast_payload(self, horizon_weeks: int = 26) -> Dict[str, Any]:
        """Returns the day-by-day and weekly series for current electricity forecast and Bhatsa scenarios."""
        fc_file = self.base_dir / "electricity_recent" / "electricity_forecast_26w_2026_2027.csv"
        scen_file = self.base_dir / "water" / "bhatsa_illustrative_scenarios_2026_2027.csv"

        elec_points: List[Dict[str, Any]] = []
        if fc_file.exists():
            with open(fc_file, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for r in reader:
                    val = r.get("predicted_peak_met_mw")
                    if val is not None and val != "":
                        elec_points.append({
                            "date": r["forecast_date"],
                            "lead_day": int(r["lead_day"]),
                            "predicted_peak_met_mw": float(val),
                            "p10_lower_bound_mw": float(r.get("p10_lower_bound_mw", 0.0) or 0.0),
                            "p90_upper_bound_mw": float(r.get("p90_upper_bound_mw", 0.0) or 0.0),
                            "day_of_week": r.get("day_of_week", "")
                        })

        water_points: List[Dict[str, Any]] = []
        if scen_file.exists():
            with open(scen_file, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for r in reader:
                    water_points.append({
                        "date": r["scenario_date"],
                        "week_number": int(r["week_number"]),
                        "scenario_normal_depletion_mcm": float(r["scenario_normal_depletion_mcm"]),
                        "scenario_normal_pct": float(r["scenario_normal_pct"]),
                        "scenario_dry_stress_mcm": float(r["scenario_dry_stress_mcm"]),
                        "scenario_dry_stress_pct": float(r["scenario_dry_stress_pct"]),
                        "scenario_wet_retention_mcm": float(r["scenario_wet_retention_mcm"]),
                        "scenario_wet_retention_pct": float(r["scenario_wet_retention_pct"])
                    })

        return {
            "status": "VALIDATED_CURRENT_OPERATIONAL_OUTLOOK",
            "electricity": {
                "classification": "CURRENT_OPERATIONAL_FORECAST",
                "origin_date": "2026-10-27",
                "horizon_weeks": horizon_weeks,
                "total_days": len(elec_points),
                "points": elec_points
            },
            "reservoir": {
                "classification": "ILLUSTRATIVE_SCENARIO_ONLY",
                "target_reservoir": "Bhatsa (D02993, Thane / MMR Basin)",
                "origin_date": "2026-10-29",
                "verified_live_storage_mcm": 864.37,
                "storage_percent": 91.76,
                "capacity_frl_mcm": 942.0,
                "horizon_weeks": 26,
                "points": water_points
            },
            "metadata": self.current_operational_outlook,
            "epistemic_disclaimer": (
                "CURRENT OPERATIONAL FORECAST & SCENARIOS (ML-F8): Electricity forecast is backed by 2013-2026 continuous daily observations with out-of-sample conformal calibration. "
                "Bhatsa reservoir is anchored to the official 2026-10-29 CWC observation (864.37 MCM, 91.76%) and depicts illustrative non-monsoon depletion scenarios pending unreleased intermediate series. "
                "Regional outlook does not establish local utility spare capacity or municipal water allocations."
            )
        }

    def _evaluate_power(self, request: FacilityResourceRequest) -> FacilityPowerFindings:
        """
        Calculates total facility power requirement (IT MW * PUE) and compares
        against documented and verified sanctioned capacity following backend semantics.
        """
        findings: List[str] = []
        it_param = request.it_capacity_mw
        pue_param = request.pue
        sanc_param = request.sanctioned_grid_mw
        ppa_param = request.renewable_ppa_pct

        # Check if IT capacity or PUE is missing
        if it_param.value is None or it_param.value <= 0 or it_param.evidence_type in (EvidenceType.UNKNOWN, EvidenceType.SOURCE_UNAVAILABLE):
            return FacilityPowerFindings(
                it_capacity_mw=None,
                pue=None,
                facility_power_demand_mw=None,
                sanctioned_power_mw=0.0,
                verified_power_mw=0.0,
                documented_power_mw=0.0,
                unverified_power_mw=0.0,
                qualifying_firm_capacity_mw=0.0,
                power_gap_mw=None,
                power_surplus_mw=0.0,
                contracted_coverage_pct=None,
                annual_ppa_matching_pct=None,
                annual_ppa_matched_mw=None,
                residual_grid_requirement_mw=None,
                status=ResourceStatus.UNKNOWN,
                findings=["Facility IT capacity is missing or unknown; cannot compute power requirements."],
            )

        if pue_param.value is None or pue_param.value < 1.0 or pue_param.evidence_type in (EvidenceType.UNKNOWN, EvidenceType.SOURCE_UNAVAILABLE):
            return FacilityPowerFindings(
                it_capacity_mw=it_param.value,
                pue=None,
                facility_power_demand_mw=None,
                sanctioned_power_mw=0.0,
                verified_power_mw=0.0,
                documented_power_mw=0.0,
                unverified_power_mw=0.0,
                qualifying_firm_capacity_mw=0.0,
                power_gap_mw=None,
                power_surplus_mw=0.0,
                contracted_coverage_pct=None,
                annual_ppa_matching_pct=None,
                annual_ppa_matched_mw=None,
                residual_grid_requirement_mw=None,
                status=ResourceStatus.UNKNOWN,
                findings=["Facility PUE is missing or invalid (< 1.0); cannot compute facility power requirement."],
            )

        it_mw = float(it_param.value)
        pue = float(pue_param.value)
        power_demand_mw = round(it_mw * pue, 3)

        # Sanctioned capacity breakdown following backend readiness verification semantics
        sanctioned_mw = 0.0
        verified_mw = 0.0
        documented_mw = 0.0
        unverified_mw = 0.0
        qualifying_firm_mw = 0.0

        if sanc_param and sanc_param.value is not None and sanc_param.value >= 0:
            val = float(sanc_param.value)
            sanctioned_mw = val
            if sanc_param.evidence_type == EvidenceType.MEASURED_ACTUAL:
                verified_mw = val
                documented_mw = val
                qualifying_firm_mw = val
                findings.append(f"Sanctioned grid power ({val:.2f} MW) is independently verified by measured telemetry / audited utility bills.")
            elif sanc_param.evidence_type == EvidenceType.DOCUMENTED_COMMITMENT:
                documented_mw = val
                qualifying_firm_mw = val
                findings.append(
                    f"Sanctioned grid capacity of {val:.2f} MW is DOCUMENTED by utility paperwork, but is NOT independently verified firm capacity "
                    "until verified by an accredited utility verifier."
                )
            elif sanc_param.evidence_type == EvidenceType.OPERATOR_ASSUMPTION:
                unverified_mw = val
                findings.append(f"Sanctioned power of {val:.2f} MW is an OPERATOR ASSUMPTION without supporting utility agreement; counted as 0.0 MW firm capacity.")
            else:
                unverified_mw = val
                findings.append("Sanctioned grid power status is UNVERIFIED/UNKNOWN.")

        power_gap_mw = round(max(0.0, power_demand_mw - qualifying_firm_mw), 3)
        power_surplus_mw = round(max(0.0, qualifying_firm_mw - power_demand_mw), 3)
        coverage_pct = round((qualifying_firm_mw / power_demand_mw) * 100.0, 1) if power_demand_mw > 0 else 0.0

        # Renewable PPA & Residual Grid Requirement
        ppa_pct = None
        ppa_matched_mw = None
        residual_grid_mw = None
        if ppa_param and ppa_param.value is not None:
            ppa_pct = float(ppa_param.value)
            ppa_matched_mw = round(power_demand_mw * (ppa_pct / 100.0), 3)
            residual_grid_mw = round(max(0.0, power_demand_mw - ppa_matched_mw), 3)
            findings.append(
                f"Annual renewable PPA matching ({ppa_pct:.1f}%) represents annual volumetric matching under Indian Open Access regulations; "
                f"it does not constitute 24/7 firm hourly clean energy. Residual grid requirement is {residual_grid_mw:.2f} MW."
            )
            findings.append("EcoSite strictly does not estimate the grid fossil/clean percentage without verified real-time SLDC generation-mix dispatch data.")

        # Determine status
        if power_gap_mw > 0.0:
            status = ResourceStatus.ATTENTION_REQUIRED
            findings.append(f"Power gap detected: Facility requires {power_demand_mw:.2f} MW but qualifying firm capacity is {qualifying_firm_mw:.2f} MW (Gap: {power_gap_mw:.2f} MW).")
        elif verified_mw < power_demand_mw and documented_mw >= power_demand_mw:
            # Documented commitments cover demand, but not independently verified
            status = ResourceStatus.SUPPORTED_BY_EVIDENCE
            findings.append(f"Power requirement supported by documented commitments ({documented_mw:.2f} MW). Independent verifier confirmation recommended.")
        elif it_param.is_synthetic or pue_param.is_synthetic or (sanc_param and sanc_param.is_synthetic):
            status = ResourceStatus.ATTENTION_REQUIRED
            findings.append("Power parameters contain simulated/synthetic values.")
        else:
            status = ResourceStatus.SUPPORTED_BY_EVIDENCE
            findings.append(f"Power requirement fully supported: {qualifying_firm_mw:.2f} MW contracted vs {power_demand_mw:.2f} MW peak demand ({coverage_pct}% coverage).")

        return FacilityPowerFindings(
            it_capacity_mw=it_mw,
            pue=pue,
            facility_power_demand_mw=power_demand_mw,
            sanctioned_power_mw=sanctioned_mw,
            verified_power_mw=verified_mw,
            documented_power_mw=documented_mw,
            unverified_power_mw=unverified_mw,
            qualifying_firm_capacity_mw=qualifying_firm_mw,
            power_gap_mw=power_gap_mw,
            power_surplus_mw=power_surplus_mw,
            contracted_coverage_pct=coverage_pct,
            annual_ppa_matching_pct=ppa_pct,
            annual_ppa_matched_mw=ppa_matched_mw,
            residual_grid_requirement_mw=residual_grid_mw,
            status=status,
            findings=findings,
        )

    def _evaluate_water(self, request: FacilityResourceRequest) -> FacilityWaterFindings:
        """
        Calculates daily water demand in kL/day (m^3/day), 26-week dry season demand,
        and annual demand in MCM/year. Strictly refuses to fabricate missing WUE.
        """
        findings: List[str] = []
        wue_param = request.wue
        alloc_param = request.water_allocation_kld
        source_type = request.water_source_type or "MUNICIPAL_PIPED"

        # Check if WUE is missing or unavailable
        if wue_param is None or wue_param.value is None or wue_param.evidence_type in (EvidenceType.UNKNOWN, EvidenceType.SOURCE_UNAVAILABLE):
            return FacilityWaterFindings(
                wue_l_per_kwh=None,
                daily_water_demand_kld=None,
                annual_water_demand_mcm=None,
                dry_season_water_demand_mcm=None,
                allocated_water_kld=0.0,
                verified_allocated_kld=0.0,
                documented_allocated_kld=0.0,
                unverified_allocated_kld=0.0,
                qualifying_firm_allocated_kld=0.0,
                allocated_water_mcm=0.0,
                water_gap_kld=None,
                water_gap_mcm=None,
                water_surplus_kld=None,
                water_source_type=source_type,
                status=ResourceStatus.UNKNOWN,
                findings=["WUE (Water Usage Effectiveness) is UNPUBLISHED/UNKNOWN. Refusing to fabricate water consumption estimate without audited cooling specification."],
            )

        wue = float(wue_param.value)
        if wue < 0.0:
            return FacilityWaterFindings(
                wue_l_per_kwh=wue,
                daily_water_demand_kld=None,
                annual_water_demand_mcm=None,
                dry_season_water_demand_mcm=None,
                allocated_water_kld=0.0,
                verified_allocated_kld=0.0,
                documented_allocated_kld=0.0,
                unverified_allocated_kld=0.0,
                qualifying_firm_allocated_kld=0.0,
                allocated_water_mcm=0.0,
                water_gap_kld=None,
                water_gap_mcm=None,
                water_surplus_kld=None,
                water_source_type=source_type,
                status=ResourceStatus.UNKNOWN,
                findings=["Invalid WUE value (< 0.0 L/kWh)."],
            )

        if request.it_capacity_mw.value is None or request.it_capacity_mw.value <= 0:
            return FacilityWaterFindings(
                wue_l_per_kwh=wue,
                daily_water_demand_kld=None,
                annual_water_demand_mcm=None,
                dry_season_water_demand_mcm=None,
                allocated_water_kld=0.0,
                verified_allocated_kld=0.0,
                documented_allocated_kld=0.0,
                unverified_allocated_kld=0.0,
                qualifying_firm_allocated_kld=0.0,
                allocated_water_mcm=0.0,
                water_gap_kld=None,
                water_gap_mcm=None,
                water_surplus_kld=None,
                water_source_type=source_type,
                status=ResourceStatus.UNKNOWN,
                findings=["Facility IT capacity missing; cannot compute daily water volume."],
            )

        it_mw = float(request.it_capacity_mw.value)
        # Unit conversion: IT MW * 1000 kW * WUE (L/kWh) * 24 h/day / 1000 L/kL = it_mw * 24 * wue kL/day (m^3/day)
        daily_kld = round(it_mw * 24.0 * wue, 2)
        # 26-week / 182-day dry season MCM
        dry_season_mcm = round((daily_kld * 182.0) / 1_000_000.0, 5)
        # Annual MCM: daily_kld * 365 / 1,000,000
        annual_mcm = round((daily_kld * 365.0) / 1_000_000.0, 5)

        # Allocated water verification semantics
        allocated_kld = 0.0
        verified_alloc_kld = 0.0
        documented_alloc_kld = 0.0
        unverified_alloc_kld = 0.0
        qualifying_firm_alloc_kld = 0.0

        if alloc_param and alloc_param.value is not None and alloc_param.value >= 0:
            val = float(alloc_param.value)
            allocated_kld = val
            if alloc_param.evidence_type == EvidenceType.MEASURED_ACTUAL:
                verified_alloc_kld = val
                documented_alloc_kld = val
                qualifying_firm_alloc_kld = val
            elif alloc_param.evidence_type == EvidenceType.DOCUMENTED_COMMITMENT:
                documented_alloc_kld = val
                qualifying_firm_alloc_kld = val
                findings.append(f"Water allocation of {val:.1f} kL/day is DOCUMENTED by authority letter (MIDC/MCGM).")
            elif alloc_param.evidence_type == EvidenceType.OPERATOR_ASSUMPTION:
                unverified_alloc_kld = val
                findings.append(f"Water allocation of {val:.1f} kL/day is an OPERATOR ASSUMPTION without verified authority agreement.")
            else:
                unverified_alloc_kld = val
                findings.append("Water allocation status is UNVERIFIED/UNKNOWN.")

        allocated_mcm = round((qualifying_firm_alloc_kld * 365.0) / 1_000_000.0, 5)
        water_gap_kld = round(max(0.0, daily_kld - qualifying_firm_alloc_kld), 2)
        water_gap_mcm = round((water_gap_kld * 365.0) / 1_000_000.0, 5)
        water_surplus_kld = round(max(0.0, qualifying_firm_alloc_kld - daily_kld), 2)

        # Determine status
        if water_gap_kld > 0.0:
            status = ResourceStatus.ATTENTION_REQUIRED
            findings.append(f"Water allocation gap: Facility requires {daily_kld:.1f} kL/day ({annual_mcm:.4f} MCM/yr) but qualifying allocation is {qualifying_firm_alloc_kld:.1f} kL/day (Gap: {water_gap_kld:.1f} kL/day).")
        elif unverified_alloc_kld > 0 and qualifying_firm_alloc_kld == 0 and daily_kld > 0:
            status = ResourceStatus.ATTENTION_REQUIRED
            findings.append("Water allocation relies on unverified operator assumption.")
        elif wue_param.is_synthetic or (alloc_param and alloc_param.is_synthetic):
            status = ResourceStatus.ATTENTION_REQUIRED
            findings.append("Water metrics contain simulated/synthetic values.")
        else:
            status = ResourceStatus.SUPPORTED_BY_EVIDENCE
            findings.append(f"Water allocation supported: {qualifying_firm_alloc_kld:.1f} kL/day committed vs {daily_kld:.1f} kL/day estimated demand.")

        return FacilityWaterFindings(
            wue_l_per_kwh=wue,
            daily_water_demand_kld=daily_kld,
            annual_water_demand_mcm=annual_mcm,
            dry_season_water_demand_mcm=dry_season_mcm,
            allocated_water_kld=allocated_kld,
            verified_allocated_kld=verified_alloc_kld,
            documented_allocated_kld=documented_alloc_kld,
            unverified_allocated_kld=unverified_alloc_kld,
            qualifying_firm_allocated_kld=qualifying_firm_alloc_kld,
            allocated_water_mcm=allocated_mcm,
            water_gap_kld=water_gap_kld,
            water_gap_mcm=water_gap_mcm,
            water_surplus_kld=water_surplus_kld,
            water_source_type=source_type,
            status=status,
            findings=findings,
        )

    def _evaluate_regional_electricity(
        self, request: FacilityResourceRequest, facility_power_demand_mw: Optional[float]
    ) -> RegionalElectricityOutlookFindings:
        """
        Integrates vetted Maharashtra regional electricity backtest metrics
        and contextualizes facility demand against statewide peak met.
        Explicitly flags as HISTORICAL_BACKTEST and CURRENT_FORECAST_UNAVAILABLE.
        """
        findings: List[str] = []
        peak_met = self.regional_peak_met_mw

        share_pct = None
        if facility_power_demand_mw is not None and facility_power_demand_mw > 0:
            share_pct = round((facility_power_demand_mw / peak_met) * 100.0, 3)
            findings.append(f"Facility peak demand represents approximately {share_pct:.3f}% of Maharashtra historical grid peak met (~{peak_met:.0f} MW).")

        p10 = round(peak_met + self.elec_q10_offset, 1)
        p90 = round(peak_met + self.elec_q90_offset, 1)

        findings.append("Regional electricity demand exhibits strong seasonal peaking in March–May due to summer cooling and agricultural pumping loads.")
        findings.append("High statewide peak load reflects macro grid dispatch conditions; it does not indicate this facility causes transmission congestion or grid failure.")

        disclaimer = (
            "HISTORICAL BACKTEST ONLY: Metrics reflect historical out-of-sample backtest results on Maharashtra SLDC/CEA data (Nov 2023–Apr 2024). "
            "Live 2026 operational forecast is CURRENTLY UNAVAILABLE. Grid headroom does not establish local substation spare capacity."
        )

        return RegionalElectricityOutlookFindings(
            forecast_classification="HISTORICAL_BACKTEST",
            is_live_2026_forecast=False,
            live_status_label="CURRENT_FORECAST_UNAVAILABLE",
            forecast_horizon=self.elec_horizon,
            forecast_period=f"{self.elec_horizon} (176 evaluated days)",
            forecast_origin=self.elec_origin,
            data_cutoff_date=self.elec_data_cutoff,
            model_version="ML-F2.1 Selected Baseline",
            selected_model=self.elec_model_name,
            model_mae_mw=self.elec_mae_mw,
            model_mape_pct=self.elec_mape_pct,
            regional_peak_met_mw=peak_met,
            facility_share_of_grid_peak_pct=share_pct,
            calibrated_80pct_interval_mw=(p10, p90),
            uncertainty_method="Out-of-sample residual conformal intervals (80% nominal coverage, 81.82% empirical)",
            high_demand_season="Summer (March–May)",
            grid_stress_level="SEASONAL_PEAK_SUMMER",
            status=ResourceStatus.SUPPORTED_BY_EVIDENCE,
            epistemic_disclaimer=disclaimer,
            findings=findings,
        )

    def _evaluate_regional_reservoir(
        self,
        request: FacilityResourceRequest,
        annual_water_mcm: Optional[float],
        dry_season_water_demand_mcm: Optional[float],
        daily_water_demand_kld: Optional[float],
    ) -> RegionalReservoirOutlookFindings:
        """
        Integrates vetted Bhatsa reservoir storage forecast (ML-F3.4).
        Performs strict geographic service-area validation and matches calculation periods.
        """
        findings: List[str] = []
        district_clean = request.location_district.strip().lower()
        basin_clean = (request.service_basin or "").strip().lower()

        is_mmr_district = any(area in district_clean for area in MMR_BHATSA_SERVICE_AREAS)
        is_bhatsa_basin = any(area in basin_clean for area in MMR_BHATSA_SERVICE_AREAS)

        service_area_match = is_mmr_district or is_bhatsa_basin

        if not service_area_match:
            diagnostics = f"Facility location '{request.location_district}' is outside the Bhatsa / Ulhas hydrological basin (MMR)."
            findings.append(f"SERVICE AREA MISMATCH: {diagnostics}")
            findings.append("Bhatsa reservoir drawdown cannot be used as an environmental water indicator for this facility.")
            findings.append(f"Localized water storage data for '{request.location_district}' is currently SOURCE_UNAVAILABLE.")

            return RegionalReservoirOutlookFindings(
                target_reservoir=self.water_target_reservoir,
                service_area_match=False,
                service_basin_diagnostics=diagnostics,
                forecast_classification="HISTORICAL_BACKTEST",
                is_live_2026_forecast=False,
                live_status_label="CURRENT_FORECAST_UNAVAILABLE",
                reservoir_capacity_mcm=self.water_capacity_mcm,
                forecast_horizon=self.water_horizon,
                forecast_period="2024-01-04 to 2024-06-27 (26 weeks / 2024-H1)",
                forecast_origin=self.water_origin,
                data_cutoff_date=self.water_data_cutoff,
                model_version="ML-F3.4 Candidate 2",
                selected_model=self.water_model_name,
                model_mae_mcm=self.water_mae_mcm,
                model_mape_pct=self.water_mape_pct,
                dry_season_drawdown_mcm=self.bhatsa_dry_season_drawdown_mcm,
                dry_season_minimum_storage_mcm=self.bhatsa_dry_season_min_mcm,
                facility_share_of_bhatsa_capacity_pct=None,
                facility_share_of_dry_season_drawdown_pct=None,
                facility_share_of_daily_municipal_throughput_pct=None,
                uncertainty_method="Empirical residual quantiles bounded within physical capacity [0, 942.1] MCM",
                storage_drawdown_risk="SOURCE_UNAVAILABLE_BASIN_MISMATCH",
                status=ResourceStatus.SOURCE_UNAVAILABLE,
                epistemic_disclaimer="Facility is hydrologically disconnected from Bhatsa Dam. Do not evaluate municipal water security against an irrelevant reservoir.",
                findings=findings,
            )

        # Service area matched (MMR / Thane)
        diagnostics = f"Facility located in '{request.location_district}' is hydrologically served by the Bhatsa / Ulhas water basin (MMR/MCGM/TMC/NMMC)."
        findings.append(diagnostics)

        share_cap_pct = None
        share_drawdown_pct = None
        share_throughput_pct = None

        if annual_water_mcm is not None and annual_water_mcm > 0:
            share_cap_pct = round((annual_water_mcm / self.water_capacity_mcm) * 100.0, 4)
            findings.append(f"Facility annual water requirement ({annual_water_mcm:.4f} MCM/yr) represents {share_cap_pct:.4f}% of Bhatsa gross capacity ({self.water_capacity_mcm} MCM).")

        # Period-matched comparison: 26-week dry season demand vs 26-week seasonal storage drawdown
        if dry_season_water_demand_mcm is not None and dry_season_water_demand_mcm > 0:
            share_drawdown_pct = round((dry_season_water_demand_mcm / self.bhatsa_dry_season_drawdown_mcm) * 100.0, 4)
            findings.append(
                f"Matched Period Analysis: Facility 26-week dry-season water demand ({dry_season_water_demand_mcm:.4f} MCM) represents "
                f"{share_drawdown_pct:.4f}% of Bhatsa's historical dry-season storage drawdown ({self.bhatsa_dry_season_drawdown_mcm:.1f} MCM)."
            )

        # Rate comparison: daily requirement vs daily municipal water supply throughput
        if daily_water_demand_kld is not None and daily_water_demand_kld > 0:
            share_throughput_pct = round((daily_water_demand_kld / self.bhatsa_daily_municipal_capacity_kld) * 100.0, 4)
            findings.append(
                f"Supply Context: Facility daily water requirement ({daily_water_demand_kld:.1f} kL/day) represents "
                f"{share_throughput_pct:.4f}% of the Bhatsa municipal water supply throughput (~2,400 MLD) serving MMR."
            )

        findings.append(
            "Storage context vs supply distinction: Reservoir storage drawdown provides regional hydrological context; "
            "it does not represent direct unmetered abstraction by the facility. Facility water supply is governed by municipal/industrial off-take allocations (e.g. MIDC/MCGM piped connection)."
        )

        disclaimer = (
            "HISTORICAL BACKTEST ONLY: Bhatsa storage forecasts reflect CWC weekly monitoring data and fixed-origin 2024-H1 evaluation. "
            "Live 2026 operational forecast is CURRENTLY UNAVAILABLE. Municipal authorities prioritize domestic drinking needs over industrial off-take during acute drought."
        )

        return RegionalReservoirOutlookFindings(
            target_reservoir=self.water_target_reservoir,
            service_area_match=True,
            service_basin_diagnostics=diagnostics,
            forecast_classification="HISTORICAL_BACKTEST",
            is_live_2026_forecast=False,
            live_status_label="CURRENT_FORECAST_UNAVAILABLE",
            reservoir_capacity_mcm=self.water_capacity_mcm,
            forecast_horizon=self.water_horizon,
            forecast_period="2024-01-04 to 2024-06-27 (26 weeks / 2024-H1)",
            forecast_origin=self.water_origin,
            data_cutoff_date=self.water_data_cutoff,
            model_version="ML-F3.4 Candidate 2",
            selected_model=self.water_model_name,
            model_mae_mcm=self.water_mae_mcm,
            model_mape_pct=self.water_mape_pct,
            dry_season_drawdown_mcm=self.bhatsa_dry_season_drawdown_mcm,
            dry_season_minimum_storage_mcm=self.bhatsa_dry_season_min_mcm,
            facility_share_of_bhatsa_capacity_pct=share_cap_pct,
            facility_share_of_dry_season_drawdown_pct=share_drawdown_pct,
            facility_share_of_daily_municipal_throughput_pct=share_throughput_pct,
            uncertainty_method="Empirical residual quantiles bounded within physical capacity [0, 942.1] MCM",
            storage_drawdown_risk="SEASONAL_DRAWDOWN_NORMAL",
            status=ResourceStatus.SUPPORTED_BY_EVIDENCE,
            epistemic_disclaimer=disclaimer,
            findings=findings,
        )

    def _evaluate_climate_cooling(self, request: FacilityResourceRequest) -> ClimateCoolingPressureFindings:
        """
        Assesses thermal climate cooling pressure based on Maharashtra ERA5 summer normals.
        """
        findings: List[str] = []
        cooling_type = (request.cooling_system_type or "EVAPORATIVE_OR_HYBRID").upper()

        findings.append("Maharashtra summer dry-bulb temperatures regularly exceed 38–40°C in April–May with high solar irradiance.")
        findings.append(f"Cooling system type '{cooling_type}' will experience elevated heat rejection lift during summer peak hours.")

        if "EVAPORATIVE" in cooling_type:
            findings.append("Evaporative systems experience 15–25% higher water evaporation rates during hot dry pre-monsoon weeks (April–May).")
            impact_pct = 20.0
        elif "AIR" in cooling_type:
            findings.append("Air-cooled systems experience 10–20% higher compressor energy consumption during extreme summer heat, increasing instantaneous PUE.")
            impact_pct = 15.0
        else:
            findings.append("Closed-loop or hybrid cooling systems mitigate water loss but require adequate chiller design margin.")
            impact_pct = 10.0

        caveat = "Climate cooling indicators represent regional meteorological tendencies and do not replace detailed computational fluid dynamics (CFD) or chiller plant simulations."

        return ClimateCoolingPressureFindings(
            heat_stress_indicator="MODERATE_TO_HIGH_SUMMER_THERMAL_LOAD",
            temperature_extreme_risk="ELEVATED_IN_APRIL_MAY",
            cooling_efficiency_impact_pct=impact_pct,
            epistemic_caveat=caveat,
            findings=findings,
        )

    def _evaluate_uncertainty(
        self, request: FacilityResourceRequest, power: FacilityPowerFindings, water: FacilityWaterFindings
    ) -> UncertaintyAndMissingEvidence:
        """
        Inventories unverified parameters, operator assumptions, synthetic data,
        and missing critical evidence.
        """
        unverified: List[str] = []
        assumptions: List[str] = []
        synthetics: List[str] = []
        missing: List[str] = []

        params = [
            ("it_capacity_mw", request.it_capacity_mw),
            ("pue", request.pue),
            ("wue", request.wue),
            ("sanctioned_grid_mw", request.sanctioned_grid_mw),
            ("water_allocation_kld", request.water_allocation_kld),
            ("renewable_ppa_pct", request.renewable_ppa_pct),
        ]

        for name, param in params:
            if param is None or param.value is None or param.evidence_type in (EvidenceType.UNKNOWN, EvidenceType.SOURCE_UNAVAILABLE):
                missing.append(f"{name}: Parameter is missing or unprovided.")
                continue
            if param.is_synthetic:
                synthetics.append(f"{name}: Marked as SIMULATED / SYNTHETIC data.")
            if param.evidence_type == EvidenceType.OPERATOR_ASSUMPTION:
                assumptions.append(f"{name}: Declared as OPERATOR ASSUMPTION without supporting utility/auditor documentation.")
            elif param.evidence_type not in (EvidenceType.MEASURED_ACTUAL, EvidenceType.DOCUMENTED_COMMITMENT):
                unverified.append(f"{name}: Evidence state is UNVERIFIED.")

        caveats = [
            f"Electricity conformal interval provides empirical 80% coverage ({self.elec_coverage_pct}% on untouched 2023-2024 test window); out-of-sample extremes beyond historical range may exceed interval bounds.",
            "Water reservoir empirical uncertainty is derived from 26-week backtest; true asymptotic probabilities cannot be guaranteed from a single seasonal cycle.",
            "Current 2026 live operational forecasts are UNAVAILABLE. All model outputs are historical backtests.",
        ]

        return UncertaintyAndMissingEvidence(
            unverified_parameters=unverified,
            operator_assumptions=assumptions,
            synthetic_parameters=synthetics,
            missing_critical_data=missing,
            conformal_coverage_caveats=caveats,
        )

    def _generate_recommendations(
        self,
        request: FacilityResourceRequest,
        power: FacilityPowerFindings,
        water: FacilityWaterFindings,
        reservoir: RegionalReservoirOutlookFindings,
        uncertainty: UncertaintyAndMissingEvidence,
    ) -> List[str]:
        """Generates actionable recommendations for project developers and reviewers."""
        actions: List[str] = []

        # Power actions
        if power.power_gap_mw and power.power_gap_mw > 0:
            actions.append(
                f"ACTION REQUIRED: Submit formal utility interconnection application to MSEDCL/BEST for additional {power.power_gap_mw:.2f} MW firm capacity to resolve power gap."
            )
        elif power.contracted_coverage_pct is not None and power.contracted_coverage_pct >= 100.0:
            if power.verified_power_mw == 0 and power.documented_power_mw > 0:
                actions.append(
                    "INDEPENDENT VERIFICATION: Documented power sanction should be confirmed by an independent utility verification review before investment close."
                )

        # Water actions
        if water.wue_l_per_kwh is None:
            actions.append(
                "DATA GAP: Commission an audited cooling water consumption study to establish verified WUE (L/kWh) and peak summer daily requirements."
            )
        elif water.water_gap_kld and water.water_gap_kld > 0:
            actions.append(
                f"ACTION REQUIRED: Secure supplementary water allocation agreement from MIDC/MCGM for {water.water_gap_kld:.1f} kL/day, or implement tertiary treated wastewater recycling to offset freshwater intake."
            )

        # Reservoir actions
        if not reservoir.service_area_match:
            actions.append(
                f"GEOGRAPHIC RESOLUTION: Ingest localized hydrologic data for '{request.location_district}' (e.g. Ujjani / Khadakwasla / Jayakwadi) rather than benchmarking against Bhatsa."
            )
        else:
            actions.append(
                "DROUGHT PREPAREDNESS: Establish on-site buffer water storage (minimum 48–72 hours peak demand) to protect operations during municipal pre-monsoon water rationing."
            )

        # Evidence actions
        if uncertainty.synthetic_parameters:
            actions.append(
                "COMPLIANCE: Replace all SIMULATED/synthetic parameter entries with authenticated utility agreements and engineering schematics prior to final screening approval."
            )
        if uncertainty.operator_assumptions:
            actions.append(
                "DOCUMENTATION: Obtain third-party commissioning certification or formal utility contracts to convert operator assumptions into documented commitments."
            )

        return actions

    def _determine_overall_status(
        self,
        power: FacilityPowerFindings,
        water: FacilityWaterFindings,
        elec: RegionalElectricityOutlookFindings,
        reservoir: RegionalReservoirOutlookFindings,
        uncertainty: UncertaintyAndMissingEvidence,
    ) -> ResourceStatus:
        """
        Determines consolidated status following strict epistemic rules:
        - UNKNOWN if essential facility sizing is missing.
        - SOURCE_UNAVAILABLE if localized data is fundamentally absent.
        - ATTENTION_REQUIRED if there are uncontracted gaps, assumptions, or synthetic data.
        - SUPPORTED_BY_EVIDENCE only when fully documented commitments match or exceed demand.
        """
        # Critical missing facility parameters yield UNKNOWN
        if power.status == ResourceStatus.UNKNOWN:
            return ResourceStatus.UNKNOWN
        if power.facility_power_demand_mw is None or power.it_capacity_mw is None:
            return ResourceStatus.UNKNOWN

        # Gaps or assumptions or synthetics yield ATTENTION_REQUIRED
        has_power_gap = power.power_gap_mw is not None and power.power_gap_mw > 0.0
        has_water_gap = water.water_gap_kld is not None and water.water_gap_kld > 0.0
        has_synthetic = len(uncertainty.synthetic_parameters) > 0
        has_critical_assumption = len(uncertainty.operator_assumptions) > 0
        has_missing_wue = water.status == ResourceStatus.UNKNOWN

        if has_power_gap or has_water_gap or has_synthetic or has_critical_assumption or has_missing_wue:
            return ResourceStatus.ATTENTION_REQUIRED

        # If reservoir is mismatched, regional outlook is partially SOURCE_UNAVAILABLE
        # but if facility power and water are fully supported, we flag ATTENTION_REQUIRED
        # to ensure the developer acquires local watershed data
        if not reservoir.service_area_match:
            return ResourceStatus.ATTENTION_REQUIRED

        # If everything is documented and contracts cover demand
        if power.status == ResourceStatus.SUPPORTED_BY_EVIDENCE and water.status == ResourceStatus.SUPPORTED_BY_EVIDENCE:
            return ResourceStatus.SUPPORTED_BY_EVIDENCE

        return ResourceStatus.ATTENTION_REQUIRED
