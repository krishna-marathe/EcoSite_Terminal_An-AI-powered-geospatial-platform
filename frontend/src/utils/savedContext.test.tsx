import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useDashboardStore } from '../stores/dashboardStore';
import { assessProposedSite } from '../services/siteAssessments';
import { getMitigationRecommendations } from '../services/mitigation';
import { Mitigation } from '../pages/Mitigation';
import { Reports } from '../pages/Reports';
import { PILOT_FACILITIES } from '../data/pilotCities';
import { buildPlanningDossier } from './planningReport';
import { downloadCsv, downloadFile } from './csvExport';
import { DASHBOARD_KEY, LEGACY_DASHBOARD_KEY, INVALID_NOTICE, LEGACY_NOTICE, dashboardStorage, planKey, initializePlan, readPlan, saveRecord, type SavedPlan } from './savedContext';

vi.mock('./csvExport', () => ({ downloadCsv: vi.fn(), downloadFile: vi.fn() }));
const facility = PILOT_FACILITIES[0];
const legacyPlanKey = 'ecosite-mitigation-pune-' + facility.id;
const keys = [DASHBOARD_KEY, LEGACY_DASHBOARD_KEY, legacyPlanKey, planKey('demo', 'pune', facility.id), planKey('api', 'pune', facility.id), 'unrelated-preference'];
const candidate = (name: string) => assessProposedSite({ cityId: 'pune', name, type: 'data_centre', longitude: 73.86, latitude: 18.52, capacityMw: 100 });
async function plan(title: string): Promise<SavedPlan> {
  const items = await getMitigationRecommendations(facility.type);
  return { recommendations: [{ ...items[0], title }], source: 'catalog', constraints: 'Preserve constraints', generatedAt: '2026-10-27T00:00:00Z' };
}
beforeEach(() => {
  keys.forEach(key => localStorage.removeItem(key));
  useDashboardStore.setState(useDashboardStore.getInitialState(), true);
  localStorage.removeItem(DASHBOARD_KEY);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.clearAllMocks(); keys.forEach(key => localStorage.removeItem(key)); });

it('isolates candidates and scenarios across switches and reloads, including identical candidate IDs', async () => {
  const demo = await candidate('Demo only');
  useDashboardStore.getState().addCandidateSite(demo);
  useDashboardStore.getState().setScenario({ type: 'heatwave', severity: 40 });
  useDashboardStore.getState().setDataMode('api');
  expect(useDashboardStore.getState().candidateSites).toEqual([]);
  expect(useDashboardStore.getState().scenario).toBeNull();
  const api = { ...demo, name: 'API only' };
  useDashboardStore.getState().addCandidateSite(api);
  useDashboardStore.getState().setScenario({ type: 'flood_event', severity: 20 });
  await useDashboardStore.persist.rehydrate();
  expect(useDashboardStore.getState().candidateSites).toEqual([api]);
  useDashboardStore.getState().setDataMode('demo');
  expect(useDashboardStore.getState().candidateSites).toEqual([demo]);
  expect(useDashboardStore.getState().scenario).toEqual({ type: 'heatwave', severity: 40 });
  await useDashboardStore.persist.rehydrate();
  expect(useDashboardStore.getState().candidateSites).toEqual([demo]);
  useDashboardStore.getState().removeCandidateSite(demo.id);
  expect(useDashboardStore.getState().candidateSites).toEqual([]);
  useDashboardStore.getState().setDataMode('api');
  expect(useDashboardStore.getState().candidateSites).toEqual([api]);
  useDashboardStore.getState().clearCandidateSites();
  expect(useDashboardStore.getState().candidateSites).toEqual([]);
});

