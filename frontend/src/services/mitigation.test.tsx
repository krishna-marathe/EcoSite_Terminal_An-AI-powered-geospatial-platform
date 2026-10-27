import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AI_UNAVAILABLE_MESSAGE, generateAIMitigationPlan, getMitigationRecommendations, retireLegacyGeminiCredential } from './mitigation';
import { planKey } from '../utils/savedContext';
import { apiClient } from './api';
import { ApiKeyModal } from '../components/ui/ApiKeyModal';
import { Mitigation } from '../pages/Mitigation';
import { PILOT_FACILITIES } from '../data/pilotCities';
import { useDashboardStore } from '../stores/dashboardStore';

beforeEach(() => {
  localStorage.clear();
  useDashboardStore.setState(useDashboardStore.getInitialState(), true);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllEnvs(); });

it('retires only the legacy credential without reading or writing its value', () => {
  localStorage.setItem('ECOSITE_GEMINI_API_KEY', 'test-only-legacy-key');
  const saved = { 'ecosite-pilot-project-v1': 'candidates-and-scenarios', 'ecosite-mitigation-pune-example': 'saved-plan', ECOSITE_MAPBOX_TOKEN: 'public-token' };
  Object.entries(saved).forEach(([key, value]) => localStorage.setItem(key, value));
  const read = vi.spyOn(Storage.prototype, 'getItem');
  const write = vi.spyOn(Storage.prototype, 'setItem');
  const remove = vi.spyOn(Storage.prototype, 'removeItem');
  retireLegacyGeminiCredential();
  expect(read).not.toHaveBeenCalled();
  expect(write).not.toHaveBeenCalled();
  expect(remove.mock.calls).toEqual([['ECOSITE_GEMINI_API_KEY']]);
  expect(localStorage.getItem('ECOSITE_GEMINI_API_KEY')).toBeNull();
  Object.entries(saved).forEach(([key, value]) => expect(localStorage.getItem(key)).toBe(value));
});

it('keeps AI disabled if legacy storage cleanup is blocked', async () => {
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('storage blocked'); });
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  expect(() => retireLegacyGeminiCredential()).not.toThrow();
  expect(warn).toHaveBeenCalledWith('Legacy AI credential removal was blocked by browser storage permissions.');
  await expect(generateAIMitigationPlan()).rejects.toThrow(AI_UNAVAILABLE_MESSAGE);
});

it('never reads, stores or transmits provider credentials, even with legacy configuration', async () => {
  localStorage.setItem('ECOSITE_GEMINI_API_KEY', 'test-only-legacy-key');
  vi.stubEnv('VITE_GEMINI_API_KEY', 'test-only-build-key');
  const read = vi.spyOn(Storage.prototype, 'getItem');
  const write = vi.spyOn(Storage.prototype, 'setItem');
  const request = vi.spyOn(apiClient, 'post');
  const fetch = vi.spyOn(globalThis, 'fetch');
  await expect(generateAIMitigationPlan()).rejects.toThrow(AI_UNAVAILABLE_MESSAGE);
  expect(read).not.toHaveBeenCalled();
  expect(write).not.toHaveBeenCalled();
  expect(request).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
});

it('settings expose only the public basemap token and preserve saved plans', async () => {
  localStorage.setItem('ecosite-mitigation-pune-example', 'saved-plan');
  const read = vi.spyOn(Storage.prototype, 'getItem');
  const write = vi.spyOn(Storage.prototype, 'setItem');
  render(<ApiKeyModal isOpen onClose={() => {}} />);
  expect(screen.queryByLabelText(/Gemini/i)).toBeNull();
  fireEvent.change(screen.getByLabelText(/Mapbox or MapTiler/), { target: { value: 'pk.public-test' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));
  await screen.findByText('Settings saved');
  expect(read.mock.calls.every(([key]) => key !== 'ECOSITE_GEMINI_API_KEY')).toBe(true);
  expect(write.mock.calls).toEqual([['ECOSITE_MAPBOX_TOKEN', 'pk.public-test']]);
  expect(localStorage.getItem('ecosite-mitigation-pune-example')).toBe('saved-plan');
});

it.each(['demo', 'api'] as const)('%s catalogue remains usable without overwriting a saved plan', async mode => {
  const facility = PILOT_FACILITIES[0];
  const storageKey = 'ecosite-mitigation-pune-' + facility.id;
  const saved = JSON.stringify({ source: 'ai', constraints: 'retain my constraints', recommendations: [{ title: 'Existing saved advice' }] });
  localStorage.setItem(storageKey, saved);
  useDashboardStore.getState().setDataMode(mode);
  useDashboardStore.getState().setFacilities([facility]);
  const post = vi.spyOn(apiClient, 'post');
  render(<MemoryRouter><Mitigation /></MemoryRouter>);
  const recommendations = await getMitigationRecommendations(facility.type);
  expect(recommendations.length).toBeGreaterThan(0);
  await screen.findByText(recommendations[0].title);
  expect(screen.getByText(AI_UNAVAILABLE_MESSAGE)).toBeTruthy();
  const button = screen.getByRole('button', { name: 'Request optional AI advice' }) as HTMLButtonElement;
  expect(button.disabled).toBe(true);
  fireEvent.click(button);
  // Even a programmatic form submission must fail closed without saving output.
  await act(async () => { fireEvent.submit(button.closest('form')!); });
  expect(post).not.toHaveBeenCalled();
  expect(localStorage.getItem(storageKey)).toBe(saved);
});

it('still saves a standard catalogue for a facility with no existing plan', async () => {
  const facility = PILOT_FACILITIES[0];
  useDashboardStore.getState().setFacilities([facility]);
  render(<MemoryRouter><Mitigation /></MemoryRouter>);
  await waitFor(() => expect(localStorage.getItem(planKey('demo', 'pune', facility.id))).not.toBeNull());
  const plan = JSON.parse(localStorage.getItem(planKey('demo', 'pune', facility.id))!).payload;
  expect(plan.source).toBe('catalog');
  expect(plan.recommendations).toEqual(await getMitigationRecommendations(facility.type));
});
