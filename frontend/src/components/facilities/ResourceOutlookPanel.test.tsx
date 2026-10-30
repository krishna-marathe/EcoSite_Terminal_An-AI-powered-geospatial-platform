import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ResourceOutlookPanel } from './ResourceOutlookPanel';
import type { ResourceOutlookResponse } from '../../types/resourceOutlook';

const mockMmrData: ResourceOutlookResponse = {
  facility_id: 'test-mmr-dc',
  facility_name: 'Navi Mumbai Hyper DC',
  overall_status: 'SUPPORTED_BY_EVIDENCE',
  forecast_classification: 'HISTORICAL_BACKTEST',
  live_status_label: 'CURRENT_FORECAST_UNAVAILABLE',
  forecast_horizon: 'Electricity: 2023-11-01 to 2024-04-27; Reservoir: 2024-01-04 to 2024-06-27',
  source_period: 'Historical Backtest Windows 2023-H2 and 2024-H1',
  model_version: 'ML-F4.1',
  power_findings: {
    it_capacity_mw: 20.0,
    pue: 1.35,
    facility_power_demand_mw: 27.0,
    sanctioned_power_mw: 30.0,
    verified_power_mw: 30.0,
    documented_power_mw: 30.0,
    unverified_power_mw: 0.0,
    qualifying_firm_capacity_mw: 30.0,
    power_gap_mw: 0.0,
    power_surplus_mw: 3.0,
    contracted_coverage_pct: 111.1,
    annual_ppa_matching_pct: 50.0,
    annual_ppa_matched_mw: 13.5,
    residual_grid_requirement_mw: 13.5,
    status: 'SUPPORTED_BY_EVIDENCE',
    findings: ['Power requirement supported'],
  },
  water_findings: {
    wue_l_per_kwh: 1.25,
    daily_water_demand_kld: 600.0,
    annual_water_demand_mcm: 0.219,
    dry_season_water_demand_mcm: 0.1092,
    allocated_water_kld: 700.0,
    verified_allocated_kld: 700.0,
    documented_allocated_kld: 700.0,
    unverified_allocated_kld: 0.0,
    qualifying_firm_allocated_kld: 700.0,
    allocated_water_mcm: 0.2555,
    water_gap_kld: 0.0,
    water_gap_mcm: 0.0,
    water_surplus_kld: 100.0,
    water_source_type: 'MUNICIPAL_PIPED',
    status: 'SUPPORTED_BY_EVIDENCE',
    findings: ['Water allocations cover demand'],
  },
  regional_electricity: {
    forecast_classification: 'HISTORICAL_BACKTEST',
    is_live_2026_forecast: false,
    live_status_label: 'CURRENT_FORECAST_UNAVAILABLE',
    forecast_horizon: '2023-11-01 to 2024-04-27',
    forecast_period: '2023-11-01 to 2024-04-27 (176 days)',
    forecast_origin: '2023-10-31',
    data_cutoff_date: '2023-10-31',
    model_version: 'ML-F2.1',
    selected_model: 'SEASONAL_NAIVE_WITH_CALIBRATED_INTERVALS',
    model_mae_mw: 1230.17,
    model_mape_pct: 4.62,
    regional_peak_met_mw: 30675.0,
    facility_share_of_grid_peak_pct: 0.088,
    calibrated_80pct_interval_mw: [30054.8, 35587.2],
    uncertainty_method: 'Conformal residual intervals',
    high_demand_season: 'Summer (March–May)',
    grid_stress_level: 'SEASONAL_PEAK_SUMMER',
    status: 'SUPPORTED_BY_EVIDENCE',
    epistemic_disclaimer: 'Historical backtest only',
    findings: ['High statewide peak met'],
  },
  regional_reservoir: {
    target_reservoir: 'Bhatsa Lake (Thane / MMR Basin)',
    service_area_match: true,
    service_basin_diagnostics: 'Facility is in MMR / Bhatsa supply zone.',
    forecast_classification: 'HISTORICAL_BACKTEST',
    is_live_2026_forecast: false,
    live_status_label: 'CURRENT_FORECAST_UNAVAILABLE',
    reservoir_capacity_mcm: 942.1,
    forecast_horizon: '2024-01-04 to 2024-06-27',
    forecast_period: '26 weeks',
    forecast_origin: '2024-01-04',
    data_cutoff_date: '2024-01-04',
    model_version: 'ML-F3.4',
    selected_model: 'Candidate 2: Trend-Adjusted Seasonal Baseline',
    model_mae_mcm: 10.23,
    model_mape_pct: 2.89,
    dry_season_drawdown_mcm: 508.0,
    dry_season_minimum_storage_mcm: 197.0,
    facility_share_of_bhatsa_capacity_pct: 0.0232,
    facility_share_of_dry_season_drawdown_pct: 0.0215,
    facility_share_of_daily_municipal_throughput_pct: 0.025,
    uncertainty_method: 'Empirical residual quantiles',
    storage_drawdown_risk: 'SEASONAL_DRAWDOWN_NORMAL',
    status: 'SUPPORTED_BY_EVIDENCE',
    epistemic_disclaimer: 'Historical backtest only',
    findings: ['Storage drawdown represents seasonal hydrology'],
  },
  climate_cooling: {
    heat_stress_indicator: 'MODERATE_TO_HIGH',
    temperature_extreme_risk: 'ELEVATED_IN_APRIL_MAY',
    cooling_efficiency_impact_pct: 20.0,
    epistemic_caveat: 'Climate normals from ERA5',
    findings: [],
  },
  uncertainty_and_missing_evidence: {
    unverified_parameters: [],
    operator_assumptions: [],
    synthetic_parameters: [],
    missing_critical_data: [],
    conformal_coverage_caveats: ['Empirical coverage on 2023-2024 test window'],
  },
  recommended_review_actions: [
    'Verify utility sanction letter includes transmission bay commissioning date.',
  ],
  epistemic_disclaimers: [
    'EcoSite does not grant legal approvals or verify utility capacity.',
  ],
};

