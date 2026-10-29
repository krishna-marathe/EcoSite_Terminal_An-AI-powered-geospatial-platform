import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { IndustryBenchmarksSection } from './IndustryBenchmarksSection';
import * as benchmarkService from '../../services/benchmarks';

const mockBenchmarks: benchmarkService.IndustryBenchmarkList = {
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
      boundary_notes: 'Measured operating PUE across core data centers.',
      is_portfolio_average: true,
      document_title: 'Bharti Airtel Integrated Report 2023-24',
      source_url: 'https://example.com/nxtra.pdf',
      page_or_reference: 'page 164',
      quality_notes: 'Measured fleet operating PUE.',
    },
    {
      id: 'bmk-ctrls-wue-2024',
      operator: 'CtrlS',
      reporting_year: 2024,
      metric: 'wue_liters_per_kwh',
      value: null,
      unit: 'L/kWh',
      status: 'UNAVAILABLE',
      reporting_scope: 'India Facilities',
      boundary_notes: 'WUE audit not publicly published.',
      is_portfolio_average: true,
      document_title: 'CtrlS Environmental Policy 2024',
      source_url: 'https://example.com/ctrls.pdf',
      page_or_reference: 'Water Stewardship',
      quality_notes: 'Marked UNAVAILABLE: EcoSite refuses to fabricate values.',
    },
    {
      id: 'bmk-msft-re-2023',
      operator: 'Microsoft',
      reporting_year: 2023,
      metric: 'company_wide_renewable_matching_percent',
      value: 100.0,
      unit: '%',
      status: 'PUBLISHED',
      reporting_scope: 'Global Corporate Operations',
      boundary_notes: '100% of global electricity matched on an annual basis.',
      is_portfolio_average: true,
      document_title: 'Microsoft 2024 Sustainability Report',
      source_url: 'https://example.com/msft.pdf',
      page_or_reference: 'page 34',
      quality_notes: 'Company-wide matching benchmark.',
    },
  ],
  total: 3,
  by_operator: { 'Nxtra by Airtel': 1, CtrlS: 1, Microsoft: 1 },
  by_metric: {
    measured_operating_pue: 1,
    wue_liters_per_kwh: 1,
    company_wide_renewable_matching_percent: 1,
  },
};

function renderComponent() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <IndustryBenchmarksSection />
    </QueryClientProvider>
  );
}

describe('IndustryBenchmarksSection', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders benchmark table with epistemic disclaimer and operator disclosures', async () => {
    vi.spyOn(benchmarkService, 'getBenchmarks').mockResolvedValue(mockBenchmarks);

    renderComponent();

    // Disclaimer
    expect(
      screen.getByText(/Contextual Reference Only — Not Proof of Site Headroom/i)
    ).toBeInTheDocument();

    // Operators and values
    expect(await screen.findByText('1.56')).toBeInTheDocument();
    expect(screen.getAllByText('CtrlS').length).toBeGreaterThan(0);
    expect(screen.getByText('UNAVAILABLE')).toBeInTheDocument();
    expect(screen.getAllByText('Microsoft').length).toBeGreaterThan(0);
    expect(screen.getByText('100.0%')).toBeInTheDocument();

    // Badges distinguishing categories
    expect(screen.getAllByText('PORTFOLIO FLEET AVERAGE').length).toBeGreaterThan(0);
    expect(screen.getByText('COMPANY-WIDE MATCHING')).toBeInTheDocument();
  });

  it('allows filtering by operator and metric', async () => {
    const getSpy = vi.spyOn(benchmarkService, 'getBenchmarks').mockResolvedValue(mockBenchmarks);

    renderComponent();

    await screen.findByText('1.56');

    const opSelect = screen.getByLabelText(/Filter by operator/i);
    fireEvent.change(opSelect, { target: { value: 'Nxtra' } });

    expect(getSpy).toHaveBeenCalledWith(
      expect.objectContaining({ operator: 'Nxtra' }),
      expect.anything()
    );
  });
});
