import { DEMO_FORECASTS } from '../data/demo/forecasts';
import type { ForecastResponse } from '../types';
import { apiClient } from './api';

export interface ForecastRequest {
  location_id: string;
  metric: string;
  horizon_months: number;
}

export const getForecast = async (req: ForecastRequest): Promise<ForecastResponse> => {
  try {
    const response = await apiClient.post<ForecastResponse>('/forecasts', req);
    return response.data;
  } catch {
    // Demo fallback adapter
    const lookupKey = `${req.location_id}-${req.metric}`;
    if (DEMO_FORECASTS[lookupKey]) {
      const forecast = { ...DEMO_FORECASTS[lookupKey] };
      // Filter by horizon if needed
      forecast.horizonMonths = req.horizon_months;
      return forecast;
    }

    // Generic fallback if specific key not pre-seeded
    const baseKey = Object.keys(DEMO_FORECASTS)[0];
    const fallback = { ...DEMO_FORECASTS[baseKey] };
    fallback.metric = req.metric;
    fallback.locationId = req.location_id;
    fallback.horizonMonths = req.horizon_months;
    fallback.locationName = req.location_id.toUpperCase();
    return fallback;
  }
};
