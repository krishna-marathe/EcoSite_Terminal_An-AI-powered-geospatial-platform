import type { DataMode } from '../types';
import { GROUNDWATER_ZONES_GEOJSON, AIR_QUALITY_ZONES_GEOJSON, HEAT_ANOMALY_ZONES_GEOJSON, FLOOD_HAZARD_ZONES_GEOJSON, PROTECTED_AREAS_GEOJSON, TRANSMISSION_GRID_GEOJSON } from '../data/demo/environmentalOverlays';

export type EnvironmentalDataState = 'DEMO_SYNTHETIC' | 'API_UNAVAILABLE' | 'API_SYNTHETIC' | 'SOURCE_BACKED';
export const DEMO_OVERLAYS = [
  { key: 'env-groundwater-stress', source: 'src-gw-stress', prefix: 'layer-gw-stress', count: GROUNDWATER_ZONES_GEOJSON.features.length, opacity: 0.45 },
  { key: 'env-air-quality', source: 'src-air-quality', prefix: 'layer-air-quality', count: AIR_QUALITY_ZONES_GEOJSON.features.length, opacity: 0.4 },
  { key: 'env-surface-temp', source: 'src-heat-anomaly', prefix: 'layer-heat-anomaly', count: HEAT_ANOMALY_ZONES_GEOJSON.features.length, opacity: 0.4 },
  { key: 'env-flood-susceptibility', source: 'src-flood-hazard', prefix: 'layer-flood-hazard', count: FLOOD_HAZARD_ZONES_GEOJSON.features.length, opacity: 0.45 },
  { key: 'env-protected-areas', source: 'src-protected-areas', prefix: 'layer-protected-areas', count: PROTECTED_AREAS_GEOJSON.features.length, opacity: 0.4 },
  { key: 'layer-transmission-lines', source: 'src-transmission-grid', prefix: 'layer-transmission-grid', count: TRANSMISSION_GRID_GEOJSON.features.length, opacity: 0.85 },
];
export const overlayLayerIds = (overlay: typeof DEMO_OVERLAYS[number]) => overlay.key === 'layer-transmission-lines' ? [overlay.prefix + '-line'] : [overlay.prefix + '-fill', overlay.prefix + '-line'];
export const environmentalMessage = (mode: DataMode) => mode === 'demo'
  ? 'Environmental overlays are synthetic demonstration data and are not validated site observations.'
  : 'Source-backed environmental observations are currently unavailable. Synthetic demonstration overlays are hidden.';
export const environmentalState = (mode: DataMode): EnvironmentalDataState => mode === 'demo' ? 'DEMO_SYNTHETIC' : 'API_UNAVAILABLE';
export const layerAvailable = (id: string, category: string, mode: DataMode) => DEMO_OVERLAYS.some(layer => layer.key === id) ? mode === 'demo' : category === 'infrastructure';
// Classification is not permission to render: a connector must also validate geometry and coverage.
export function classifyApiEnvironmentalLayer(layer: { isAvailable?: boolean; dataStatus?: string; sourceOrganization?: string; sourceUrl?: string; publicationDate?: string; geographicResolution?: string }): EnvironmentalDataState {
  if (!layer.isAvailable || layer.dataStatus === 'unavailable') return 'API_UNAVAILABLE';
  if (layer.dataStatus === 'synthetic') return 'API_SYNTHETIC';
  if (['observed', 'estimated'].includes(layer.dataStatus ?? '') && layer.sourceOrganization?.trim() && /^https?:[/][/]/.test(layer.sourceUrl ?? '') && Number.isFinite(Date.parse(layer.publicationDate ?? '')) && layer.geographicResolution?.trim()) return 'SOURCE_BACKED';
  return 'API_UNAVAILABLE';
}
