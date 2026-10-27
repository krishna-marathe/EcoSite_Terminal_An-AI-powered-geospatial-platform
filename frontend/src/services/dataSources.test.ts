import { afterEach, expect, it, vi } from 'vitest';
import { apiClient } from './api';
import {
  fetchDataSources,
  fetchDataSourceDetail,
  fetchOfficialDocuments,
  getOfficialDocumentDownloadUrl,
  fetchStateRegulatoryPacks,
  fetchEnvironmentalDatasets,
} from './dataSources';

vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./api')>()),
  apiClient: { get: vi.fn() },
}));

afterEach(() => vi.clearAllMocks());

it('fetches data sources list and detail with parameters', async () => {
  const mockList = {
    items: [{ id: 'jrc_gsw', priority: 'P0' }],
    total: 1,
    by_priority: { P0: 1 },
    by_test_status: { PROCESSING_TESTED: 1 },
  };
  vi.mocked(apiClient.get).mockResolvedValueOnce({ data: mockList });

  const result = await fetchDataSources({ priority: 'P0' });
  expect(apiClient.get).toHaveBeenCalledWith('/data-sources', { params: { priority: 'P0' } });
  expect(result.total).toBe(1);

  const mockDetail = { id: 'jrc_gsw', dataset_name: 'Global Surface Water', recent_runs: [] };
  vi.mocked(apiClient.get).mockResolvedValueOnce({ data: mockDetail });

  const detail = await fetchDataSourceDetail('jrc_gsw');
  expect(apiClient.get).toHaveBeenCalledWith('/data-sources/jrc_gsw');
  expect(detail.dataset_name).toBe('Global Surface Water');
});

it('fetches official documents with filters and generates download urls', async () => {
  const mockDocs = {
    total: 2,
    focus_states: ['Telangana', 'Maharashtra', 'Karnataka', 'Tamil Nadu'],
    national_framework: 'NITI Aayog Framework',
    documents: [
      { id: 'niti_aayog_framework_2026', title: 'Data Centre Evaluation Framework' },
      { id: 'telangana_dc_policy', title: 'Telangana Data Centres Policy' },
    ],
  };
  vi.mocked(apiClient.get).mockResolvedValueOnce({ data: mockDocs });

  const docs = await fetchOfficialDocuments({ state: 'Telangana' });
  expect(apiClient.get).toHaveBeenCalledWith('/data-sources/documents', { params: { state: 'Telangana' } });
  expect(docs.total).toBe(2);

  const downloadUrl = getOfficialDocumentDownloadUrl('niti_aayog_framework_2026');
  expect(downloadUrl).toContain('/data-sources/documents/niti_aayog_framework_2026/download');
});

it('fetches state regulatory packs and environmental datasets', async () => {
  const mockPacks = {
    version: '2026-10-27',
    focus_states: ['Telangana', 'Maharashtra', 'Karnataka', 'Tamil Nadu'],
    packs: { telangana: { state_name: 'Telangana' } },
  };
  vi.mocked(apiClient.get).mockResolvedValueOnce({ data: mockPacks });

  const packs = await fetchStateRegulatoryPacks();
  expect(apiClient.get).toHaveBeenCalledWith('/data-sources/state-packs');
  expect(packs.focus_states).toHaveLength(4);

  const mockEnv = {
    version: '2026-10-27',
    focus_states: ['Telangana', 'Maharashtra', 'Karnataka', 'Tamil Nadu'],
    carbon_factors_cea: { national_grid_factors: { weighted_average_tco2_per_mwh: 0.675 } },
  };
  vi.mocked(apiClient.get).mockResolvedValueOnce({ data: mockEnv });

  const env = await fetchEnvironmentalDatasets();
  expect(apiClient.get).toHaveBeenCalledWith('/data-sources/environmental');
  expect(env.carbon_factors_cea.national_grid_factors.weighted_average_tco2_per_mwh).toBe(0.675);
});
