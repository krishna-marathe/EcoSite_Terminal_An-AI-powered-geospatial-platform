import { afterEach, expect, it, vi } from 'vitest';
import { apiClient } from './api';
import {
  getSiteObservations,
  indicatorLabel,
  observationError,
  runEnvironmentalAnalysis,
  sourceLabel,
} from './observations';

vi.mock('./api', async importOriginal => ({
  ...(await importOriginal<typeof import('./api')>()),
  apiClient: { get: vi.fn(), post: vi.fn() },
}));

afterEach(() => vi.clearAllMocks());

const observation = {
  id: 'o1',
  source_id: 'jrc_gsw',
  site_id: 's1',
  geometry_hash: 'h',
  indicator: 'historical_water_occurrence_overlap_fraction',
  value: null,
  unit: 'fraction',
  status: 'SOURCE_UNAVAILABLE' as const,
  evidence_class: 'REMOTE_SENSING_DERIVED' as const,
  dataset_version: 'GSW v1.5',
  period_start: null,
  period_end: null,
  observed_at: null,
  published_at: null,
  retrieved_at: '2026-10-27T00:00:00Z',
  resolution: '30 m',
  method: 'zonal_occurrence_statistics',
  processing_version: '1.0.0',
  coverage_fraction: null,
  quality_flags: {},
  missing_reason: 'No valid pixels in the polygon.',
  raw_snapshot_id: null,
};

it('reads stored observations with cancellation', async () => {
  vi.mocked(apiClient.get).mockResolvedValue({ data: { items: [observation], total: 1 } });
  const signal = new AbortController().signal;
  await expect(getSiteObservations('s1', signal)).resolves.toMatchObject({ total: 1 });
  expect(apiClient.get).toHaveBeenCalledWith('/sites/s1/observations', { signal });
});

it('rejects non-list observation payloads instead of letting the table crash', async () => {
  vi.mocked(apiClient.get).mockResolvedValue({ data: '<!doctype html><html></html>' } as never);
  await expect(getSiteObservations('s1')).rejects.toThrow(/unexpected response/i);
});

it('posts the analysis body with a long timeout and returns an all-failed 502 body', async () => {
  const body = { sources: ['jrc_gsw'], buffer_m: 1000 };
  vi.mocked(apiClient.post).mockResolvedValue({
    data: { site_id: 's1', geometry_hash: 'h', results: [], observations: [] },
  });
  await runEnvironmentalAnalysis('s1', body);
  expect(apiClient.post).toHaveBeenCalledWith('/sites/s1/environmental-analysis', body, { timeout: 600_000 });

  const failure = {
    isAxiosError: true,
    response: {
      status: 502,
      data: {
        site_id: 's1',
        geometry_hash: 'h',
        results: [
          { source_id: 'jrc_gsw', run_id: 'r1', status: 'failed', error: 'tile unavailable', observation_count: 0 },
        ],
        observations: [],
      },
    },
  };
  vi.mocked(apiClient.post).mockRejectedValue(failure);
  await expect(runEnvironmentalAnalysis('s1', body)).resolves.toMatchObject({ results: [{ status: 'failed' }] });
});

it('surfaces backend detail messages and never hides an unknown indicator', () => {
  const error = {
    isAxiosError: true,
    response: { status: 409, data: { detail: { code: 'state_out_of_scope', message: 'Outside the four-state scope.' } } },
  };
  expect(observationError(error)).toBe('Outside the four-state scope.');
  expect(observationError(new Error('Network down'))).toBe('Network down');
  expect(indicatorLabel('terrain_relief_m')).toBe('Terrain relief');
  expect(indicatorLabel('unknown_indicator')).toBe('unknown indicator');
  expect(sourceLabel('jrc_gsw')).toBe('JRC Global Surface Water');
  expect(sourceLabel('cgwb_assessment')).toBe('cgwb_assessment');
});
