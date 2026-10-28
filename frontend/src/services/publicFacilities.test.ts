import { afterEach, expect, it, vi } from 'vitest';
import { apiClient } from './api';
import { getPublicFacilities, getPublicFacility, getPublicFacilitySummary } from './publicFacilities';

vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./api')>()),
  apiClient: { get: vi.fn() },
}));

afterEach(() => vi.clearAllMocks());

const facility = {
  id: 'facility-1',
  name: 'Facility 1',
  operator: 'Operator',
  ownershipCategory: 'private',
  facilityType: 'colocation',
  stateCode: 'IN-MH',
  state: 'Maharashtra',
  city: 'Mumbai',
  locality: 'Mumbai',
  publicCoordinates: [72.8, 19.1],
  locationPrecision: 'locality',
  capacityDisclosures: [],
  verification: {
    status: 'public_operator_confirmed',
    verifiedAt: '2026-10-29',
    expiresAt: '2027-01-27',
    source: { title: 'Source', publisher: 'Operator', url: 'https://example.test', sourceClass: 'operator', retrievedAt: '2026-10-29' },
  },
};

it('loads public facilities with supported filters', async () => {
  vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { items: [facility], page: 1, pageSize: 25, total: 1, registryVersion: 'v1', asOf: '2026-10-29' } });
  const records = await getPublicFacilities({ state: 'IN-MH', facilityType: 'colocation', q: 'Mumbai', pageSize: 25 });
  expect(apiClient.get).toHaveBeenCalledWith('/public-facilities', { params: { state: 'IN-MH', facilityType: 'colocation', q: 'Mumbai', pageSize: 25 } });
  expect(records.items).toHaveLength(1);
});

it('rejects malformed public facility records', async () => {
  vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { items: [{ id: 'broken' }], page: 1, pageSize: 50, total: 1, registryVersion: 'v1', asOf: '2026-10-29' } });
  await expect(getPublicFacilities()).rejects.toThrow('invalid page');
});

it('loads one encoded public facility detail', async () => {
  vi.mocked(apiClient.get).mockResolvedValueOnce({ data: facility });
  expect((await getPublicFacility('facility-1')).id).toBe('facility-1');
  expect(apiClient.get).toHaveBeenCalledWith('/public-facilities/facility-1');
});

it('loads the operational-only summary', async () => {
  vi.mocked(apiClient.get).mockResolvedValueOnce({
    data: {
      registryVersion: 'v1',
      asOf: '2026-10-29',
      operationalFacilityCount: 19,
      operatorCount: 5,
      byState: { 'IN-MH': 8, 'IN-TG': 4, 'IN-KA': 3, 'IN-TN': 4 },
      capacityAggregation: 'disabled_mixed_measurement_boundaries',
    },
  });
  expect((await getPublicFacilitySummary()).operationalFacilityCount).toBe(19);
});
