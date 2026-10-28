import { apiClient } from './api';
import type {
  EnvironmentalCurrentResponse,
  EnvironmentalInterval,
  EnvironmentalMetricKey,
  EnvironmentalRange,
  EnvironmentalRangeResponse,
  EnvironmentalStateSummaryResponse,
} from '../types/environmentalMonitoring';
import type { PublicStateCode } from '../types/publicFacilities';

const metricParam = (metrics?: EnvironmentalMetricKey[]) => metrics?.join(',');

export async function getFacilityEnvironmentalCurrent(
  facilityId: string,
  metrics?: EnvironmentalMetricKey[],
): Promise<EnvironmentalCurrentResponse> {
  const { data } = await apiClient.get<EnvironmentalCurrentResponse>(
    `/public-facilities/${encodeURIComponent(facilityId)}/environmental/current`,
    { params: metrics?.length ? { metrics: metricParam(metrics) } : undefined },
  );
  return data;
}

export async function getFacilityEnvironmentalRange(
  facilityId: string,
  options: { metrics: EnvironmentalMetricKey[]; range: EnvironmentalRange; interval?: EnvironmentalInterval },
): Promise<EnvironmentalRangeResponse> {
  const { data } = await apiClient.get<EnvironmentalRangeResponse>(
    `/public-facilities/${encodeURIComponent(facilityId)}/environmental`,
    { params: { metrics: metricParam(options.metrics), range: options.range, interval: options.interval ?? 'auto' } },
  );
  return data;
}

export async function getEnvironmentalStateSummary(options: {
  state: PublicStateCode;
  range?: EnvironmentalRange;
  metrics?: EnvironmentalMetricKey[];
}): Promise<EnvironmentalStateSummaryResponse> {
  const params: Record<string, string> = { state: options.state, range: options.range ?? '24h' };
  if (options.metrics?.length) params.metrics = metricParam(options.metrics) as string;
  return (await apiClient.get<EnvironmentalStateSummaryResponse>('/environmental/summary', { params })).data;
}
