import type { EnvironmentalCurrentResponse, EnvironmentalRangeResponse } from '../../types/environmentalMonitoring';
import type { PublicFacility } from '../../types/publicFacilities';

export const publicFacilityFixture: PublicFacility = {
  id: 'facility-mumbai-1',
  name: 'Mumbai Public Data Centre',
  operator: 'Example Operator',
  ownershipCategory: 'private',
  facilityType: 'colocation',
  stateCode: 'IN-MH',
  state: 'Maharashtra',
  city: 'Mumbai',
  locality: 'Powai',
  publicCoordinates: [72.905, 19.119],
  locationPrecision: 'locality',
  operationalSince: 2020,
  capacityDisclosures: [
    { value: 12, unit: 'MW', capacityType: 'it_load', scope: 'Operating IT load' },
    { value: 20, unit: 'MVA', capacityType: 'total_power', scope: 'Campus electrical supply' },
  ],
  verification: {
    status: 'public_operator_confirmed',
    verifiedAt: '2026-10-01',
    expiresAt: '2026-12-30',
    source: {
      title: 'Operator facility page',
      publisher: 'Example Operator',
      url: 'https://example.com/facility',
      sourceClass: 'operator',
      retrievedAt: '2026-10-01',
    },
  },
};

const station = {
  stationId: 'station-1',
  name: 'Powai monitoring station',
  provider: 'Central Pollution Control Board',
  sourceId: 'cpcb_caaqms',
  publicCoordinates: [72.91, 19.12] as [number, number],
  stationType: 'urban_background',
  distanceKm: 2.4,
  selectionMethod: 'nearest_eligible' as const,
  effectiveAt: '2026-10-01T00:00:00Z',
};

export const currentFixture: EnvironmentalCurrentResponse = {
  facilityId: publicFacilityFixture.id,
  generatedAt: '2026-10-29T09:00:00Z',
  metrics: [
    {
      metric: 'pm25', displayName: 'PM2.5', value: 41.2, unit: 'ug/m3', originalValue: 41.2, originalUnit: 'ug/m3',
      availability: 'AVAILABLE', quality: 'preliminary', observedAt: '2026-10-29T08:00:00Z', publishedAt: '2026-10-29T08:30:00Z', retrievedAt: '2026-10-29T08:35:00Z', freshUntil: '2026-10-29T10:00:00Z', qualityFlags: [], station, provenance: null,
      contextNotice: 'Nearby public monitoring-station context; not an on-site facility measurement.',
    },
    {
      metric: 'groundwater_depth', displayName: 'Groundwater depth', value: null, unit: 'm_bgl', originalValue: null, originalUnit: null,
      availability: 'NOT_COVERED', quality: 'unknown', observedAt: null, publishedAt: null, retrievedAt: null, freshUntil: null, qualityFlags: ['no_eligible_station'], station: null, provenance: null,
      contextNotice: 'No suitable public groundwater station is linked to this facility.',
    },
  ],
};

export const rangeFixture: EnvironmentalRangeResponse = {
  facilityId: publicFacilityFixture.id,
  range: '24h', interval: 'hour', from: '2026-10-28T09:00:00Z', to: '2026-10-29T09:00:00Z', generatedAt: '2026-10-29T09:00:00Z',
  series: [{
    metric: 'pm25', displayName: 'PM2.5', unit: 'ug/m3', availability: 'PARTIAL', quality: 'preliminary', coverageFraction: 0.5,
    expectedSampleCount: 2, validSampleCount: 1, station, provenance: null,
    contextNotice: 'Nearby public monitoring-station context; not an on-site facility measurement.',
    points: [
      { timestamp: '2026-10-29T07:00:00Z', value: 40, originalValue: 40, originalUnit: 'ug/m3', minimum: 39, maximum: 41, sampleCount: 4, coverageFraction: 1, qualityFlags: [] },
      { timestamp: '2026-10-29T08:00:00Z', value: null, originalValue: null, originalUnit: null, minimum: null, maximum: null, sampleCount: 0, coverageFraction: 0, qualityFlags: ['missing_interval'] },
    ],
  }],
};

