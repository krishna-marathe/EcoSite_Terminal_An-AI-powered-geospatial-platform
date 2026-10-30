import { afterEach, expect, it, vi } from 'vitest';
import { apiClient } from './api';
import { DEMO_MINISTRY_HEADERS } from './demoIdentity';
import { getMinistryFacilitySummary, getMinistryOverview, getMinistryStateSummary } from './ministryOperations';

vi.mock('./api', async (importOriginal) => ({ ...(await importOriginal<typeof import('./api')>()), apiClient: { get: vi.fn() } }));
afterEach(() => vi.clearAllMocks());

it('uses the fixed ministry demo identity and queue limit', async () => {
  vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { generatedAt: '', facilityCount: 19, states: [], sourceHealth: [], freshnessQueue: [] } });
  expect((await getMinistryOverview(25)).facilityCount).toBe(19);
  expect(apiClient.get).toHaveBeenCalledWith('/ministry/operations/overview', { headers: DEMO_MINISTRY_HEADERS, params: { queueLimit: 25 } });
});

it('encodes ministry state and facility drill-down paths', async () => {
  vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { stateCode: 'IN-TN', facilityCount: 4, currentFacilityCount: 0, staleFacilityCount: 0, unavailableFacilityCount: 4 } });
  await getMinistryStateSummary('IN-TN');
  vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { generatedAt: '', facilityId: 'a b', facilityName: '', stateCode: 'IN-TN', metrics: [] } });
  await getMinistryFacilitySummary('a b');
  expect(apiClient.get).toHaveBeenLastCalledWith('/ministry/operations/facilities/a%20b', { headers: DEMO_MINISTRY_HEADERS });
});
