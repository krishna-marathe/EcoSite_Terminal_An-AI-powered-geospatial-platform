import type { PublicStateCode } from './publicFacilities';

export type EnvironmentalMetricKey =
  | 'aqi' | 'pm25' | 'pm10' | 'no2' | 'so2' | 'co' | 'o3'
  | 'temperature' | 'relative_humidity' | 'rainfall' | 'wind_speed'
  | 'wind_direction' | 'groundwater_depth' | 'groundwater_assessment';
export type EnvironmentalRange = '24h' | '7d' | '30d' | '90d' | '1y';
export type EnvironmentalInterval = 'auto' | 'raw' | 'hour' | 'day';
export type ResolvedEnvironmentalInterval = Exclude<EnvironmentalInterval, 'auto'>;
export type MetricAvailability = 'AVAILABLE' | 'PARTIAL' | 'STALE' | 'SOURCE_UNAVAILABLE' | 'NOT_COVERED' | 'UNKNOWN';
export type ObservationQuality = 'preliminary' | 'validated' | 'unknown';
export type EvidenceClass = 'measured' | 'authority_verified' | 'operator_declared' | 'documented_public' | 'derived' | 'modelled' | 'unavailable';
export type TemporalClass = 'stable' | 'periodic' | 'near_real_time' | 'live_private' | 'derived';

export interface StationContext {
  stationId: string;
  name: string;
  provider: string;
  sourceId: string;
  publicCoordinates: [number, number];
  stationType: string;
  distanceKm: number;
  selectionMethod: 'nearest_eligible' | 'same_district' | 'manual_authority_mapping';
  effectiveAt: string;
}

export interface EnvironmentalProvenance {
  sourceId: string;
  provider: string;
  dataset: string;
  sourceUrl: string;
  retrievedAt: string;
  evidenceClass: EvidenceClass;
  temporalClass: TemporalClass;
  visibility: 'public';
}

export interface CurrentEnvironmentalMetric {
  metric: EnvironmentalMetricKey;
  displayName: string;
  value: number | string | null;
  unit: string;
  originalValue: number | string | null;
  originalUnit: string | null;
  availability: MetricAvailability;
  quality: ObservationQuality;
  observedAt: string | null;
  publishedAt: string | null;
  retrievedAt: string | null;
  freshUntil: string | null;
  qualityFlags: string[];
  station: StationContext | null;
  provenance: EnvironmentalProvenance | null;
  contextNotice: string;
}

export interface EnvironmentalCurrentResponse {
  facilityId: string;
  generatedAt: string;
  metrics: CurrentEnvironmentalMetric[];
}

export interface EnvironmentalPoint {
  timestamp: string;
  value: number | string | null;
  originalValue: number | string | null;
  originalUnit: string | null;
  minimum: number | null;
  maximum: number | null;
  sampleCount: number;
  coverageFraction: number;
  qualityFlags: string[];
}

export interface EnvironmentalSeries {
  metric: EnvironmentalMetricKey;
  displayName: string;
  unit: string;
  availability: MetricAvailability;
  quality: ObservationQuality;
  coverageFraction: number;
  expectedSampleCount: number;
  validSampleCount: number;
  station: StationContext | null;
  provenance: EnvironmentalProvenance | null;
  points: EnvironmentalPoint[];
  contextNotice: string;
}

export interface EnvironmentalRangeResponse {
  facilityId: string;
  range: EnvironmentalRange;
  interval: ResolvedEnvironmentalInterval;
  from: string;
  to: string;
  generatedAt: string;
  series: EnvironmentalSeries[];
}

export interface EnvironmentalSummaryMetric {
  metric: EnvironmentalMetricKey;
  displayName: string;
  unit: string;
  availability: MetricAvailability;
  coveredFacilityCount: number;
  currentFacilityCount: number;
  staleFacilityCount: number;
  unavailableFacilityCount: number;
  minimum: number | null;
  maximum: number | null;
  mean: number | null;
  aggregationMethod: string;
  contextNotice: string;
}

export interface EnvironmentalSourceHealth {
  sourceId: string;
  status: 'NOT_CONNECTED' | 'CONNECTED' | 'STALE' | 'SOURCE_UNAVAILABLE';
  lastCheckedAt: string | null;
  lastSuccessAt: string | null;
}

export interface EnvironmentalStateSummaryResponse {
  stateCode: PublicStateCode;
  range: EnvironmentalRange;
  generatedAt: string;
  facilityCount: number;
  coveredFacilityCount: number;
  metrics: EnvironmentalSummaryMetric[];
  sourceHealth: EnvironmentalSourceHealth[];
}
