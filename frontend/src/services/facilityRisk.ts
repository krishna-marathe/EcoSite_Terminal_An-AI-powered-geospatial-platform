import { apiClient } from './api';
import type { RiskParameter, RiskScoreResponse } from '../types/risk';

function validParameter(value: unknown): value is RiskParameter {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<RiskParameter>;
  return Boolean(
    record.key &&
      record.label &&
      typeof record.weight === 'number' &&
      (record.status === 'AVAILABLE' || record.status === 'UNAVAILABLE') &&
      (record.status !== 'UNAVAILABLE' || record.reason)
  );
}

function validResponse(value: unknown): value is RiskScoreResponse {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<RiskScoreResponse>;
  return Boolean(
    record.facilityId &&
      Array.isArray(record.parameters) &&
      record.parameters.every(validParameter) &&
      typeof record.coverage === 'number' &&
      typeof record.scoreVersion === 'string' &&
      typeof record.generatedAt === 'string' &&
      Array.isArray(record.notes)
  );
}

/**
 * Environmental risk score (0-100) for one public facility.
 *
 * The backend scores only parameters a provider actually returned; unavailable
 * parameters carry a reason instead of a zero, so the UI must show them too.
 */
export async function getFacilityRiskScore(
  facilityId: string,
  signal?: AbortSignal
): Promise<RiskScoreResponse> {
  const response = await apiClient.get<unknown>(
    `/public-facilities/${encodeURIComponent(facilityId)}/risk-score`,
    { signal, timeout: 45_000 }
  );
  if (!validResponse(response.data)) {
    throw new Error('The risk score returned an unexpected response.');
  }
  return response.data;
}
