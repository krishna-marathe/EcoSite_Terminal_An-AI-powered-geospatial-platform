import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SiteAnalysis } from './SiteAnalysis';
import { assessProposedSite } from '../services/siteAssessments';
import { useDashboardStore } from '../stores/dashboardStore';
import type { ProposedSite } from '../types';

vi.mock('../services/siteAssessments', () => ({ assessProposedSite: vi.fn() }));
vi.mock('../components/site-analysis/SiteMapPicker', () => ({
  SiteMapPicker: ({ onCoordinatesChange }: { onCoordinatesChange: (coords: { latitude: number; longitude: number; state: string }) => void }) => <button type="button" onClick={() => onCoordinatesChange({ latitude: 18.55, longitude: 73.82, state: 'Maharashtra' })}>Pick map point</button>,
}));
const assess = vi.mocked(assessProposedSite);
function pending() {
  let resolve!: (value: ProposedSite) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<ProposedSite>((yes, no) => { resolve = yes; reject = no; });
  assess.mockReturnValueOnce(promise);
  return { resolve, reject };
}
function result(call: number): ProposedSite {
  const req = assess.mock.calls[call][0];
  return { ...req, id: 'result-' + call, coordinates: [req.longitude, req.latitude], state: req.state ?? 'Maharashtra', district: 'Pune', dataStatus: 'synthetic', waterDemandKld: req.waterDemandKld ?? 0, powerDemandMw: req.powerDemandMw ?? 0, groundwaterZone: 'Unavailable', substationDistanceKm: 3, protectedAreaDistanceKm: null, population5km: null, suitabilityScore: null, suitabilityStatus: 'Insufficient data', flags: ['Evidence for request ' + call] };
}
function submit() { fireEvent.submit(screen.getByRole('button', { name: /Evaluat/ }).closest('form')!); }
beforeEach(() => { useDashboardStore.setState(useDashboardStore.getInitialState(), true); });
afterEach(() => { cleanup(); vi.resetAllMocks(); });

it.each([
  ['Capacity (MW)', '120'], ['Water demand (kL/day)', '25'], ['Power demand (MW)', '110'],
  ['Latitude (°)', '18.55'], ['Longitude (°)', '73.82'], ['Project name', 'New candidate'], ['Infrastructure type', 'industrial'],
  ['map', ''], ['preset', ''],
])('invalidates pending assessment on %s edit and clears loading immediately', async (label, value) => {
  const a = pending(); render(<SiteAnalysis />); submit();
  expect(screen.getByRole('button', { name: 'Evaluating…' })).toBeTruthy();
  if (label === 'map') fireEvent.click(screen.getByText('Pick map point'));
  else if (label === 'preset') fireEvent.click(screen.getByRole('button', { name: 'Pune western candidate' }));
  else fireEvent.change(screen.getByLabelText(label, { exact: false }), { target: { value } });
  expect(assess.mock.calls[0][2]!.aborted).toBe(true);
  expect((screen.getByRole('button', { name: 'Evaluate candidate' }) as HTMLButtonElement).disabled).toBe(false);
  expect(screen.getByText(/Inputs changed/)).toBeTruthy();
  await act(async () => { a.resolve(result(0)); });
  expect(screen.queryByText('Evidence for request 0')).toBeNull();
  expect(screen.queryByText('Save to comparison')).toBeNull();
});

it('keeps B when B succeeds before A, and saves only the current snapshot', async () => {
  const a = pending(), b = pending(); render(<SiteAnalysis />); submit();
  fireEvent.change(screen.getByLabelText('Project name', { exact: false }), { target: { value: 'Candidate B' } });
  fireEvent.change(screen.getByLabelText('Infrastructure type'), { target: { value: 'industrial' } });
  submit();
  expect(assess.mock.calls[0][0].name).toBe('Pune candidate');
  expect(assess.mock.calls[1][0]).toMatchObject({ name: 'Candidate B', type: 'industrial' });
  await act(async () => { b.resolve(result(1)); });
  await act(async () => { a.resolve(result(0)); });
  expect(screen.queryByText('Evidence for request 0')).toBeNull();
  expect(screen.getByText('Evidence for request 1')).toBeTruthy();
  expect(screen.getByText(/Suitability remains unavailable/)).toBeTruthy();
  fireEvent.click(screen.getByText('Save to comparison'));
  expect(useDashboardStore.getState().candidateSites).toEqual([result(1)]);
  fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
  expect(useDashboardStore.getState().candidateSites).toEqual([]);
});

it('ignores stale failure while B is loading and clears loading only when B finishes', async () => {
  const a = pending(), b = pending(); render(<SiteAnalysis />); submit();
  fireEvent.change(screen.getByLabelText('Capacity (MW)'), { target: { value: '120' } }); submit();
  await act(async () => { a.reject(new Error('obsolete failure')); });
  expect(screen.queryByText('obsolete failure')).toBeNull();
  expect(screen.getByRole('button', { name: 'Evaluating…' })).toBeTruthy();
  await act(async () => { b.resolve(result(1)); });
  expect(screen.getByRole('button', { name: 'Evaluate candidate' })).toBeTruthy();
});

it('does not replace a newer success with a stale failure', async () => {
  const a = pending(), b = pending(); render(<SiteAnalysis />); submit(); submit();
  expect(assess.mock.calls[0][2]!.aborted).toBe(true);
  await act(async () => { b.resolve(result(1)); a.reject(new Error('obsolete failure')); });
  expect(screen.queryByText('obsolete failure')).toBeNull();
  expect(screen.getByText('Evidence for request 1')).toBeTruthy();
});

it('shows current failure, clears loading and clears the error on edit', async () => {
  const a = pending(); render(<SiteAnalysis />);
  expect(screen.getByText('Evaluate coordinates to see available evidence')).toBeTruthy(); submit();
  await act(async () => { a.reject(new Error('Backend unavailable')); });
  expect(screen.getByText('Backend unavailable')).toBeTruthy();
  expect((screen.getByRole('button', { name: 'Evaluate candidate' }) as HTMLButtonElement).disabled).toBe(false);
  expect(screen.queryByText('Save to comparison')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Pune western candidate' }));
  expect(screen.queryByText('Backend unavailable')).toBeNull();
});

it.each(['city', 'mode', 'unmount'])('invalidates requests when changing %s', async change => {
  const a = pending(); const view = render(<SiteAnalysis />); submit();
  if (change === 'unmount') view.unmount();
  else act(() => { if (change === 'city') useDashboardStore.getState().setCityId('mumbai'); else useDashboardStore.getState().setDataMode('api'); });
  expect(assess.mock.calls[0][2]!.aborted).toBe(true);
  await act(async () => { a.resolve(result(0)); });
  expect(screen.queryByText('Evidence for request 0')).toBeNull();
});
