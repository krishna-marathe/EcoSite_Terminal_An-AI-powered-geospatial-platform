import { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MainMap } from './MainMap';
import { LeftSidebar } from '../layout/LeftSidebar';
import { DataQualityBanner } from '../worldmonitor/DataQualityBanner';
import { useDashboardStore } from '../../stores/dashboardStore';
import { PILOT_FACILITIES } from '../../data/pilotCities';
import { DEMO_LAYERS } from '../../data/demo/layers';
import { DEMO_OVERLAYS, environmentalMessage, classifyApiEnvironmentalLayer } from '../../utils/environmentalLayers';
import { buildPlanningDossier } from '../../utils/planningReport';

const { maps } = vi.hoisted(() => ({ maps: [] as unknown[] }));
vi.mock('maplibre-gl', () => ({
  Map: class {
    container: HTMLElement;
    ready = false;
    sources = new Map<string, unknown>();
    layers = new Map<string, { source: string; paint: Record<string, unknown> }>();
    listeners = new Map<string, Set<(event: unknown) => void>>();
    constructor(options: { container: HTMLElement }) { this.container = options.container; maps.push(this); }
    on(name: string, layerOrCallback: string | ((event: unknown) => void), callback?: (event: unknown) => void) {
      const key = typeof layerOrCallback === 'string' ? name + ':' + layerOrCallback : name;
      if (!this.listeners.has(key)) this.listeners.set(key, new Set());
      this.listeners.get(key)!.add(typeof layerOrCallback === 'string' ? callback! : layerOrCallback);
    }
    off(name: string, callback: (event: unknown) => void) { this.listeners.get(name)?.delete(callback); }
    emit(name: string) { if (name === 'load') this.ready = true; this.listeners.get(name)?.forEach(callback => callback({})); if (name === 'style.load') this.ready = true; }
    addControl() {}
    resize() {}
    getCenter() { return { lng: 73.86, lat: 18.52 }; }
    getZoom() { return 7; }
    flyTo() {}
    project() { return { x: 100, y: 100 }; }
    getCanvas() { return this.container; }
    loaded() { return this.ready; }
    isStyleLoaded() { return this.ready; }
    getSource(id: string) { return this.sources.get(id); }
    getLayer(id: string) { return this.layers.get(id); }
    addSource(id: string, source: unknown) { if (this.sources.has(id)) throw new Error('Duplicate source'); this.sources.set(id, source); }
    addLayer(layer: { id: string; source: string; paint: Record<string, unknown> }) { if (this.layers.has(layer.id)) throw new Error('Duplicate layer'); this.layers.set(layer.id, layer); }
    removeLayer(id: string) { this.layers.delete(id); }
    removeSource(id: string) { if ([...this.layers.values()].some(layer => layer.source === id)) throw new Error('Source removed before layers'); this.sources.delete(id); }
    setPaintProperty(id: string, key: string, value: unknown) { this.layers.get(id)!.paint[key] = value; }
    setStyle = vi.fn(() => { this.ready = false; this.layers.clear(); this.sources.clear(); });
    remove = vi.fn(() => { this.listeners.clear(); this.layers.clear(); this.sources.clear(); });
  },
  Marker: class {
    element: HTMLElement;
    constructor(options: { element: HTMLElement }) { this.element = options.element; }
    setLngLat() { return this; }
    addTo(map: { container: HTMLElement }) { map.container.append(this.element); return this; }
    getElement() { return this.element; }
    remove() { this.element.remove(); }
  },
  AttributionControl: class {},
}));
type MapMock = { emit: (event: string) => void; sources: Map<string, unknown>; layers: Map<string, { paint: Record<string, unknown> }>; listeners: Map<string, Set<unknown>>; remove: ReturnType<typeof vi.fn>; setStyle: ReturnType<typeof vi.fn> };
const map = () => maps.at(-1) as MapMock;
const load = (name = 'load') => act(() => map().emit(name));
const setMode = (mode: 'demo' | 'api') => act(() => useDashboardStore.getState().setDataMode(mode));
beforeEach(() => {
  vi.stubEnv('VITE_MAPBOX_TOKEN', '');
  useDashboardStore.setState(useDashboardStore.getInitialState(), true);
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
});
afterEach(() => { cleanup(); maps.length = 0; vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it('creates six demo sources and eleven layers with the current toggle and opacity settings', () => {
  useDashboardStore.getState().toggleLayer('env-air-quality');
  useDashboardStore.getState().setLayerOpacity('env-air-quality', 0.25);
  render(<MainMap />); load();
  expect([...map().sources.keys()].sort()).toEqual(DEMO_OVERLAYS.map(layer => layer.source).sort());
  expect(map().layers.size).toBe(11);
  expect(map().layers.get('layer-air-quality-fill')!.paint['fill-opacity']).toBe(0.25);
  expect(map().layers.get('layer-heat-anomaly-fill')!.paint['fill-opacity']).toBe(0);
  expect(screen.getByText(environmentalMessage('demo'))).toBeTruthy();
});

it('never creates demo sources in API mode, including style reload and remount', () => {
  setMode('api'); const view = render(<MainMap />); load(); load('style.load');
  act(() => useDashboardStore.getState().setMapStyle('streets')); load('style.load');
  expect(map().sources.size).toBe(0); expect(map().layers.size).toBe(0);
  expect(screen.getByText(environmentalMessage('api'))).toBeTruthy();
  const old = map(); view.unmount(); expect(old.remove).toHaveBeenCalledOnce(); expect(old.listeners.size).toBe(0);
  render(<MainMap />); load(); expect(map().sources.size).toBe(0);
});

it('removes demo layers before sources and restores settings through repeated mode/style transitions', () => {
  render(<MainMap />); load();
  for (let i = 0; i < 3; i++) {
    setMode('api'); expect(map().sources.size).toBe(0); expect(map().layers.size).toBe(0);
    load('style.load'); expect(map().sources.size).toBe(0);
    setMode('demo'); expect(map().sources.size).toBe(6); expect(map().layers.size).toBe(11);
  }
  act(() => { useDashboardStore.getState().toggleLayer('env-groundwater-stress'); useDashboardStore.getState().toggleLayer('env-air-quality'); useDashboardStore.getState().setLayerOpacity('env-air-quality', 0.3); useDashboardStore.getState().setMapStyle('satellite'); });
  load('style.load');
  expect(map().layers.get('layer-gw-stress-fill')!.paint['fill-opacity']).toBe(0);
  expect(map().layers.get('layer-air-quality-fill')!.paint['fill-opacity']).toBe(0.3);
  expect(maps).toHaveLength(1);
});

it('uses current mode when a delayed initial load or style event arrives', () => {
  render(<MainMap />); setMode('api'); load(); expect(map().sources.size).toBe(0);
  setMode('demo'); act(() => useDashboardStore.getState().setMapStyle('streets'));
  setMode('api'); load('style.load'); expect(map().sources.size).toBe(0);
});

it('keeps safe selectable facility markers in API mode without synthetic overlays', () => {
  setMode('api');
  useDashboardStore.getState().setFacilities([{ ...PILOT_FACILITIES[0], name: '<img src=x onerror=alert(1)>' }]);
  const { container } = render(<MainMap />); load();
  const marker = container.querySelector('.facility-marker-pin')!;
  expect(marker.querySelector('.facility-name-tag')!.textContent).toBe('<img src=x onerror=alert(1)>');
  expect(marker.querySelector('img')).toBeNull(); fireEvent.click(marker);
  expect(useDashboardStore.getState().selectedFacilityId).toBe(PILOT_FACILITIES[0].id);
  expect(map().sources.size).toBe(0);
});

it('sidebar disables unavailable geometry without erasing user toggle preferences', () => {
  useDashboardStore.getState().toggleLeftSidebar();
  render(<LeftSidebar />);
  const groundwater = screen.getByRole('button', { name: /Groundwater Stress/ });
  expect((groundwater as HTMLButtonElement).disabled).toBe(false);
  expect(screen.queryByRole('button', { name: /Land Use/ })).toBeNull();
  setMode('api');
  expect((groundwater as HTMLButtonElement).disabled).toBe(true);
  expect(groundwater.getAttribute('aria-pressed')).toBe('false');
  expect(useDashboardStore.getState().activeLayers['env-groundwater-stress']).toBe(true);
  setMode('demo'); expect(groundwater.getAttribute('aria-pressed')).toBe('true');
});

it('banner reports facility source status without restating the registry count', () => {
  const dataCentre = { ...PILOT_FACILITIES[0], type: 'data_centre' as const };
  setMode('api'); useDashboardStore.getState().setFacilities([dataCentre]);
  render(<MemoryRouter><DataQualityBanner /></MemoryRouter>);
  expect(screen.getByText(environmentalMessage('api'))).toBeTruthy();
  expect(screen.getByText(/Sources:/).textContent).toContain('(synthetic)');
  // The count is stated once, by the dashboard KPI; no other surface may restate it.
  expect(screen.queryByText(/operating data cent/i)).toBeNull();
});

it('sidebar fixes facility scope to data centres and labels retained overlays as context', () => {
  useDashboardStore.setState({ typeFilter: 'all' });
  useDashboardStore.getState().toggleLeftSidebar();
  render(<LeftSidebar />);
  expect(screen.getByText('Data centres (fixed)')).toBeTruthy();
  expect(useDashboardStore.getState().typeFilter).toBe('data_centre');
  expect(screen.getByRole('button', { name: /Ambient Air Quality.*Context/ })).toBeTruthy();
  expect(screen.getByRole('button', { name: /Substations.*Context/ })).toBeTruthy();
  expect(screen.queryByRole('button', { name: /Thermal Power Plants/ })).toBeNull();
  expect(screen.queryByRole('button', { name: /Solar Farms/ })).toBeNull();
});

it('never infers source backing from transport, missing metadata or unavailable status', () => {
  expect(classifyApiEnvironmentalLayer({ isAvailable: true, dataStatus: 'synthetic', sourceOrganization: 'Fixture' })).toBe('API_SYNTHETIC');
  expect(classifyApiEnvironmentalLayer({ isAvailable: true, dataStatus: 'observed' })).toBe('API_UNAVAILABLE');
  const sourced = { isAvailable: true, dataStatus: 'observed', sourceOrganization: 'Test dataset', sourceUrl: 'https://example.org/data', publicationDate: '2026-01-01', geographicResolution: 'Test coverage' };
  expect(classifyApiEnvironmentalLayer(sourced)).toBe('SOURCE_BACKED');
  expect(classifyApiEnvironmentalLayer({ ...sourced, isAvailable: false })).toBe('API_UNAVAILABLE');
  expect(DEMO_LAYERS.filter(layer => DEMO_OVERLAYS.some(overlay => overlay.key === layer.id)).every(layer => layer.provenance.dataStatus === 'synthetic')).toBe(true);
});

it('reports unavailable environmental evidence without converting it into low risk', () => {
  const report = buildPlanningDossier({ cityId: 'pune', dataMode: 'api', facilities: [], candidateSites: [], scenario: null });
  expect(report.environmentalLayers).toEqual({ state: 'API_UNAVAILABLE', message: environmentalMessage('api') });
  expect(report.limitations.join(' ')).toContain('Unknown environmental measurements remain null');
});

it('does not reset the initial non-default style on a StrictMode remount', () => {
  useDashboardStore.getState().setMapStyle('streets');
  const first = render(<StrictMode><MainMap /></StrictMode>); load();
  expect(map().setStyle).not.toHaveBeenCalled();
  const old = map(); first.unmount();
  expect(old.remove).toHaveBeenCalledOnce();
  render(<StrictMode><MainMap /></StrictMode>); load();
  expect(map().setStyle).not.toHaveBeenCalled();
  expect(map().sources.size).toBe(6);
});

it('restores overlays on style.load before tile readiness and retains the latest rapid style/mode intent', () => {
  render(<MainMap />); load();
  act(() => useDashboardStore.getState().setMapStyle('streets'));
  act(() => useDashboardStore.getState().setMapStyle('satellite'));
  load('style.load');
  expect(map().sources.size).toBe(6);
  expect(map().layers.size).toBe(11);
  setMode('api');
  act(() => useDashboardStore.getState().setMapStyle('dark'));
  load('style.load');
  expect(map().sources.size).toBe(0);
  setMode('demo');
  expect(map().sources.size).toBe(6);
  expect(map().listeners.get('style.load')!.size).toBe(1);
});
