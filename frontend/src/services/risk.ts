import type { Facility, InfrastructureType, RiskIndicatorScore, RiskLevel } from '../types';
import { apiClient } from './api';
import type { RiskParameter, RiskScoreResponse } from '../types/risk';

export interface SectorWeights {
  waterStress: number;
  gridPressure: number;
  airPollution: number;
  heatExposure: number;
  floodHazard: number;
  populationProximity: number;
  landSensitivity: number;
  biodiversityConstraint: number;
}

import pilot from '../../../shared/pilot.json';
export const DEFAULT_SECTOR_WEIGHTS = pilot.sectorWeights as Record<InfrastructureType, SectorWeights>;

export const getRiskLevel = (score: number): RiskLevel => {
  if (score >= 80) return 'critical';
  if (score >= 65) return 'high';
  if (score >= 45) return 'moderate';
  return 'low';
};

export const calculateWeightedRiskScore = (
  indicators: Facility['indicators'],
  weights: SectorWeights
): number => {
  const sumWeights = Object.values(weights).reduce((a, b) => a + b, 0);
  const normalizedWeights: Record<keyof SectorWeights, number> = {} as Record<keyof SectorWeights, number>;

  for (const k of Object.keys(weights) as (keyof SectorWeights)[]) {
    normalizedWeights[k] = sumWeights > 0 ? weights[k] / sumWeights : 1 / 8;
  }

  const score =
    indicators.waterStress * normalizedWeights.waterStress +
    indicators.gridPressure * normalizedWeights.gridPressure +
    indicators.airPollution * normalizedWeights.airPollution +
    indicators.heatExposure * normalizedWeights.heatExposure +
    indicators.floodHazard * normalizedWeights.floodHazard +
    indicators.populationProximity * normalizedWeights.populationProximity +
    indicators.landSensitivity * normalizedWeights.landSensitivity +
    indicators.biodiversityConstraint * normalizedWeights.biodiversityConstraint;

  return Math.round(score);
};

export const getExplainableIndicators = (
  facility: Facility,
  customWeights?: SectorWeights
): RiskIndicatorScore[] => {
  const weights = customWeights || DEFAULT_SECTOR_WEIGHTS[facility.type] || DEFAULT_SECTOR_WEIGHTS.data_centre;

  const names: Record<keyof SectorWeights, [string, RiskIndicatorScore['category']]> = {
    waterStress: ['Water stress', 'water'], gridPressure: ['Grid pressure', 'energy'], airPollution: ['Air pollution', 'air'], heatExposure: ['Heat exposure', 'heat'], floodHazard: ['Flood hazard', 'flood'], populationProximity: ['Population proximity', 'population'], landSensitivity: ['Land sensitivity', 'land'], biodiversityConstraint: ['Biodiversity constraint', 'biodiversity'],
  };
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  return (Object.keys(names) as (keyof SectorWeights)[]).map(key => ({
    name: names[key][0], key, category: names[key][1], score: facility.indicators[key], weight: total > 0 ? weights[key] / total : 1 / 8,
    status: getRiskLevel(facility.indicators[key]), valueDescription: `Normalized screening index: ${facility.indicators[key]}/100`,
    provenance: facility.provenance, explanation: 'Normalized facility-level screening input; higher values indicate greater pressure. This is not a physical measurement or statutory determination.',
    mitigationPrompt: 'Verify underlying observations and site conditions before selecting an engineering intervention.',
  }));
};

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
 * Environmental risk score for one facility.
 *
 * The backend scores only parameters a provider actually returned; unavailable
 * parameters carry a reason instead of a zero, so the UI must show them too.
 */
export async function getFacilityRiskScore(facilityId: string, signal?: AbortSignal): Promise<RiskScoreResponse> {
  const response = await apiClient.get<unknown>(
    `/public-facilities/${encodeURIComponent(facilityId)}/risk-score`,
    { signal, timeout: 45_000 }
  );
  if (!validResponse(response.data)) {
    throw new Error('The risk score returned an unexpected response.');
  }
  return response.data;
}

