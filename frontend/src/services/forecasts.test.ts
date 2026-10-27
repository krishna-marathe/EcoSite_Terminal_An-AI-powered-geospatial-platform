import { afterEach, expect, it, vi } from 'vitest';
import { FORECAST_METRICS, getForecast, type ForecastRequest } from './forecasts';
import { apiClient } from './api';
import type { ForecastMetric } from '../types';

const contract = [
  ['electricity_demand', 'MW', 800, 12],
  ['air_quality', 'µg/m³', 40, 0.3],
  ['groundwater_depletion', 'm below ground', 12, 0.1],
  ['temperature_heat', '°C', 30, 0.04],
  ['environmental_risk_index', 'index 0–100', 50, 0.2],
] as const;
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

it('offers exactly the canonical API metrics', () => {
  expect(Object.keys(FORECAST_METRICS).sort()).toEqual(contract.map(([metric]) => metric).sort());
});

it.each(contract)('%s preserves demo formulas, units, horizons and synthetic metadata', async (metric, unit, base, step) => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-12-15T12:00:00Z'));
  for (const city of ['pune', 'mumbai']) for (const horizon of [6, 12, 24]) {
    const result = await getForecast({ location_id: city, metric, horizon_months: horizon });
    expect(result).toMatchObject({ metric, unit, horizonMonths: horizon, dataStatus: 'synthetic', modelVersion: 'pilot-demo-v1' });
    expect(result.methodologyNotes).toContain('No predictive model has been validated');
    expect(result.forecast).toHaveLength(horizon);
    result.forecast.forEach((point, i) => {
      const prediction = Number((base * (city === 'mumbai' ? 1.1 : 1) + i * step).toFixed(2));
      expect(point).toEqual({ date: new Date(Date.UTC(2026, 11 + i, 1)).toISOString().slice(0, 10), prediction, lower_bound: Number((prediction * 0.9).toFixed(2)), upper_bound: Number((prediction * 1.1).toFixed(2)) });
    });
  }
});

it.each(contract)('%s sends the canonical API request and returns the API response unchanged', async metric => {
  const response = await getForecast({ location_id: 'pune', metric, horizon_months: 6 });
  const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: response });
  for (const horizon of [6, 12, 24]) {
    const request = { location_id: 'pune', metric, horizon_months: horizon };
    expect(await getForecast(request, 'api')).toBe(response);
    expect(post).toHaveBeenLastCalledWith('/forecasts', request);
  }
});

it('rejects unsupported metrics and horizons before issuing a request', async () => {
  const post = vi.spyOn(apiClient, 'post');
  for (const metric of ['groundwater', 'temperature', 'environmental_risk', 'unknown', 'toString', '__proto__']) {
    await expect(getForecast({ location_id: 'pune', metric: metric as ForecastMetric, horizon_months: 12 }, 'api')).rejects.toThrow('Forecast unavailable');
  }
  for (const horizon of [0, 61, 1.5]) {
    await expect(getForecast({ location_id: 'pune', metric: 'air_quality', horizon_months: horizon }, 'api')).rejects.toThrow('1–60');
  }
  expect(post).not.toHaveBeenCalled();
});

it.each([422, 500])('propagates HTTP %s failures without a synthetic success fallback', async status => {
  const failure = Object.assign(new Error('API failed'), { response: { status } });
  vi.spyOn(apiClient, 'post').mockRejectedValue(failure);
  const request: ForecastRequest = { location_id: 'pune', metric: 'groundwater_depletion', horizon_months: 12 };
  await expect(getForecast(request, 'api')).rejects.toBe(failure);
});
