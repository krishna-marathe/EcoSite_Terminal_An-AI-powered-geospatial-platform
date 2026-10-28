import { cloneElement, type ReactElement } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Forecast } from './Forecast';
import { FORECAST_METRICS, getForecast } from '../services/forecasts';
import { apiClient } from '../services/api';
import { useDashboardStore } from '../stores/dashboardStore';
import type { ForecastMetric } from '../types';

// Supply layout dimensions in jsdom; keep the real Recharts chart and series.
vi.mock('recharts', async importOriginal => ({
  ...await importOriginal<typeof import('recharts')>(),
  ResponsiveContainer: ({ children }: { children: ReactElement<{ width: number; height: number }> }) => cloneElement(children, { width: 600, height: 300 }),
}));
beforeEach(() => { useDashboardStore.setState(useDashboardStore.getInitialState(), true); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it('selects every canonical metric and horizon and renders the three chart series', async () => {
  const { container } = render(<Forecast />);
  const options = Array.from((screen.getByLabelText('Metric') as HTMLSelectElement).options);
  expect(options.map(option => option.value)).toEqual(Object.keys(FORECAST_METRICS));
  for (const [metric, config] of Object.entries(FORECAST_METRICS)) {
    fireEvent.change(screen.getByLabelText('Metric'), { target: { value: metric } });
    for (const horizon of [6, 12, 24]) {
      fireEvent.change(screen.getByLabelText('Horizon'), { target: { value: String(horizon) } });
      const expected = await getForecast({ location_id: 'pune', metric: metric as ForecastMetric, horizon_months: horizon });
      await waitFor(() => expect(screen.getByText(expected.forecast.at(-1)!.prediction.toLocaleString())).toBeTruthy());
      await waitFor(() => expect(container.querySelectorAll('.recharts-line')).toHaveLength(3));
      expect(screen.getByText('Synthetic projection · ' + config.label)).toBeTruthy();
    }
  }
  expect(screen.getByText(/Pilot forecasts are synthetic demonstrations/)).toBeTruthy();
  expect(screen.getByText(/No predictive model has been validated/)).toBeTruthy();
}, 30000);

it('shows API validation errors without rendering a fabricated chart', async () => {
  useDashboardStore.getState().setDataMode('api');
  vi.spyOn(apiClient, 'post').mockRejectedValue(Object.assign(new Error('Request failed with status code 422'), { response: { status: 422 } }));
  const { container } = render(<Forecast />);
  await screen.findByText('Forecast unavailable: Request failed with status code 422');
  expect(container.querySelectorAll('.recharts-line')).toHaveLength(0);
});

it('ignores a late response after the metric selection changes', async () => {
  const old = await getForecast({ location_id: 'pune', metric: 'electricity_demand', horizon_months: 12 });
  const current = await getForecast({ location_id: 'pune', metric: 'temperature_heat', horizon_months: 12 });
  let finishOld!: (value: { data: typeof old }) => void;
  vi.spyOn(apiClient, 'post').mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve; })).mockResolvedValue({ data: current });
  useDashboardStore.getState().setDataMode('api');
  render(<Forecast />);
  fireEvent.change(screen.getByLabelText('Metric'), { target: { value: 'temperature_heat' } });
  await screen.findByText(current.forecast.at(-1)!.prediction.toLocaleString());
  await act(async () => { finishOld({ data: old }); });
  expect(screen.queryByText(old.forecast.at(-1)!.prediction.toLocaleString())).toBeNull();
  expect(screen.getByText(current.forecast.at(-1)!.prediction.toLocaleString())).toBeTruthy();
});
