import { getPilotCity, isInCity, SCORING_VERSION } from '../data/pilotCities';
import type { CityId, DataMode, Facility, ProposedSite, ScenarioType } from '../types';

export const buildPlanningDossier = (input: {
  cityId: CityId;
  dataMode: DataMode;
  facilities: Facility[];
  candidateSites: ProposedSite[];
  scenario: { type: ScenarioType; severity: number } | null;
  mitigationPlan?: unknown;
}) => ({
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  city: getPilotCity(input.cityId),
  dataMode: input.dataMode,
  scoringVersion: SCORING_VERSION,
  storage: 'Candidates and scenarios are saved in this browser only.',
  facilities: input.facilities.filter((facility) => facility.cityId === input.cityId && isInCity(facility.coordinates, input.cityId)),
  candidateSites: input.candidateSites.filter((site) => site.cityId === input.cityId && isInCity(site.coordinates, input.cityId)),
  scenario: input.scenario,
  scenarioMethodology: 'Sensitivity analysis only: min(100, round(base score + selected indicator / 100 × severity × 0.35)); not an impact forecast.',
  mitigationPlan: input.mitigationPlan || null,
  limitations: [
    'Planning rectangles are illustrative extents, not official municipal boundaries.',
    'Synthetic records are demonstration data; scores are normalized screening indicators, not physical measurements.',
    'Unknown environmental measurements remain null. A favorable siting conclusion requires additional evidence.',
    'Facility-level summaries do not represent complete city-wide coverage. Population buffers may overlap.',
  ],
});
