import type { Facility } from '../types';
import type { ScenarioType } from '../types';

export const scenarioAdjustedScore = (facility: Facility, scenario: { type: ScenarioType; severity: number } | null) => {
  if (!scenario) return facility.overallRiskScore;
  const indicator = scenario.type === 'water_reduction' ? facility.indicators.waterStress
    : scenario.type === 'heatwave' ? facility.indicators.heatExposure
      : scenario.type === 'grid_curtailment' ? facility.indicators.gridPressure
        : facility.indicators.floodHazard;
  return Math.min(100, Math.round(facility.overallRiskScore + (indicator / 100) * scenario.severity * 0.35));
};

export const hotspotScore = (facility: Facility, scenario: { type: ScenarioType; severity: number } | null) => {
  const adjusted = scenarioAdjustedScore(facility, scenario);
  const convergence = Math.max(...Object.values(facility.indicators));
  return Math.min(100, Math.round(adjusted * 0.75 + convergence * 0.25));
};
