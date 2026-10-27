import type { PersistStorage } from 'zustand/middleware';
import type { CityId, DataMode, MitigationRecommendation, ProposedSite, ScenarioType } from '../types';
import { FACILITY_TYPE_LABELS } from '../theme/tokens';
import { validateRecommendations } from '../services/mitigation';

export const DASHBOARD_KEY = 'ecosite-pilot-project-v2';
export const LEGACY_DASHBOARD_KEY = 'ecosite-pilot-project-v1';
export const LEGACY_NOTICE = 'Legacy browser records are preserved but excluded: their Demo/API origin is unknown. Manual review is required before importing them.';
export const INVALID_NOTICE = 'Saved browser data is invalid or uses an unsupported version. It is preserved and excluded; changes to this storage cannot be saved until it is reviewed.';
export type Scenario = { type: ScenarioType; severity: number };
export interface SavedRecord<T> {
  schemaVersion: 1;
  dataMode: DataMode;
  cityId: CityId;
  id: string;
  updatedAt: string;
  payload: T;
}
export interface SavedPlan {
  recommendations: MitigationRecommendation[];
  source: 'catalog' | 'ai';
  constraints: string;
  generatedAt: string;
}
export interface SavedDashboard {
  schemaVersion: 2;
  cityId: CityId;
  dataMode: DataMode;
  savedCandidates: SavedRecord<ProposedSite>[];
  savedScenarios: SavedRecord<Scenario>[];
  storageNotice?: string;
}
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string';
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const nonnegative = (value: unknown) => finite(value) && value >= 0;
const nullableNumber = (value: unknown) => value === null || nonnegative(value);
const city = (value: unknown): value is CityId => value === 'pune' || value === 'mumbai';
const mode = (value: unknown): value is DataMode => value === 'demo' || value === 'api';
const timestamp = (value: unknown) => text(value) && Number.isFinite(Date.parse(value));
export function validCandidate(value: unknown): value is ProposedSite {
  if (!object(value)) return false;
  return text(value.id) && !!value.id && city(value.cityId) && text(value.name)
    && text(value.type) && Object.hasOwn(FACILITY_TYPE_LABELS, value.type)
    && text(value.state) && text(value.district)
    && Array.isArray(value.coordinates) && value.coordinates.length === 2 && value.coordinates.every(finite)
    && Math.abs(value.coordinates[0]) <= 180 && Math.abs(value.coordinates[1]) <= 90
    && [value.capacityMw, value.waterDemandKld, value.powerDemandMw].every(nonnegative)
    && [value.substationDistanceKm, value.protectedAreaDistanceKm, value.population5km].every(nullableNumber)
    && nullableNumber(value.suitabilityScore) && (value.suitabilityScore === null || (value.suitabilityScore as number) <= 100)
    && ['observed', 'estimated', 'synthetic', 'unavailable'].includes(value.dataStatus as string)
    && ['Safe', 'Semi-Critical', 'Critical', 'Over-Exploited', 'Unavailable'].includes(value.groundwaterZone as string)
    && ['Highly Suitable', 'Favorable with Mitigation', 'High Risk / Unfavorable', 'Insufficient data'].includes(value.suitabilityStatus as string)
    && Array.isArray(value.flags) && value.flags.every(text);
}
export const validScenario = (value: unknown): value is Scenario => object(value)
  && ['water_reduction', 'heatwave', 'grid_curtailment', 'flood_event'].includes(value.type as string)
  && finite(value.severity) && value.severity >= 0 && value.severity <= 100;
export function validPlan(value: unknown): value is SavedPlan {
  if (!object(value) || !['catalog', 'ai'].includes(value.source as string) || !text(value.constraints) || !timestamp(value.generatedAt)) return false;
  try { validateRecommendations(value.recommendations); return true; } catch { return false; }
}
export function validRecord<T>(value: unknown, validPayload: (payload: unknown) => payload is T): value is SavedRecord<T> {
  return object(value) && value.schemaVersion === 1 && mode(value.dataMode) && city(value.cityId)
    && text(value.id) && !!value.id && timestamp(value.updatedAt) && validPayload(value.payload);
}
export const validCandidateRecord = (value: unknown): value is SavedRecord<ProposedSite> => validRecord(value, validCandidate)
  && value.id === value.payload.id && value.cityId === value.payload.cityId;
