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
  power_demand_mw_pred: number;
  water_demand_kl_day_pred: number;
  capacity_mw_pred: number;
  confidence_score: number;
  prediction_horizon_months: number;
  model_name: string;
  timestamp: string;
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

  // Get predictions for all three time horizons (6, 9, 12 months)
  async getMultiMonthPredictions(
    input: Omit<MLPredictionInput, "months_ahead">
  ): Promise<MLPredictionsOutput> {
    const [month6, month9, month12] = await Promise.all([
      mlService.predictRequirements({ ...input, months_ahead: 6 }),
      mlService.predictRequirements({ ...input, months_ahead: 9 }),
      mlService.predictRequirements({ ...input, months_ahead: 12 }),
    ]);
    return { month_6: month6, month_9: month9, month_12: month12 };
  },
};