it('preserves legacy records and unrelated preferences without attributing origin or repeating migration', async () => {
  const legacy = JSON.stringify({ version: 0, state: { cityId: 'mumbai', dataMode: 'api', candidateSites: [await candidate('Unknown origin')], scenariosByCity: { pune: { type: 'heatwave', severity: 80 } }, customPreference: 'keep' } });
  localStorage.setItem(LEGACY_DASHBOARD_KEY, legacy);
  localStorage.setItem('unrelated-preference', 'keep');
  await useDashboardStore.persist.rehydrate();
  expect(useDashboardStore.getState()).toMatchObject({ cityId: 'mumbai', dataMode: 'api', candidateSites: [], scenario: null, storageNotice: LEGACY_NOTICE });
  useDashboardStore.getState().setDataMode('demo');
  const first = localStorage.getItem(DASHBOARD_KEY);
  await useDashboardStore.persist.rehydrate();
  await useDashboardStore.persist.rehydrate();
  expect(localStorage.getItem(DASHBOARD_KEY)).toBe(first);
  expect(localStorage.getItem(LEGACY_DASHBOARD_KEY)).toBe(legacy);
  expect(localStorage.getItem('unrelated-preference')).toBe('keep');
});

it.each(['{broken', JSON.stringify({ version: 99, state: {} }), JSON.stringify({ version: 2, state: { schemaVersion: 2, cityId: 'pune', dataMode: 'api', savedCandidates: [{ payload: {} }], savedScenarios: [] } })])('protects invalid or unsupported dashboard storage: %s', async raw => {
  localStorage.setItem(DASHBOARD_KEY, raw);
  await useDashboardStore.persist.rehydrate();
  expect(useDashboardStore.getState().storageNotice).toBe(INVALID_NOTICE);
  expect(useDashboardStore.getState().candidateSites).toEqual([]);
  useDashboardStore.getState().setDataMode('api');
  expect(localStorage.getItem(DASHBOARD_KEY)).toBe(raw);
});

it('handles corrupt legacy JSON without changing the original bytes', async () => {
  localStorage.setItem(LEGACY_DASHBOARD_KEY, '{bad');
  await useDashboardStore.persist.rehydrate();
  expect(useDashboardStore.getState().candidateSites).toEqual([]);
  useDashboardStore.getState().setDataMode('api');
  expect(localStorage.getItem(LEGACY_DASHBOARD_KEY)).toBe('{bad');
});

it('saves plans independently, preserves existing plans and isolates unknown legacy plans', async () => {
  const legacy = JSON.stringify(await plan('Legacy only'));
  localStorage.setItem(legacyPlanKey, legacy);
  expect(readPlan('api', 'pune', facility.id)).toMatchObject({ record: null, notice: LEGACY_NOTICE });
  initializePlan('demo', 'pune', facility.id, await plan('Demo only'));
  initializePlan('api', 'pune', facility.id, await plan('API only'));
  const before = localStorage.getItem(planKey('demo', 'pune', facility.id));
  initializePlan('demo', 'pune', facility.id, await plan('Do not replace'));
  expect(localStorage.getItem(planKey('demo', 'pune', facility.id))).toBe(before);
  expect(readPlan('demo', 'pune', facility.id).record?.payload.recommendations[0].title).toBe('Demo only');
  expect(readPlan('api', 'pune', facility.id).record?.payload.recommendations[0].title).toBe('API only');
  expect(localStorage.getItem(legacyPlanKey)).toBe(legacy);
});

it.each(['{broken', JSON.stringify({ schemaVersion: 99 }), JSON.stringify({ schemaVersion: 1, dataMode: 'api', cityId: 'pune', id: 'wrong', updatedAt: '2026-10-27', payload: {} })])('preserves invalid plans and refuses to overwrite them: %s', async raw => {
  localStorage.setItem(planKey('demo', 'pune', facility.id), raw);
  expect(readPlan('demo', 'pune', facility.id)).toMatchObject({ record: null, writable: false, notice: INVALID_NOTICE });
  const payload = await plan('New');
  expect(() => initializePlan('demo', 'pune', facility.id, payload)).toThrow(INVALID_NOTICE);
  expect(localStorage.getItem(planKey('demo', 'pune', facility.id))).toBe(raw);
});

