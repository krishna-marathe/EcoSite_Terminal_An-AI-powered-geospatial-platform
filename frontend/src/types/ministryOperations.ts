import type { EnvironmentalMetricKey } from './environmentalMonitoring';
import type { PublicStateCode } from './publicFacilities';

export interface FacilityFreshness {
  facilityId: string;
  facilityName: string;
  stateCode: PublicStateCode;
  metric: EnvironmentalMetricKey | 'all';
  status: string;
  observedAt: string | null;
  ageSeconds: number | null;
  sourceId: string | null;
  reason: string | null;
}

export interface MinistrySourceHealth {
  sourceId: string;
  provider: string;
  status: string;
  lastCheckedAt: string | null;
  lastSuccessAt: string | null;
  staleFacilityCount: number;
  failedRunCount: number;
}

export interface MinistryStateSummary {
  stateCode: PublicStateCode;
  facilityCount: number;
  currentFacilityCount: number;
  staleFacilityCount: number;
  unavailableFacilityCount: number;
}

export interface MinistryOverview {
  generatedAt: string;
  facilityCount: number;
  states: MinistryStateSummary[];
  sourceHealth: MinistrySourceHealth[];
  freshnessQueue: FacilityFreshness[];
}

export interface MinistryFreshnessQueue { generatedAt: string; items: FacilityFreshness[]; total: number }
export interface MinistryFacilitySummary { generatedAt: string; facilityId: string; facilityName: string; stateCode: PublicStateCode; metrics: FacilityFreshness[] }
