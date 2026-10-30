import { apiClient } from './api';
import { DEMO_MINISTRY_HEADERS } from './demoIdentity';
import type {
  MinistryFacilitySummary,
  MinistryFreshnessQueue,
  MinistryOverview,
  MinistrySourceHealth,
  MinistryStateSummary,
} from '../types/ministryOperations';
import type { PublicStateCode } from '../types/publicFacilities';

const ministryConfig = { headers: DEMO_MINISTRY_HEADERS };

export const getMinistryOverview = async (queueLimit = 100): Promise<MinistryOverview> =>
  (await apiClient.get<MinistryOverview>('/ministry/operations/overview', { ...ministryConfig, params: { queueLimit } })).data;

export const getMinistrySourceHealth = async (): Promise<MinistrySourceHealth[]> =>
  (await apiClient.get<MinistrySourceHealth[]>('/ministry/operations/source-health', ministryConfig)).data;

export const getMinistryFreshness = async (limit = 100): Promise<MinistryFreshnessQueue> =>
  (await apiClient.get<MinistryFreshnessQueue>('/ministry/operations/freshness', { ...ministryConfig, params: { limit } })).data;

export const getMinistryStateSummary = async (stateCode: PublicStateCode): Promise<MinistryStateSummary> =>
  (await apiClient.get<MinistryStateSummary>(`/ministry/operations/states/${encodeURIComponent(stateCode)}`, ministryConfig)).data;

export const getMinistryFacilitySummary = async (facilityId: string): Promise<MinistryFacilitySummary> =>
  (await apiClient.get<MinistryFacilitySummary>(`/ministry/operations/facilities/${encodeURIComponent(facilityId)}`, ministryConfig)).data;
