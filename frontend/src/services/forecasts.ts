import { getPilotCity } from '../data/pilotCities';
import type { CityId, DataMode, ForecastMetric, ForecastResponse } from '../types';
import { apiClient } from './api';
export interface ForecastRequest { location_id: string; metric: ForecastMetric; horizon_months: number }
export const FORECAST_METRICS: Record<ForecastMetric, { label: string; unit: string; base: number; step: number }> = {
  electricity_demand: { label: 'Electricity demand', unit: 'MW', base: 800, step: 12 },
  air_quality: { label: 'Ambient PM2.5', unit: 'µg/m³', base: 40, step: 0.3 },
  groundwater_depletion: { label: 'Groundwater depth', unit: 'm below ground', base: 12, step: 0.1 },
  temperature_heat: { label: 'Temperature', unit: '°C', base: 30, step: 0.04 },
  environmental_risk_index: { label: 'Environmental stress', unit: 'index 0–100', base: 50, step: 0.2 },
};
export const getForecast = async (req: ForecastRequest, mode: DataMode = 'demo'): Promise<ForecastResponse> => {
  if (!['pune', 'mumbai'].includes(req.location_id) || !Object.hasOwn(FORECAST_METRICS, req.metric)) throw new Error('Forecast unavailable for this city or metric.');
  if (!Number.isInteger(req.horizon_months) || req.horizon_months < 1 || req.horizon_months > 60) throw new Error('Forecast horizon must be 1–60 months.');
  if (mode === 'api') return (await apiClient.post<ForecastResponse>('/forecasts', req)).data;
  const metric = FORECAST_METRICS[req.metric];
  const now = new Date();
  const forecast = Array.from({ length: req.horizon_months }, (_, i) => {
    const prediction = Number((metric.base * (req.location_id === 'mumbai' ? 1.1 : 1) + i * metric.step).toFixed(2));
    return { date: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + i, 1)).toISOString().slice(0, 10), prediction, lower_bound: Number((prediction * 0.9).toFixed(2)), upper_bound: Number((prediction * 1.1).toFixed(2)) };
  });
  return { metric: req.metric, locationId: req.location_id, locationName: getPilotCity(req.location_id as CityId).name, unit: metric.unit, model: 'Illustrative linear baseline', modelVersion: 'pilot-demo-v1', horizonMonths: req.horizon_months, dataStatus: 'synthetic', forecast, methodologyNotes: 'Synthetic demonstration only. The ±10% envelope is illustrative, not a calibrated confidence interval. No predictive model has been validated.' };
};
