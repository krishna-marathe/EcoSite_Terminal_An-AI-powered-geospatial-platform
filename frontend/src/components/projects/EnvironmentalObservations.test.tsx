import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { EnvironmentalObservations } from './EnvironmentalObservations';
import * as service from '../../services/observations';
import type { Observation } from '../../services/observations';
import type { CandidateSite } from '../../services/projects';

vi.mock('../../services/observations', async () => ({
  ...(await vi.importActual('../../services/observations')),
  getSiteObservations: vi.fn(),
  runEnvironmentalAnalysis: vi.fn(),
}));

const site = {
  id: 's1',
  project_id: 'p1',
  name: 'Pune candidate',
  geometry: { type: 'Polygon' as const, coordinates: [[[73.84, 18.51], [73.86, 18.51], [73.86, 18.53], [73.84, 18.51]]] as [number, number][][] },
  area_ha: 58,
  state_code: 'IN-MH',
  district: 'Pune',
  geometry_hash: 'abcdef1234567890',
  boundary_source: 'Test boundary',
  boundary_sha256: 'test',
  status: 'active' as const,
  revision: 1,
  created_at: '2026-10-27T00:00:00Z',
  updated_at: '2026-10-27T00:00:00Z',
} satisfies CandidateSite;

const missing: Observation = {
  id: 'o1',
  source_id: 'jrc_gsw',
  site_id: 's1',
  geometry_hash: 'h',
  indicator: 'historical_water_occurrence_overlap_fraction',
  value: null,
  unit: 'fraction',
  status: 'SOURCE_UNAVAILABLE',
  evidence_class: 'REMOTE_SENSING_DERIVED',
  dataset_version: 'GSW v1.5 (1984-2024)',
  period_start: '1984-01-01',
  period_end: '2024-12-31',
  observed_at: null,
  published_at: null,
  retrieved_at: '2026-10-27T00:00:00Z',
  resolution: '30 m (Landsat-derived)',
  method: 'zonal_occurrence_statistics',
  processing_version: '1.0.0',
  coverage_fraction: null,
  quality_flags: { threshold_percent: 1 },
  missing_reason: 'No valid pixels in the polygon.',
  raw_snapshot_id: null,
};

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <EnvironmentalObservations site={site} />
    </QueryClientProvider>
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it('renders a missing value as Unavailable with its reason and never as zero', async () => {
  vi.mocked(service.getSiteObservations).mockResolvedValue({ items: [missing], total: 1 });
  mount();

  const unavailable = await screen.findByText('Unavailable');
  expect(unavailable.getAttribute('title')).toBe('No valid pixels in the polygon.');
  expect(screen.getByText('SOURCE_UNAVAILABLE')).toBeTruthy();
  expect(screen.getByText('1 records')).toBeTruthy();
  expect(screen.getByText(/not a sustainability score/i)).toBeTruthy();
});

it('runs the selected sources and reports a failed source without inventing observations', async () => {
  vi.mocked(service.getSiteObservations).mockResolvedValue({ items: [], total: 0 });
  vi.mocked(service.runEnvironmentalAnalysis).mockResolvedValue({
    site_id: 's1',
    geometry_hash: 'h',
    results: [
      {
        source_id: 'jrc_gsw',
        run_id: 'r1',
        status: 'failed',
        error: 'tile unavailable',
        observation_count: 0,
      },
    ],
    observations: [],
  });
  mount();

  await screen.findByText('No stored observations for this candidate.');
  expect((screen.getByRole('checkbox', { name: /NASA SRTMGL1/ }) as HTMLInputElement).checked).toBe(false);

  fireEvent.click(screen.getByRole('button', { name: 'Run local analysis' }));

  expect(await screen.findByText('tile unavailable')).toBeTruthy();
  expect(service.runEnvironmentalAnalysis).toHaveBeenCalledWith('s1', {
    sources: ['jrc_gsw', 'copernicus_stac'],
    buffer_m: 1000,
  });
  expect(screen.getByText('0 records')).toBeTruthy();
});
