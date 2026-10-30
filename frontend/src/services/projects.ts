import axios from 'axios';
import { apiClient, expectArray } from './api';

export interface PolygonGeometry { type: 'Polygon'; coordinates: [number, number][][] }
export interface Project { id: string; name: string; organization_label: string; archetype: string; stage: string; status: 'active' | 'archived'; revision: number }
export interface CandidateSite { id: string; project_id: string; name: string; geometry: PolygonGeometry; area_ha: number; state_code: string; district: string | null; geometry_hash: string; boundary_source: string; boundary_sha256: string; boundary_screening?: { status?: string; version?: string; licence?: string; screening_only?: boolean }; status: 'active' | 'archived'; revision: number; created_at: string; updated_at: string }
export type SiteInput = Pick<CandidateSite, 'name' | 'geometry' | 'state_code' | 'district'>;
export interface ProjectPage { items: Project[]; total: number }

export const getProjects = async (signal?: AbortSignal): Promise<ProjectPage> => {
  const { data } = await apiClient.get<unknown>('/projects', { signal, params: { page_size: 100 } });
  if (
    !data ||
    typeof data !== 'object' ||
    !Array.isArray((data as { items?: unknown }).items) ||
    typeof (data as { total?: unknown }).total !== 'number'
  ) {
    throw new Error('Project list returned an unexpected response. Check that the Eco Terminal backend is running.');
  }
  return data as ProjectPage;
};
export const createProject = async (body: { name: string; organization_label: string; archetype: string }) => (await apiClient.post<Project>('/projects', body)).data;
export const getSites = async (projectId: string, signal?: AbortSignal) =>
  expectArray<CandidateSite>(
    (await apiClient.get<unknown>('/projects/' + projectId + '/sites', { signal })).data,
    'Candidate sites'
  );
export const saveSite = async (projectId: string, body: SiteInput, existing?: CandidateSite) => existing
  ? (await apiClient.patch<CandidateSite>('/sites/' + existing.id, { ...body, expected_revision: existing.revision })).data
  : (await apiClient.post<CandidateSite>('/projects/' + projectId + '/sites', body)).data;
export const archiveSite = async (site: CandidateSite) => (await apiClient.delete<CandidateSite>('/sites/' + site.id, { params: { expected_revision: site.revision } })).data;
export function projectError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (detail && typeof detail.message === 'string') return detail.message;
    if (error.response?.status === 422) return 'Invalid candidate fields or geometry. Check the coordinates and try again.';
    if (!error.response) return 'Local backend unavailable. Your draft has not been saved.';
  }
  return error instanceof Error ? error.message : 'Candidate could not be saved.';
}
export function parsePolygon(value: unknown): PolygonGeometry {
  if (value && typeof value === 'object' && 'crs' in value) throw new Error('Use WGS84 GeoJSON without a CRS override.');
  const geometry = value && typeof value === 'object' && 'type' in value && value.type === 'Feature' && 'geometry' in value ? value.geometry : value;
  if (!geometry || typeof geometry !== 'object' || !('type' in geometry) || geometry.type !== 'Polygon' || !('coordinates' in geometry) || !Array.isArray(geometry.coordinates)) throw new Error('Import one GeoJSON Polygon geometry or Feature.');
  if (Object.keys(geometry).some(key => !['type', 'coordinates'].includes(key))) throw new Error('Polygon must use WGS84 coordinates without a CRS override.');
  const rings = geometry.coordinates;
  if (!rings.length || rings.length > 11 || rings.reduce((count, ring) => count + (Array.isArray(ring) ? ring.length : 0), 0) > 2000) throw new Error('Polygon exceeds ring/vertex limits or is empty.');
  for (const ring of rings) {
    if (!Array.isArray(ring) || ring.length < 4 || JSON.stringify(ring[0]) !== JSON.stringify(ring.at(-1))) throw new Error('Every ring must be explicitly closed with at least four positions.');
    for (const point of ring) if (!Array.isArray(point) || point.length !== 2 || !point.every(n => typeof n === 'number' && Number.isFinite(n)) || Math.abs(point[0]) > 180 || Math.abs(point[1]) > 90) throw new Error('Use finite WGS84 longitude/latitude pairs.');
  }
  return { type: 'Polygon', coordinates: rings as [number, number][][] };
}
