import { DEMO_FACILITIES } from '../data/demo/facilities';
import type { Facility, InfrastructureType, RiskLevel } from '../types';
import { apiClient } from './api';

export interface FacilityFilters {
  search?: string;
  type?: InfrastructureType | 'all';
  riskLevel?: RiskLevel | 'all';
  state?: string;
}

export const getFacilities = async (filters?: FacilityFilters): Promise<Facility[]> => {
  try {
    const params = new URLSearchParams();
    if (filters?.type && filters.type !== 'all') params.append('type', filters.type);
    if (filters?.riskLevel && filters.riskLevel !== 'all') params.append('risk', filters.riskLevel);
    if (filters?.state) params.append('state', filters.state);
    if (filters?.search) params.append('q', filters.search);

    const response = await apiClient.get<Facility[]>('/facilities', { params });
    return response.data;
  } catch {
    // Demo adapter fallback
    let results = [...DEMO_FACILITIES];

    if (filters?.search) {
      const q = filters.search.toLowerCase().trim();
      results = results.filter(
        (f) =>
          f.name.toLowerCase().includes(q) ||
          f.state.toLowerCase().includes(q) ||
          f.district.toLowerCase().includes(q) ||
          f.operator?.toLowerCase().includes(q)
      );
    }

    if (filters?.type && filters.type !== 'all') {
      results = results.filter((f) => f.type === filters.type);
    }

    if (filters?.riskLevel && filters.riskLevel !== 'all') {
      results = results.filter((f) => f.riskLevel === filters.riskLevel);
    }

    if (filters?.state) {
      results = results.filter((f) => f.state.toLowerCase() === filters.state?.toLowerCase());
    }

    return results;
  }
};

export const getFacilityById = async (id: string): Promise<Facility | null> => {
  try {
    const response = await apiClient.get<Facility>(`/facilities/${id}`);
    return response.data;
  } catch {
    const found = DEMO_FACILITIES.find((f) => f.id === id);
    return found || null;
  }
};
