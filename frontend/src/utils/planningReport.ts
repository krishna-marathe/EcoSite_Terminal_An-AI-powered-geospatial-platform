import { environmentalMessage, environmentalState } from './environmentalLayers';
import { inContext, validCandidateRecord, validPlan, validRecord, validScenario, type SavedRecord, type SavedPlan, type Scenario } from './savedContext';
import { getPilotCity, isInCity, SCORING_VERSION } from '../data/pilotCities';
import type { CityId, DataMode, Facility, ProposedSite } from '../types';

export const buildPlanningDossier = (input: {
  cityId: CityId;
  dataMode: DataMode;
  facilities: Facility[];
  candidateSites: SavedRecord<ProposedSite>[];
  scenario: SavedRecord<Scenario> | null;
  mitigationPlan?: SavedRecord<SavedPlan> | null;
}) => ({
  schemaVersion: 2,
  generatedAt: new Date().toISOString(),
  city: getPilotCity(input.cityId),
  dataMode: input.dataMode,
  scoringVersion: SCORING_VERSION,
  environmentalLayers: { state: environmentalState(input.dataMode), message: environmentalMessage(input.dataMode) },
  storage: 'Mode-scoped browser records only. Legacy unscoped records are preserved separately and excluded.',
  facilities: input.facilities.filter((facility) => facility.cityId === input.cityId && isInCity(facility.coordinates, input.cityId)),
  candidateSites: input.candidateSites.filter(record => validCandidateRecord(record) && inContext(record, input.dataMode, input.cityId) && isInCity(record.payload.coordinates, input.cityId)).map(record => record.payload),
  scenario: validRecord(input.scenario, validScenario) && inContext(input.scenario, input.dataMode, input.cityId) ? input.scenario.payload : null,
  scenarioMethodology: 'Sensitivity analysis only: min(100, round(base score + selected indicator / 100 × severity × 0.35)); not an impact forecast.',
  mitigationPlan: validRecord(input.mitigationPlan, validPlan) && inContext(input.mitigationPlan, input.dataMode, input.cityId) && input.facilities.some(f => f.id === input.mitigationPlan!.id && f.cityId === input.cityId && isInCity(f.coordinates, input.cityId)) ? { facilityId: input.mitigationPlan.id, ...input.mitigationPlan.payload } : null,
  limitations: [
    environmentalMessage(input.dataMode),
    'API mode indicates the retrieval path, not external verification. Catalogue recommendations and scenarios remain illustrative.',
    'Planning rectangles are illustrative extents, not official municipal boundaries.',
    'Synthetic records are demonstration data; scores are normalized screening indicators, not physical measurements.',
    'Unknown environmental measurements remain null. A favorable siting conclusion requires additional evidence.',
    'Facility-level summaries do not represent complete city-wide coverage. Population buffers may overlap.',
  ],
});