it('loads the appropriate saved mitigation plan on mode switch and revisit without changing bytes', async () => {
  initializePlan('demo', 'pune', facility.id, await plan('Demo saved action'));
  initializePlan('api', 'pune', facility.id, await plan('API saved action'));
  const before = keys.map(key => localStorage.getItem(key));
  useDashboardStore.getState().setFacilities([facility]);
  const view = render(<MemoryRouter><Mitigation /></MemoryRouter>);
  await screen.findByText('Demo saved action');
  expect((screen.getByLabelText('Optional constraints') as HTMLTextAreaElement).value).toBe('Preserve constraints');
  act(() => { useDashboardStore.getState().setDataMode('api'); useDashboardStore.getState().setFacilities([facility]); });
  await screen.findByText('API saved action');
  expect(screen.queryByText('Demo saved action')).toBeNull();
  view.unmount();
  render(<MemoryRouter><Mitigation /></MemoryRouter>);
  await screen.findByText('API saved action');
  for (const key of [planKey('demo', 'pune', facility.id), planKey('api', 'pune', facility.id)]) expect(localStorage.getItem(key)).toBe(before[keys.indexOf(key)]);
});

it('shows a controlled warning for incompatible saved mitigation while preserving catalogue access', async () => {
  const key = planKey('demo', 'pune', facility.id);
  localStorage.setItem(key, '{bad'); useDashboardStore.getState().setFacilities([facility]);
  render(<MemoryRouter><Mitigation /></MemoryRouter>);
  await screen.findByText(INVALID_NOTICE);
  await screen.findByText((await getMitigationRecommendations(facility.type))[0].title);
  expect(localStorage.getItem(key)).toBe('{bad');
});

it.each(['demo', 'api'] as const)('%s dossier filters mismatched records and preserves synthetic labels', async dataMode => {
  const demo = saveRecord('demo', 'pune', 'demo', { ...await candidate('Demo candidate'), id: 'demo' });
  const api = saveRecord('api', 'pune', 'api', { ...await candidate('API candidate'), id: 'api' });
  const opposite = dataMode === 'demo' ? 'api' : 'demo';
  const dossier = buildPlanningDossier({ cityId: 'pune', dataMode, facilities: [facility], candidateSites: [demo, api], scenario: saveRecord(opposite, 'pune', 'pune', { type: 'heatwave', severity: 40 }), mitigationPlan: saveRecord(opposite, 'pune', facility.id, await plan('Wrong context')) });
  expect(dossier.candidateSites.map(site => site.id)).toEqual([dataMode]);
  expect(dossier.candidateSites[0].dataStatus).toBe('synthetic');
  expect(dossier.scenario).toBeNull(); expect(dossier.mitigationPlan).toBeNull();
  expect(dossier.limitations.join(' ')).toContain('not external verification');
});

it.each(['demo', 'api'] as const)('%s JSON, CSV and print use only the active context', async dataMode => {
  for (const mode of ['demo', 'api'] as const) {
    useDashboardStore.getState().setDataMode(mode);
    useDashboardStore.getState().addCandidateSite(await candidate(mode + ' candidate'));
    initializePlan(mode, 'pune', facility.id, await plan(mode + ' action'));
  }
  useDashboardStore.getState().setDataMode(dataMode);
  useDashboardStore.getState().setFacilities([facility]);
  const print = vi.spyOn(window, 'print').mockImplementation(() => {});
  render(<MemoryRouter><Reports /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'Export planning dossier' }));
  const dossier = JSON.parse(vi.mocked(downloadFile).mock.calls[0][1]);
  expect(dossier.dataMode).toBe(dataMode);
  expect(dossier.candidateSites.map((site: { name: string }) => site.name)).toEqual([dataMode + ' candidate']);
  expect(dossier.mitigationPlan.recommendations[0].title).toBe(dataMode + ' action');
  fireEvent.click(screen.getByRole('button', { name: 'Export candidates CSV' }));
  fireEvent.click(screen.getByRole('button', { name: 'Export mitigation CSV' }));
  const rows = JSON.stringify(vi.mocked(downloadCsv).mock.calls);
  expect(rows).toContain(dataMode + ' candidate'); expect(rows).toContain(dataMode + ' action');
  expect(rows).not.toContain((dataMode === 'demo' ? 'api' : 'demo') + ' candidate');
  fireEvent.click(screen.getByRole('button', { name: 'Print' })); expect(print).toHaveBeenCalledOnce();
});

it('reports unavailable browser storage without crashing hydration', async () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
  expect(await dashboardStorage.getItem(DASHBOARD_KEY)).toMatchObject({ state: { storageNotice: INVALID_NOTICE } });
});
