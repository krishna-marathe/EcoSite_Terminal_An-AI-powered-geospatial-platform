import { apiClient } from "./api";

export interface MLPredictionInput {
  capacity_mw: number;
  water_demand_kl_day: number;
  power_demand_mw: number;
  location: "IN-MH" | "IN-TG" | "IN-KA" | "IN-TN";
  months_ahead: 6 | 9 | 12;
  model_version?: string;
  capacity_boundary?: string;
  cooling_system_type?: string;
}

export interface BoundaryScenarioDetails {
  interpretation: string;
  derived_it_capacity_mw: number;
  derived_power_demand_mw: number;
  benchmark_cooling_water_kld: number;
  assumed_pue: number;
  note: string;
}

export interface MLPredictionOutput {
  power_demand_mw_pred?: number | null;
  water_demand_kl_day_pred?: number | null;
  benchmark_cooling_water_kl_day?: number | null;
  benchmark_cooling_options?: Record<string, number> | null;
  capacity_mw_pred?: number | null;
  capacity_boundary_status?: string | null;
  boundary_scenarios?: {
    scenario_a_intake_boundary?: BoundaryScenarioDetails;
    scenario_b_it_load_boundary?: BoundaryScenarioDetails;
  } | null;
  pue_applied?: number | null;
  wue_applied?: number | null;
  cooling_architecture_assumed?: string | null;
  confidence_score?: number | null;
  prediction_horizon_months: number;
  model_name: string;
  timestamp: string;
  status?: string;
  classification?: string;
  provenance_note?: string;
  input_summary: {
    capacity_mw: number;
    water_demand_kl_day: number;
    power_demand_mw: number;
    location: string;
    months_ahead: number;
    capacity_boundary?: string;
    cooling_system_type?: string;
  };
}

export interface MLPredictionsOutput {
  month_6: MLPredictionOutput;
  month_9: MLPredictionOutput;
  month_12: MLPredictionOutput;
}

export interface RegionalLgbmInferenceResponse {
  status: string;
  scope: string;
  target_date: string;
  origin_date: string;
  lead_days: number;
  lead_weeks: number;
  horizon_status: string;
  horizon_notice: string;
  predictions: {
    lightgbm_predicted_peak_met_mw: number;
    seasonal_naive_baseline_mw: number;
    lightgbm_residual_adjustment_mw: number;
  };
  model_metadata: {
    model_artifact: string;
    model_type: string;
    num_trees: number;
    num_features: number;
    backtest_7window_mae_mw: number;
    backtest_7window_mape_pct: number;
    recent_3window_mae_mw: number;
    operational_model_comparison: {
      selected_operational_model: string;
      operational_7window_mae_mw: number;
      operational_7window_mape_pct: number;
      reason_for_selection: string;
    };
  };
  features: Record<string, number>;
  provenance: {
    historical_data_source: string;
    climatology_source: string;
    epistemic_guard: string;
  };
}

export interface RegulatoryWaterParameter {
  parameter_name: string;
  consented_quantity: number | null;
  actual_quantity: number | null;
  unit: string;
  status: string;
}

export interface RegulatoryWaterObservation {
  id: string;
  reporting_facility: string;
  operator: string;
  site_code: string;
  state: string;
  district: string;
  locality: string;
  regulatory_authority: string;
  document_type: string;
  identification_number: string;
  proposal_number?: string | null;
  reporting_period: string;
  measurement_boundary: string;
  parameters: RegulatoryWaterParameter[];
  water_source: string;
  cooling_configuration: string;
  wastewater_management: string;
  source_document: string;
  source_url: string;
  page_or_reference: string;
  site_match_status: string;
  cross_site_prohibition: string;
}

export interface RegulatoryWaterRegistryResponse {
  registry_version: string;
  generated_at: string;
  description: string;
  epistemic_guards: string[];
  count: number;
  observations: RegulatoryWaterObservation[];
}

export const mlService = {
  // Get available ML model versions
  async getMLModels(): Promise<string[]> {
    try {
      const response = await apiClient.get<string[]>("/ml/models");
      return Array.isArray(response.data) ? response.data : ["ML-F2.1", "ML-F3.4", "ML-F4.1", "ML-LGBM-V3"];
    } catch {
      return ["ML-F2.1", "ML-F3.4", "ML-F4.1", "ML-LGBM-V3"];
    }
  },

  // Get model info
  async getModelInfo(version: string): Promise<any> {
    const response = await apiClient.get(`/ml/model-info/${version}`);
    return response.data;
  },

  // Live LightGBM Regional Inference
  async getRegionalLgbmInference(targetDate: string = "2026-11-15"): Promise<RegionalLgbmInferenceResponse> {
    const response = await apiClient.get<RegionalLgbmInferenceResponse>(
      `/ml/regional-lgbm-inference?target_date=${encodeURIComponent(targetDate)}`
    );
    return response.data;
  },

  // Predict data centre requirements for a single horizon
  async predictRequirements(
    input: MLPredictionInput
  ): Promise<MLPredictionOutput> {
    const response = await apiClient.post<MLPredictionOutput>(
      "/ml/predict",
      input
    );
    return response.data;
  },

  // Get multi-month predictions (6, 9, 12 months)
  async getMultiMonthPredictions(
    baseInput: Omit<MLPredictionInput, "months_ahead">
  ): Promise<MLPredictionsOutput> {
    const [month_6, month_9, month_12] = await Promise.all([
      this.predictRequirements({ ...baseInput, months_ahead: 6 }),
      this.predictRequirements({ ...baseInput, months_ahead: 9 }),
      this.predictRequirements({ ...baseInput, months_ahead: 12 }),
    ]);

    return {
      month_6,
      month_9,
      month_12,
    };
  },

  // Regulatory Water Observations
  async getRegulatoryWaterObservations(
    siteCode?: string,
    facilityId?: string
  ): Promise<RegulatoryWaterRegistryResponse> {
    const params = new URLSearchParams();
    if (siteCode) params.set("site_code", siteCode);
    if (facilityId) params.set("facility_id", facilityId);
    const qs = params.toString() ? `?${params.toString()}` : "";
    const response = await apiClient.get<RegulatoryWaterRegistryResponse>(
      `/environmental/regulatory-water-observations${qs}`
    );
    return response.data;
  },
};
