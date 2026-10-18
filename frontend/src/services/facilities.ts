import { PILOT_FACILITIES, isInCity } from '../data/pilotCities';
import type { CityId, DataMode, Facility, InfrastructureType, RiskLevel } from '../types';
import { apiClient } from './api';

export interface FacilityFilters {
  cityId?: CityId;
  search?: string;
  type?: InfrastructureType | 'all';
  riskLevel?: RiskLevel | 'all';
  state?: string;
}

export const filterFacilities = (records: Facility[], filters?: FacilityFilters) => records.filter((f) => {
  if (filters?.cityId && (f.cityId !== filters.cityId || !isInCity(f.coordinates, filters.cityId))) return false;
  const query = filters?.search?.trim().toLowerCase();
  if (query && ![f.name, f.state, f.district, f.operator || ''].some((value) => value.toLowerCase().includes(query))) return false;
  if (filters?.type && filters.type !== 'all' && f.type !== filters.type) return false;
  if (filters?.riskLevel && filters.riskLevel !== 'all' && f.riskLevel !== filters.riskLevel) return false;
  return !filters?.state || f.state.toLowerCase() === filters.state.toLowerCase();
});

export const getFacilities = async (filters?: FacilityFilters, mode: DataMode = 'demo'): Promise<Facility[]> => {
  if (mode === 'demo') return filterFacilities(PILOT_FACILITIES, filters);
  const records: Facility[] = [];
  const pageSize = 100;
  for (let page = 1; ; page++) {
    const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
    if (filters?.cityId) params.set('city', filters.cityId);
    // Apply remaining filters after fetching for consistent operator search in both modes.
    const { data } = await apiClient.get<Facility[]>('/facilities', { params });
    if (!Array.isArray(data) || data.some((record) => !record?.id || !Array.isArray(record.coordinates) || !record.indicators || !record.provenance)) {
      throw new Error('The facility API returned an invalid response. Check the backend connection.');
    }
    records.push(...data);
    if (data.length < pageSize) break;
    if (page >= 1000) throw new Error('Facility result limit reached. Narrow the planning area before loading this dataset.');
  }
  return filterFacilities(records, filters);
};

export const getFacilityById = async (id: string, mode: DataMode = 'demo'): Promise<Facility | null> => {
  if (mode === 'demo') return PILOT_FACILITIES.find((facility) => facility.id === id) || null;
  const { data } = await apiClient.get<Facility>(`/facilities/${encodeURIComponent(id)}`);
  return data;
};
