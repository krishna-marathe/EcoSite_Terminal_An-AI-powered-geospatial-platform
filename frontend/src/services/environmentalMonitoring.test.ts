import { afterEach, expect, it, vi } from 'vitest';
import { apiClient } from './api';
import { getEnvironmentalStateSummary, getFacilityEnvironmentalCurrent, getFacilityEnvironmentalRange } from './environmentalMonitoring';

vi.mock('./api', async (importOriginal) => ({ ...(await importOriginal<typeof import('./api')>()), apiClient: { get: vi.fn() } }));
afterEach(() => vi.clearAllMocks());

it('requests current metrics as one stable comma-separated query', async () => {
  vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { facilityId: 'facility-1', generatedAt: '2026-10-29T00:00:00Z', metrics: [] } });
  await getFacilityEnvironmentalCurrent('facility-1', ['aqi', 'temperature']);
  expect(apiClient.get).toHaveBeenCalledWith('/public-facilities/facility-1/environmental/current', { params: { metrics: 'aqi,temperature' } });
});

it('sends range and interval without changing metric keys', async () => {
  vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { facilityId: 'facility-1', range: '7d', interval: 'hour', from: '', to: '', generatedAt: '', series: [] } });
  await getFacilityEnvironmentalRange('facility-1', { metrics: ['pm25', 'relative_humidity'], range: '7d', interval: 'hour' });
  expect(apiClient.get).toHaveBeenCalledWith('/public-facilities/facility-1/environmental', { params: { metrics: 'pm25,relative_humidity', range: '7d', interval: 'hour' } });
});

it('requests state environmental summaries', async () => {
  vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { stateCode: 'IN-MH', range: '24h', generatedAt: '', facilityCount: 8, coveredFacilityCount: 0, metrics: [], sourceHealth: [] } });
  await getEnvironmentalStateSummary({ state: 'IN-MH', metrics: ['aqi'] });
  expect(apiClient.get).toHaveBeenCalledWith('/environmental/summary', { params: { state: 'IN-MH', range: '24h', metrics: 'aqi' } });
});
