import { apiClient } from './api';

export interface IndustryBenchmark {
  id: string;
  operator: string;
  reporting_year: number;
  metric: string;
  value: number | null;
  unit: string;
  status: 'PUBLISHED' | 'UNAVAILABLE' | 'ESTIMATED' | string;
  reporting_scope: string;
  boundary_notes: string;
  is_portfolio_average: boolean;
  document_title: string;
  source_url: string | null;
  page_or_reference: string | null;
  quality_notes: string | null;
}

export interface IndustryBenchmarkList {
  items: IndustryBenchmark[];
  total: number;
  by_operator: Record<string, number>;
  by_metric: Record<string, number>;
}

export interface BenchmarkFilterParams {
  operator?: string;
  metric?: string;
  reporting_year?: number;
  status?: string;
}

export async function getBenchmarks(
  params?: BenchmarkFilterParams,
  signal?: AbortSignal
): Promise<IndustryBenchmarkList> {
  const { data } = await apiClient.get<IndustryBenchmarkList>('/benchmarks', {
    params,
    signal,
  });
  return data;
}

export const METRIC_LABELS: Record<string, string> = {
  measured_operating_pue: 'Measured Operating PUE',
  design_pue: 'Engineered Design PUE',
  datacenter_renewable_share_percent: 'Data Center Renewable Share (%)',
  company_wide_renewable_matching_percent: 'Company-Wide RE Matching (%)',
  wue_liters_per_kwh: 'Water Usage Effectiveness (WUE)',
};

export function metricDisplayLabel(metric: string): string {
  return METRIC_LABELS[metric] ?? metric.replace(/_/g, ' ');
}

export function formatBenchmarkValue(benchmark: IndustryBenchmark): string {
  if (benchmark.status === 'UNAVAILABLE' || benchmark.value === null) {
    return 'UNAVAILABLE';
  }
  if (benchmark.unit === 'ratio') {
    return benchmark.value.toFixed(2);
  }
  if (benchmark.unit === '%') {
    return `${benchmark.value.toFixed(1)}%`;
  }
  if (benchmark.unit === 'L/kWh') {
    return `${benchmark.value.toFixed(2)} L/kWh`;
  }
  return `${benchmark.value} ${benchmark.unit}`;
}

