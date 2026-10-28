import { apiClient } from './api';
import type { PublicFacility, PublicFacilityPage, PublicFacilitySummary, PublicFacilityType, PublicStateCode } from '../types/publicFacilities';

export interface PublicFacilityFilters {
  state?: PublicStateCode;
  operator?: string;
  facilityType?: PublicFacilityType;
  q?: string;
  freshness?: 'current';
  page?: number;
  pageSize?: number;
}

function validFacility(value: unknown): value is PublicFacility {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<PublicFacility>;
  return Boolean(
    record.id &&
      record.name &&
      record.operator &&
      record.stateCode &&
      Array.isArray(record.publicCoordinates) &&
      record.publicCoordinates.length === 2 &&
      Array.isArray(record.capacityDisclosures) &&
      record.verification?.source?.url &&
      record.verification.expiresAt
  );
}

export async function getPublicFacilities(filters: PublicFacilityFilters = {}): Promise<PublicFacilityPage> {
  const params: Record<string, string | number> = {};
  if (filters.state) params.state = filters.state;
  if (filters.operator) params.operator = filters.operator;
  if (filters.facilityType) params.facilityType = filters.facilityType;
  if (filters.q) params.q = filters.q;
  if (filters.freshness) params.freshness = filters.freshness;
  if (filters.page) params.page = filters.page;
  if (filters.pageSize) params.pageSize = filters.pageSize;
  const response = await apiClient.get<unknown>('/public-facilities', { params });
  const page = response.data as Partial<PublicFacilityPage> | null;
  if (!page || !Array.isArray(page.items) || !page.items.every(validFacility) || typeof page.total !== 'number' ||
      typeof page.page !== 'number' || typeof page.pageSize !== 'number' || typeof page.registryVersion !== 'string' ||
      typeof page.asOf !== 'string') throw new Error('The public facility registry returned an invalid page.');
  return page as PublicFacilityPage;
}

export async function getPublicFacility(facilityId: string): Promise<PublicFacility> {
  const response = await apiClient.get<unknown>(`/public-facilities/${encodeURIComponent(facilityId)}`);
  if (!validFacility(response.data)) throw new Error('The public facility detail returned an invalid record.');
  return response.data;
}

export async function getPublicFacilitySummary(): Promise<PublicFacilitySummary> {
  const response = await apiClient.get<PublicFacilitySummary>('/public-facilities/summary');
  const value = response.data;
  if (!value || typeof value.operationalFacilityCount !== 'number' || typeof value.operatorCount !== 'number' || !value.byState) {
    throw new Error('The public facility summary returned an invalid response.');
  }
  return value;
}