export const inContext = (record: SavedRecord<unknown>, dataMode: DataMode, cityId?: CityId) => record.dataMode === dataMode && (!cityId || record.cityId === cityId);
export const saveRecord = <T>(dataMode: DataMode, cityId: CityId, id: string, payload: T): SavedRecord<T> => ({ schemaVersion: 1, dataMode, cityId, id, updatedAt: new Date().toISOString(), payload });
export const activeCandidates = (records: SavedRecord<ProposedSite>[], dataMode: DataMode) => records.filter(record => validCandidateRecord(record) && inContext(record, dataMode)).map(record => record.payload);
export const activeScenario = (records: SavedRecord<Scenario>[], dataMode: DataMode, cityId: CityId) => records.find(record => validRecord(record, validScenario) && inContext(record, dataMode, cityId))?.payload ?? null;
function validDashboard(value: unknown): value is { state: SavedDashboard; version: number } {
  if (!object(value) || value.version !== 2 || !object(value.state)) return false;
  const state = value.state;
  return state.schemaVersion === 2 && city(state.cityId) && mode(state.dataMode)
    && Array.isArray(state.savedCandidates) && state.savedCandidates.every(validCandidateRecord)
    && Array.isArray(state.savedScenarios) && state.savedScenarios.every(record => validRecord(record, validScenario));
}
const parse = (raw: string | null): unknown => { try { return raw === null ? null : JSON.parse(raw); } catch { return null; } };
const emptyDashboard = (): SavedDashboard => ({ schemaVersion: 2, cityId: 'pune', dataMode: 'demo', savedCandidates: [], savedScenarios: [] });
// Keep legacy and unreadable values byte-for-byte; never infer origin from synthetic status.
export const dashboardStorage: PersistStorage<SavedDashboard> = {
  getItem(name) {
    const fallback = emptyDashboard();
    try {
      const raw = localStorage.getItem(name);
      const legacy = localStorage.getItem(LEGACY_DASHBOARD_KEY);
      if (raw !== null) {
        const value = parse(raw);
        return validDashboard(value)
          ? { ...value, state: { ...value.state, storageNotice: legacy === null ? '' : LEGACY_NOTICE } }
          : { version: 2, state: { ...fallback, storageNotice: INVALID_NOTICE } };
      }
      const old = parse(legacy);
      if (object(old) && object(old.state)) {
        if (city(old.state.cityId)) fallback.cityId = old.state.cityId;
        if (mode(old.state.dataMode)) fallback.dataMode = old.state.dataMode;
      }
      return { version: 2, state: { ...fallback, storageNotice: legacy === null ? '' : LEGACY_NOTICE } };
    } catch { return { version: 2, state: { ...fallback, storageNotice: INVALID_NOTICE } }; }
  },
  setItem(name, value) {
    try {
      const raw = localStorage.getItem(name);
      if (raw !== null && !validDashboard(parse(raw))) return;
      localStorage.setItem(name, JSON.stringify(value));
    } catch { console.warn('Browser context could not be saved.'); }
  },
  removeItem() { /* Explicit deletion/recovery is outside this checkpoint. */ },
};
export const planKey = (dataMode: DataMode, cityId: CityId, facilityId: string) => 'ecosite-mitigation-v2-' + dataMode + '-' + cityId + '-' + encodeURIComponent(facilityId);
export function readPlan(dataMode: DataMode, cityId: CityId, facilityId: string): { record: SavedRecord<SavedPlan> | null; notice: string; writable: boolean } {
  try {
    const raw = localStorage.getItem(planKey(dataMode, cityId, facilityId));
    if (raw === null) return { record: null, writable: true, notice: localStorage.getItem('ecosite-mitigation-' + cityId + '-' + facilityId) === null ? '' : LEGACY_NOTICE };
    const value = parse(raw);
    if (validRecord(value, validPlan) && inContext(value, dataMode, cityId) && value.id === facilityId) return { record: value, notice: '', writable: true };
    return { record: null, notice: INVALID_NOTICE, writable: false };
  } catch { return { record: null, notice: INVALID_NOTICE, writable: false }; }
}
export function initializePlan(dataMode: DataMode, cityId: CityId, facilityId: string, payload: SavedPlan) {
  const existing = readPlan(dataMode, cityId, facilityId);
  if (!existing.writable) throw new Error(INVALID_NOTICE);
  if (existing.record) return existing.record;
  if (!validPlan(payload)) throw new Error('The mitigation plan is invalid and was not saved.');
  const record = saveRecord(dataMode, cityId, facilityId, payload);
  localStorage.setItem(planKey(dataMode, cityId, facilityId), JSON.stringify(record));
  return record;
}