const mockMismatchData: ResourceOutlookResponse = {
  ...mockMmrData,
  facility_id: 'test-pune-dc',
  facility_name: 'Pune Facility',
  overall_status: 'ATTENTION_REQUIRED',
  regional_reservoir: {
    ...mockMmrData.regional_reservoir,
    service_area_match: false,
    service_basin_diagnostics: "Facility location 'Pune' is outside the Bhatsa basin.",
    status: 'SOURCE_UNAVAILABLE',
    storage_drawdown_risk: 'SOURCE_UNAVAILABLE_BASIN_MISMATCH',
    facility_share_of_dry_season_drawdown_pct: null,
    facility_share_of_daily_municipal_throughput_pct: null,
    findings: ['SERVICE AREA MISMATCH: Outside Bhatsa basin.'],
  },
  uncertainty_and_missing_evidence: {
    ...mockMmrData.uncertainty_and_missing_evidence,
    missing_critical_data: ['wue: Parameter is missing or unprovided.'],
  },
};

describe('ResourceOutlookPanel', () => {
  it('renders prominent historical backtest and current forecast unavailable badges', () => {
    render(<ResourceOutlookPanel data={mockMmrData} />);
    const backtestBadges = screen.getAllByText(/HISTORICAL BACKTEST/i);
    expect(backtestBadges.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('CURRENT FORECAST UNAVAILABLE')).toBeInTheDocument();
  });

  it('renders power and water metrics, residual grid requirement, and matched drawdown', () => {
    render(<ResourceOutlookPanel data={mockMmrData} />);
    expect(screen.getByText(/27 MW/i)).toBeInTheDocument();
    expect(screen.getByText(/Residual Grid Requirement:/i)).toBeInTheDocument();
    expect(screen.getByText(/13.5 MW/i)).toBeInTheDocument();
    expect(screen.getByText(/600 kL\/d/i)).toBeInTheDocument();
    expect(screen.getByText(/0.0215%/i)).toBeInTheDocument();
  });

  it('renders basin service area mismatch alert for non-MMR facility', () => {
    render(<ResourceOutlookPanel data={mockMismatchData} />);
    expect(screen.getByText(/Basin Service Area Mismatch/i)).toBeInTheDocument();
    expect(screen.getByText(/outside the Bhatsa basin/i)).toBeInTheDocument();
  });

  it('renders loading and error states', () => {
    const { rerender } = render(<ResourceOutlookPanel loading={true} />);
    expect(screen.getByText(/Evaluating deterministic facility resource stress/i)).toBeInTheDocument();

    rerender(<ResourceOutlookPanel error="API connection timed out" />);
    expect(screen.getByText(/API connection timed out/i)).toBeInTheDocument();
  });
});
