import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MLForecastAnalysis } from './MLForecastAnalysis';
import * as api from '../services/api';
import { mlService } from '../services/mlService';

vi.mock('../services/api', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
  expectArray: vi.fn((data) => data),
}));

vi.mock('../services/mlService', () => ({
  mlService: {
    getMultiMonthPredictions: vi.fn(),
  },
}));

const mockForecastPayload = {
  status: 'CURRENT_OPERATIONAL_FORECAST',
  electricity: {
    classification: 'CURRENT_OPERATIONAL_FORECAST',
    origin_date: '2026-10-27',
    horizon_weeks: 26,
    total_days: 182,
    points: [
      {
        date: '2026-10-28',
        lead_day: 1,
        predicted_peak_met_mw: 25430.0,
        p10_lower_bound_mw: 23472.4,
        p90_upper_bound_mw: 29156.9,
        day_of_week: 'Wednesday',
      },
      {
        date: '2027-04-27',
        lead_day: 182,
        predicted_peak_met_mw: 32161.0,
        p10_lower_bound_mw: 29224.4,
        p90_upper_bound_mw: 35887.9,
        day_of_week: 'Tuesday',
      },
    ],
  },
  reservoir: {
    reservoir: 'Bhatsa',
  },
  metadata: {
    generated_at: '2026-10-31T00:00:00Z',
    evaluation_mae_mw: 1749.68,
    evaluation_mape_pct: 6.76,
  },
  epistemic_disclaimer: 'Epistemic notice',
};

const mockFacilities = {
  total: 2,
  items: [
    {
      id: 'stt-pune-5',
      name: 'STT Pune 5',
      operator: 'STT GDC India',
      stateCode: 'IN-MH',
      state: 'Maharashtra',
      city: 'Pune',
      locality: 'Dighi',
      capacityDisclosures: [
        {
          value: 24.0,
          unit: 'MW',
          capacityType: 'power_capacity_unspecified',
          scope: 'campus',
        },
      ],
    },
    {
      id: 'iron-mountain-mum-1',
      name: 'Iron Mountain MUM-1',
      operator: 'Iron Mountain Data Centers',
      stateCode: 'IN-MH',
      state: 'Maharashtra',
      city: 'Navi Mumbai',
      locality: 'Rabale MIDC',
      capacityDisclosures: [
        {
          value: 12.0,
          unit: 'MW',
          capacityType: 'it_load',
          scope: 'campus',
        },
      ],
    },
  ],
};

const mockPredictionResponse = {
  power_demand_mw_pred: 32.4,
  water_demand_kl_day_pred: null,
  capacity_mw_pred: 24.0,
  confidence_score: null,
  prediction_horizon_months: 6,
  model_name: 'ML-F4.1',
  timestamp: '2026-10-31T00:00:00Z',
  classification: 'DETERMINISTIC_ENGINEERING_SCENARIO',
  provenance_note: 'Deterministic facility engineering scenario based on declared IT capacity and standard PUE benchmark (1.35).',
};

describe('MLForecastAnalysis Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.apiClient.get as any).mockImplementation((path: string) => {
      if (path.includes('/resource-outlook/current-forecast')) {
        return Promise.resolve({ data: mockForecastPayload });
      }
      if (path.includes('/public-facilities')) {
        return Promise.resolve({ data: mockFacilities });
      }
      return Promise.reject(new Error(`Unhandled path: ${path}`));
    });
    (mlService.getMultiMonthPredictions as any).mockResolvedValue(mockPredictionResponse);
  });

  it('renders all three core ML forecast sections and header', async () => {
    render(
      <MemoryRouter>
        <MLForecastAnalysis />
      </MemoryRouter>
    );

    expect(screen.getByText('ML Forecast & Resource Analysis')).toBeDefined();
    expect(screen.getByText(/182-day electricity demand forecasting/i)).toBeDefined();

    // Verify tabs
    expect(screen.getByRole('button', { name: /A\. Regional Electricity Forecast/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /B\. Facility Engineering Analysis/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /C\. Model Evaluation & Benchmarks/i })).toBeDefined();
  });

  it('renders Section A with 26-week forecast parameters and epistemic notice', async () => {
    render(
      <MemoryRouter>
        <MLForecastAnalysis />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('32,161.0 MW')).toBeDefined();
    });

    expect(screen.getByText('35,887.9 MW')).toBeDefined();
    expect(screen.getByText('182 Days')).toBeDefined();
    expect(screen.getByText(/Seasonal Naive with Multi-Year Residual Quantile Intervals/i)).toBeDefined();
    expect(screen.getByText(/Regional Demand Scope/i)).toBeDefined();
  });

  it('navigates to Section B, switches facility, and displays deterministic engineering sizing', async () => {
    render(
      <MemoryRouter>
        <MLForecastAnalysis />
      </MemoryRouter>
    );

    // Switch to Section B
    fireEvent.click(screen.getByRole('button', { name: /B\. Facility Engineering Analysis/i }));

    await waitFor(() => {
      expect(screen.getByText(/Facility Engineering Sizing & Analysis/i)).toBeDefined();
    });

    // Verify deterministic sizing output for STT Pune 5
    await waitFor(() => {
      expect(screen.getByText(/32.4 MW/i)).toBeDefined();
    });

    // Verify water demand is undisclosed, not fabricated
    expect(screen.getAllByText(/Not Disclosed/i).length).toBeGreaterThanOrEqual(1);

    // Verify capacity breakdown exists
    expect(screen.getByText(/Published Capacity vs Evaluated Scenarios/i)).toBeDefined();
    expect(screen.getByText(/STT Pune 5 Reconciliation Breakdown/i)).toBeDefined();
    expect(screen.getByText(/4.80 MW gap/i)).toBeDefined();
  });

  it('navigates to Section C and displays model benchmark comparisons with explicit deployment status', async () => {
    render(
      <MemoryRouter>
        <MLForecastAnalysis />
      </MemoryRouter>
    );

    // Switch to Section C
    fireEvent.click(screen.getByRole('button', { name: /C\. Model Evaluation & Benchmarks/i }));

    await waitFor(() => {
      expect(screen.getByText(/Rigorous 7-Window Chronological Backtest Comparison/i)).toBeDefined();
    });

    // Check table headers and rows
    expect(screen.getByText('Seasonal Naive with Calibrated Intervals')).toBeDefined();
    expect(screen.getByText('Trend-Adjusted Seasonal Baseline')).toBeDefined();
    expect(screen.getByText('LightGBM Grid Forecaster (v3)')).toBeDefined();

    // Verify MAE and MAPE metrics
    expect(screen.getByText('1,749.68 MW')).toBeDefined();
    expect(screen.getByText('6.76%')).toBeDefined();
    expect(screen.getByText('1,825.61 MW')).toBeDefined();

    // Verify deployment status badges
    expect(screen.getByText(/Selected Operational Model/i)).toBeDefined();
    expect(screen.getAllByText(/Evaluated Benchmark/i).length).toBeGreaterThanOrEqual(1);
  });
});
