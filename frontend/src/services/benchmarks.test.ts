import { describe, it, expect, vi, afterEach } from 'vitest';
import { getBenchmarks, metricDisplayLabel, formatBenchmarkValue, type IndustryBenchmark } from './benchmarks';
import { apiClient } from './api';

describe('benchmarks service', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches benchmarks with params and returns structured list', async () => {
    const mockResponse = {
      items: [
        {
          id: 'bmk-nxtra-pue-2024',
          operator: 'Nxtra by Airtel',
          reporting_year: 2024,
          metric: 'measured_operating_pue',
          value: 1.56,
          unit: 'ratio',
          status: 'PUBLISHED',
          reporting_scope: 'Portfolio India',
          boundary_notes: 'Fleet-wide weighted average',
          is_portfolio_average: true,
          document_title: 'Airtel Integrated Report 2023-24',
          source_url: 'https://example.com/airtel.pdf',
          page_or_reference: 'page 164',
          quality_notes: 'Measured fleet operating PUE',
        },
      ],
      total: 1,
      by_operator: { 'Nxtra by Airtel': 1 },
      by_metric: { measured_operating_pue: 1 },
    };

    const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValue({ data: mockResponse });

    const result = await getBenchmarks({ operator: 'Nxtra' });
    expect(getSpy).toHaveBeenCalledWith('/benchmarks', {
      params: { operator: 'Nxtra' },
      signal: undefined,
    });
    expect(result.total).toBe(1);
    expect(result.items[0].operator).toBe('Nxtra by Airtel');
  });

  it('correctly labels and formats benchmark values', () => {
    expect(metricDisplayLabel('measured_operating_pue')).toBe('Measured Operating PUE');
    expect(metricDisplayLabel('design_pue')).toBe('Engineered Design PUE');
    expect(metricDisplayLabel('company_wide_renewable_matching_percent')).toBe('Company-Wide RE Matching (%)');

    const samplePublished: IndustryBenchmark = {
      id: '1',
      operator: 'Google',
      reporting_year: 2023,
      metric: 'measured_operating_pue',
      value: 1.1,
      unit: 'ratio',
      status: 'PUBLISHED',
      reporting_scope: 'Global fleet',
      boundary_notes: 'Comprehensive annual fleet PUE',
      is_portfolio_average: true,
      document_title: 'Google Env Report',
      source_url: null,
      page_or_reference: null,
      quality_notes: null,
    };
    expect(formatBenchmarkValue(samplePublished)).toBe('1.10');

    const sampleUnavailable: IndustryBenchmark = {
      ...samplePublished,
      status: 'UNAVAILABLE',
      value: null,
      unit: 'L/kWh',
    };
    expect(formatBenchmarkValue(sampleUnavailable)).toBe('UNAVAILABLE');

    const samplePercent: IndustryBenchmark = {
      ...samplePublished,
      value: 42.0,
      unit: '%',
    };
    expect(formatBenchmarkValue(samplePercent)).toBe('42.0%');
  });
});

