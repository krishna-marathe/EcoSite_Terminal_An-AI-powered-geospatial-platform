import { apiClient } from './api';
import type { ResourceOutlookResponse } from '../types/resourceOutlook';

export async function getFacilityResourceOutlook(
  facilityId: string,
  signal?: AbortSignal
): Promise<ResourceOutlookResponse> {
  const response = await apiClient.get<ResourceOutlookResponse>(
    `/resource-outlook/facility/${encodeURIComponent(facilityId)}`,
    { signal }
  );
  return response.data;
}

export async function getRegionalForecastSummary(
  signal?: AbortSignal
): Promise<Record<string, unknown>> {
  const response = await apiClient.get<Record<string, unknown>>(
    '/resource-outlook/regional-summary',
    { signal }
  );
  return response.data;
}

export async function getCurrentOperationalForecast(
  horizonWeeks: number = 26,
  signal?: AbortSignal
): Promise<Record<string, unknown>> {
  const response = await apiClient.get<Record<string, unknown>>(
    `/resource-outlook/current-forecast?horizon_weeks=${horizonWeeks}`,
    { signal }
  );
  return response.data;
}

