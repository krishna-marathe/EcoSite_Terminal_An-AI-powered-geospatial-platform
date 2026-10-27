import axios from 'axios';
import { apiClient } from './api';

/** Observation statuses accepted by the backend data plane. */
export type ObservationStatus =
  | 'AVAILABLE'
  | 'PARTIAL'
  | 'STALE'
  | 'SOURCE_UNAVAILABLE'
  | 'NOT_APPLICABLE'
  | 'UNKNOWN';

export type EvidenceClass =
  | 'MEASURED'
  | 'AUTHORITY_VERIFIED'
  | 'DECLARED'
  | 'DOCUMENTED'
  | 'OFFICIAL_GEOSPATIAL'
  | 'REMOTE_SENSING_DERIVED'
  | 'MODELLED'
  | 'CROWD_SOURCED'
  | 'SYNTHETIC_DEMO'
  | 'UNAVAILABLE';

export interface Observation {
  id: string;
  source_id: string;
  site_id: string | null;
  geometry_hash: string | null;
  indicator: string;
  /** `null` means the source could not produce a value. It is never a zero. */
  value: number | null;
  unit: string;
  status: ObservationStatus;
  evidence_class: EvidenceClass;
  dataset_version: string;
  period_start: string | null;
  period_end: string | null;
  observed_at: string | null;
  published_at: string | null;
  retrieved_at: string;
  resolution: string;
  method: string;
  processing_version: string;
  /** `null` for metadata-only observations; never imply pixel coverage. */
  coverage_fraction: number | null;
  quality_flags: Record<string, unknown>;
  missing_reason: string | null;
  raw_snapshot_id: string | null;
}

export interface ObservationPage {
  items: Observation[];
  total: number;
}

export type RunStatus = 'success' | 'partial' | 'failed';

export interface IngestionResult {
  source_id: string;
  run_id: string;
  status: RunStatus;
  error: string | null;
  observation_count: number;
}

export interface AnalysisResponse {
  site_id: string;
  geometry_hash: string;
  results: IngestionResult[];
  observations: Observation[];
}

export interface AnalysisRequest {
  sources: string[];
  buffer_m?: number;
  max_tiles?: number;
  max_pages?: number;
}

/** Connectors that exist in the backend. Registry-only sources are not runnable. */
export const IMPLEMENTED_SOURCES = [
  {
    id: 'jrc_gsw',
    label: 'JRC Global Surface Water',
    note: 'Historical water occurrence and proximity, 30 m.',
    requiresToken: false,
  },
  {
    id: 'copernicus_stac',
    label: 'Copernicus Sentinel-2 STAC',
    note: 'Scene availability and cloud cover. Scene metadata only; no NDVI yet.',
    requiresToken: false,
  },
  {
    id: 'nasa_srtmgl1',
    label: 'NASA SRTMGL1',
    note: 'Terrain, slope and void screening. Requires an Earthdata token on the backend.',
    requiresToken: true,
  },
] as const;

export async function getSiteObservations(siteId: string, signal?: AbortSignal): Promise<ObservationPage> {
  const { data } = await apiClient.get<unknown>(`/sites/${siteId}/observations`, { signal });
  if (
    !data ||
    typeof data !== 'object' ||
    !Array.isArray((data as { items?: unknown }).items) ||
    typeof (data as { total?: unknown }).total !== 'number'
  ) {
    throw new Error('Observations returned an unexpected response. Check that the EcoSite backend is running.');
  }
  return data as ObservationPage;
}

/**
 * Run the local connectors for one candidate polygon.
 *
 * A 502 still carries per-source results, so the response body is returned instead
 * of collapsing every source failure into one generic error. Long timeouts are
 * deliberate: a JRC tile download can take minutes.
 */
export async function runEnvironmentalAnalysis(
  siteId: string,
  body: AnalysisRequest
): Promise<AnalysisResponse> {
  try {
    const { data } = await apiClient.post<AnalysisResponse>(
      `/sites/${siteId}/environmental-analysis`,
      body,
      { timeout: 600_000 }
    );
    return data;
  } catch (error) {
    if (
      axios.isAxiosError(error) &&
      error.response?.data &&
      typeof error.response.data === 'object' &&
      Array.isArray((error.response.data as AnalysisResponse).results)
    ) {
      return error.response.data as AnalysisResponse;
    }
    throw error;
  }
}

export function observationError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (detail && typeof detail.message === 'string') return detail.message;
    if (!error.response) return 'Local backend unavailable. No observation was fetched or stored.';
  }
  return error instanceof Error ? error.message : 'Environmental analysis failed.';
}

export const INDICATOR_LABELS: Record<string, string> = {
  historical_water_occurrence_overlap_fraction: 'Water occurrence overlap',
  historical_water_occurrence_mean_percent: 'Mean water occurrence',
  historical_water_occurrence_max_percent: 'Maximum water occurrence',
  historical_water_valid_pixel_fraction: 'Valid pixel coverage',
  nearest_mapped_water_distance_m: 'Nearest mapped water',
  terrain_elevation_mean_m: 'Mean elevation',
  terrain_elevation_min_m: 'Minimum elevation',
  terrain_elevation_max_m: 'Maximum elevation',
  terrain_relief_m: 'Terrain relief',
  terrain_void_pixel_fraction: 'Void pixel fraction',
  sentinel2_scene_count: 'Sentinel-2 scenes matched',
  sentinel2_usable_scene_count: 'Usable scenes',
  sentinel2_usable_scene_fraction: 'Usable scene fraction',
  sentinel2_cloud_cover_median_percent: 'Median cloud cover',
  sentinel2_cloud_cover_min_percent: 'Minimum cloud cover',
  sentinel2_latest_scene_age_days: 'Latest scene age',
  sentinel2_scene_date_span_days: 'Scene date span',
};

export function indicatorLabel(indicator: string): string {
  return INDICATOR_LABELS[indicator] ?? indicator.replace(/_/g, ' ');
}

export function sourceLabel(sourceId: string): string {
  return IMPLEMENTED_SOURCES.find((source) => source.id === sourceId)?.label ?? sourceId;
}
