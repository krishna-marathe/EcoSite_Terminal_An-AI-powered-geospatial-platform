import { apiClient } from "./api";

export interface MLPredictionInput {
  capacity_mw: number;
  water_demand_kl_day: number;
  power_demand_mw: number;
  location: "IN-MH" | "IN-TG" | "IN-KA" | "IN-TN";
  months_ahead: 6 | 9 | 12;
  model_version?: string;
}

export interface MLPredictionOutput {
  power_demand_mw_pred?: number | null;
  water_demand_kl_day_pred?: number | null;
  benchmark_cooling_water_kl_day?: number | null;
  benchmark_cooling_options?: Record<string, number> | null;
  capacity_mw_pred?: number | null;
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
  };
}

export interface MLPredictionsOutput {
  month_6: MLPredictionOutput;
  month_9: MLPredictionOutput;
  month_12: MLPredictionOutput;
}

export const mlService = {
  // Get available ML model versions
  async getMLModels(): Promise<string[]> {
    try {
      const response = await apiClient.get<string[]>("/ml/models");
      return Array.isArray(response.data) ? response.data : ["ML-F2.1", "ML-F3.4", "ML-F4.1"];
    } catch {
      return ["ML-F2.1", "ML-F3.4", "ML-F4.1"];
    }
  },

  // Get model info
  async getModelInfo(version: string): Promise<any> {
    const response = await apiClient.get(`/ml/model-info/${version}`);
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
};
