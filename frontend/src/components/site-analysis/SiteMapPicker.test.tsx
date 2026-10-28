import { MemoryRouter } from 'react-router-dom';
import { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SiteMapPicker } from './SiteMapPicker';
import { SiteAnalysis } from '../../pages/SiteAnalysis';
import { useDashboardStore } from '../../stores/dashboardStore';
import { PILOT_FACILITIES } from '../../data/pilotCities';
import { assessProposedSite } from '../../services/siteAssessments';

const { maps } = vi.hoisted(() => ({ maps: [] as unknown[] }));
vi.mock('maplibre-gl', () => ({
  Map: class {
    container: HTMLElement;
    listeners = new Map<string, Set<(event: unknown) => void>>();
    sources = new Map();
    constructor(options: { container: HTMLElement }) { this.container = options.container; maps.push(this); }
    on = vi.fn((name: string, callback: (event: unknown) => void) => {
      if (!this.listeners.has(name)) this.listeners.set(name, new Set());
      this.listeners.get(name)!.add(callback);
    });
    off = vi.fn((name: string, callback: (event: unknown) => void) => { this.listeners.get(name)?.delete(callback); });
    emit(name: string, event = {}) { this.listeners.get(name)?.forEach(callback => callback(event)); }
    addControl() {}
    resize() {}
    getCenter() { return { lng: 73.86, lat: 18.52 }; }
    easeTo = vi.fn();
    flyTo = vi.fn();
    setStyle() {}
    getSource(name: string) { return this.sources.get(name); }
    addSource(name: string, source: { data: unknown }) { this.sources.set(name, { ...source, setData: vi.fn() }); }
    addLayer() {}
    remove = vi.fn(() => { this.listeners.clear(); });
  },
  Marker: class {
    element: HTMLElement;
    constructor(options: { element: HTMLElement }) { this.element = options.element; }
    setLngLat(coords: number[]) { this.element.dataset.coordinates = JSON.stringify(coords); return this; }
    addTo(map: { container: HTMLElement }) { map.container.append(this.element); return this; }
    getElement() { return this.element; }
    remove() { this.element.remove(); }
  },
  AttributionControl: class {},
}));
// Expose the deterministic mock's event boundary, not private component state.
type MockMap = { emit: (name: string, event?: unknown) => void; on: ReturnType<typeof vi.fn>; off: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn>; flyTo: ReturnType<typeof vi.fn>; listeners: Map<string, Set<unknown>>; getSource: (name: string) => { setData: ReturnType<typeof vi.fn> } };
const currentMap = () => maps.at(-1) as unknown as MockMap;
const click = (map: MockMap, lng = 73.823456, lat = 18.556789) => act(() => map.emit('click', { lngLat: { lng, lat } }));
beforeEach(() => {
  useDashboardStore.setState(useDashboardStore.getInitialState(), true);
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); maps.length = 0; vi.unstubAllGlobals(); });

it('uses the latest callback without duplicate listeners or recreating the map', () => {
  const first = vi.fn(), latest = vi.fn();
  const view = render(<SiteMapPicker latitude={18.52} longitude={73.86} siteName="First" onCoordinatesChange={first} />);
  const map = currentMap();
  view.rerender(<SiteMapPicker latitude={18.55} longitude={73.82} siteName="Latest" onCoordinatesChange={latest} />);
  click(map);
  expect(first).not.toHaveBeenCalled();
  expect(latest).toHaveBeenCalledExactlyOnceWith({ latitude: 18.5568, longitude: 73.8235, state: 'Maharashtra' });
  expect(maps).toHaveLength(1);
  expect(map.on.mock.calls.filter(([name]) => name === 'click')).toHaveLength(1);
  expect(map.listeners.get('click')!.size).toBe(1);
  view.unmount();
  expect(map.off).toHaveBeenCalledWith('click', expect.any(Function));
  expect(map.remove).toHaveBeenCalledOnce();
  click(map);
  expect(latest).toHaveBeenCalledTimes(1);
});

it('recreates the target marker and leaves one live listener after StrictMode remount', () => {
  const callback = vi.fn();
  const { container } = render(<StrictMode><SiteMapPicker latitude={18.52} longitude={73.86} siteName="Candidate" onCoordinatesChange={callback} /></StrictMode>);
  expect(container.querySelectorAll('.site-target-beacon')).toHaveLength(1);
  const map = currentMap(); click(map);
  expect(callback).toHaveBeenCalledTimes(1);
  expect(map.listeners.get('click')!.size).toBe(1);
});

it.each(['demo', 'api'] as const)('%s map clicks preserve edited form values, markers and invalidation', async mode => {
  useDashboardStore.getState().setDataMode(mode);
  useDashboardStore.getState().setFacilities([PILOT_FACILITIES[0]]);
  const { container } = render(<MemoryRouter><SiteAnalysis /></MemoryRouter>);
  const map = currentMap(); act(() => map.emit('load'));
  for (const [label, value] of [['Capacity (MW)', '250'], ['Water demand (kL/day)', '45'], ['Power demand (MW)', '175'], ['Project name', 'Updated candidate']]) {
    fireEvent.change(screen.getByLabelText(label, { exact: false }), { target: { value } });
    click(map);
    expect((screen.getByLabelText(label, { exact: false }) as HTMLInputElement).value).toBe(value);
  }
  click(map, 73.81, 18.57);
  expect((screen.getByLabelText('Latitude (°)') as HTMLInputElement).value).toBe('18.57');
  expect((screen.getByLabelText('Longitude (°)') as HTMLInputElement).value).toBe('73.81');
  expect(container.querySelector('.site-target-beacon')!.getAttribute('data-coordinates')).toBe('[73.81,18.57]');
  expect(container.querySelector('.site-label-tag')!.textContent).toBe('Updated candidate');
  expect(container.querySelector('[title]')!.getAttribute('title')).toContain(PILOT_FACILITIES[0].name);
  expect(map.getSource('screening-buffer').setData).toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Recenter on candidate pin' }));
  expect(map.flyTo).toHaveBeenLastCalledWith({ center: [73.81, 18.57], zoom: 8, duration: 600 });
  expect(maps).toHaveLength(1);
  // Use demo assessment data as a controlled API response, without a live server.
  const response = await assessProposedSite({ cityId: 'pune', name: 'Updated candidate', type: 'data_centre', longitude: 73.81, latitude: 18.57, capacityMw: 250, waterDemandKld: 45, powerDemandMw: 175 });
  const { apiClient } = await import('../../services/api');
  const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: response });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Evaluate candidate' })); });
  expect(screen.getByText('Save to comparison')).toBeTruthy();
  click(map, 73.80, 18.58);
  expect(screen.queryByText('Save to comparison')).toBeNull();
  expect(screen.getByText(/Inputs changed/)).toBeTruthy();
  for (const [label, value] of [['Capacity (MW)', '250'], ['Water demand (kL/day)', '45'], ['Power demand (MW)', '175'], ['Project name', 'Updated candidate']]) expect((screen.getByLabelText(label, { exact: false }) as HTMLInputElement).value).toBe(value);
  expect((screen.getByLabelText('Infrastructure type') as HTMLInputElement).value).toBe('Data centre');
  click(map, 0, 0);
  expect((screen.getByRole('button', { name: 'Evaluate candidate' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Pune western candidate' }));
  expect((screen.getByRole('button', { name: 'Evaluate candidate' }) as HTMLButtonElement).disabled).toBe(false);
  post.mockRestore();
});
