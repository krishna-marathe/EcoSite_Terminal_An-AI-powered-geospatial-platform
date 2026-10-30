export type ResourceStatus = 'SUPPORTED_BY_EVIDENCE' | 'ATTENTION_REQUIRED' | 'UNKNOWN' | 'SOURCE_UNAVAILABLE';

export interface FacilityPowerFindings {
  it_capacity_mw: number | null;
  pue: number | null;
  facility_power_demand_mw: number | null;
  sanctioned_power_mw: number;
  verified_power_mw: number;
  documented_power_mw: number;
  unverified_power_mw: number;
  qualifying_firm_capacity_mw: number;
  power_gap_mw: number | null;
  power_surplus_mw: number;
  contracted_coverage_pct: number | null;
  annual_ppa_matching_pct: number | null;
  annual_ppa_matched_mw: number | null;
  residual_grid_requirement_mw: number | null;
  status: ResourceStatus;
  findings: string[];
}

export interface FacilityWaterFindings {
  wue_l_per_kwh: number | null;
  daily_water_demand_kld: number | null;
  annual_water_demand_mcm: number | null;
  dry_season_water_demand_mcm: number | null;
  allocated_water_kld: number;
  verified_allocated_kld: number;
  documented_allocated_kld: number;
  unverified_allocated_kld: number;
  qualifying_firm_allocated_kld: number;
  allocated_water_mcm: number;
  water_gap_kld: number | null;
  water_gap_mcm: number | null;
  water_surplus_kld: number | null;
  water_source_type: string;
  status: ResourceStatus;
  findings: string[];
}

export interface RegionalElectricityOutlookFindings {
  forecast_classification: string;
  is_live_2026_forecast: boolean;
  live_status_label: string;
  forecast_horizon: string;
  forecast_period: string;
  forecast_origin: string;
  data_cutoff_date: string;
  model_version: string;
  selected_model: string;
  model_mae_mw: number;
  model_mape_pct: number;
  regional_peak_met_mw: number;
  facility_share_of_grid_peak_pct: number | null;
  calibrated_80pct_interval_mw: [number, number];
  uncertainty_method: string;
  high_demand_season: string;
  grid_stress_level: string;
  status: ResourceStatus;
  epistemic_disclaimer: string;
  findings: string[];
}

export interface RegionalReservoirOutlookFindings {
  target_reservoir: string;
  service_area_match: boolean;
  service_basin_diagnostics: string;
  forecast_classification: string;
  is_live_2026_forecast: boolean;
  live_status_label: string;
  reservoir_capacity_mcm: number;
  forecast_horizon: string;
  forecast_period: string;
  forecast_origin: string;
  data_cutoff_date: string;
  model_version: string;
  selected_model: string;
  model_mae_mcm: number;
  model_mape_pct: number;
  dry_season_drawdown_mcm: number;
  dry_season_minimum_storage_mcm: number;
  facility_share_of_bhatsa_capacity_pct: number | null;
  facility_share_of_dry_season_drawdown_pct: number | null;
  facility_share_of_daily_municipal_throughput_pct: number | null;
  uncertainty_method: string;
  storage_drawdown_risk: string;
  status: ResourceStatus;
  epistemic_disclaimer: string;
  findings: string[];
}

export interface ClimateCoolingPressureFindings {
  heat_stress_indicator: string;
  temperature_extreme_risk: string;
  cooling_efficiency_impact_pct: number;
  epistemic_caveat: string;
  findings: string[];
}

export interface UncertaintyAndMissingEvidence {
  unverified_parameters: string[];
  operator_assumptions: string[];
  synthetic_parameters: string[];
  missing_critical_data: string[];
  conformal_coverage_caveats: string[];
}

export interface ResourceOutlookResponse {
  facility_id: string;
  facility_name: string;
  overall_status: ResourceStatus;
  forecast_classification: string;
  live_status_label: string;
  forecast_horizon: string;
  source_period: string;
  model_version: string;
  power_findings: FacilityPowerFindings;
  water_findings: FacilityWaterFindings;
  regional_electricity: RegionalElectricityOutlookFindings;
  regional_reservoir: RegionalReservoirOutlookFindings;
  climate_cooling: ClimateCoolingPressureFindings;
  uncertainty_and_missing_evidence: UncertaintyAndMissingEvidence;
  recommended_review_actions: string[];
  epistemic_disclaimers: string[];
}

