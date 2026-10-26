import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MainMap } from './MainMap';
import { PILOT_FACILITIES } from '../../data/pilotCities';
import { getFacilities } from '../../services/facilities';
import { apiClient } from '../../services/api';
import { useDashboardStore } from '../../stores/dashboardStore';

const { flyTo } = vi.hoisted(() => ({ flyTo: vi.fn() }));

// Keep the real component DOM and store; replace only the WebGL map boundary.
vi.mock('maplibre-gl', () => ({
  Map: class {
    container: HTMLElement;
    constructor(options: { container: HTMLElement }) { this.container = options.container; }
    addControl() {}
    on() {}
    off() {}
    remove() {}
    resize() {}
    loaded() { return true; }
    getLayer() { return undefined; }
    getCenter() { return { lng: 0, lat: 0 }; }
    getZoom() { return 0; }
    project() { return { x: 100, y: 100 }; }
    flyTo = flyTo;
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

const fixtureName = PILOT_FACILITIES[0].name;

beforeEach(() => {
  localStorage.clear();
  useDashboardStore.setState(useDashboardStore.getInitialState(), true);
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
});

afterEach(() => {
  cleanup();
  PILOT_FACILITIES[0].name = fixtureName;
  vi.restoreAllMocks();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe.each(['demo', 'api'] as const)('%s facility markers', (mode) => {
  async function renderFacility(name: string) {
    PILOT_FACILITIES[0].name = name;
    const facility = { ...PILOT_FACILITIES[0] };
    vi.spyOn(apiClient, 'get').mockResolvedValue({ data: [facility] });
    const records = await getFacilities(undefined, mode);
    useDashboardStore.getState().setDataMode(mode);
    useDashboardStore.getState().setFacilities(records.filter(record => record.id === facility.id));
    useDashboardStore.getState().setSelectedFacilityId(null);
    const view = render(<MainMap />);
    const marker = () => view.container.querySelector<HTMLElement>('.facility-marker-pin')!;
    return { ...view, marker, facility };
  }

  it.each([
    ['normal name', 'Pune Data Centre & Research'],
    ['script text', '<script>window.mapInjectionExecuted = true</script>'],
    ['event handler text', '<img src=x onerror="window.mapInjectionExecuted = true">'],
  ])('renders %s literally without creating HTML', async (_label, name) => {
    const { marker } = await renderFacility(name);
    const tag = marker().querySelector('.facility-name-tag')!;
    expect(tag.textContent?.trim()).toBe(name);
    expect(tag.childElementCount).toBe(0);
    expect(marker().querySelector('script, img, [onerror]')).toBeNull();
    expect(marker().getAttribute('aria-label')).toBe('Open facility dossier for ' + name);
    expect(Reflect.get(window, 'mapInjectionExecuted')).toBeUndefined();
  });

  it('preserves hover, mouse and keyboard selection, navigation and filtering', async () => {
    const name = '<img src=x onerror="window.mapInjectionExecuted = true">';
    const { marker, facility, container } = await renderFacility(name);
    fireEvent.mouseEnter(marker());
    expect(marker().querySelector<HTMLElement>('.facility-name-tag')!.style.opacity).toBe('1');
    expect(marker().querySelector<HTMLElement>('.marker-core')!.style.transform).toBe('scale(1.25)');
    fireEvent.mouseLeave(marker());
    expect(marker().querySelector<HTMLElement>('.facility-name-tag')!.style.opacity).toBe('0');
    const bubbled = vi.fn();
    container.addEventListener('pointerdown', bubbled);
    container.addEventListener('click', bubbled);
    fireEvent.pointerDown(marker());
    fireEvent.click(marker());
    expect(bubbled).not.toHaveBeenCalled();
    expect(useDashboardStore.getState().selectedFacilityId).toBe(facility.id);
    expect(useDashboardStore.getState().isRightPanelOpen).toBe(true);
    expect(flyTo).toHaveBeenLastCalledWith(expect.objectContaining({ center: facility.coordinates, zoom: 8.5 }));
    for (const key of ['Enter', ' ']) {
      act(() => useDashboardStore.getState().setSelectedFacilityId(null));
      fireEvent.keyDown(marker(), { key });
      expect(useDashboardStore.getState().selectedFacilityId).toBe(facility.id);
      expect(marker().style.width).toBe('34px');
      expect(marker().querySelector('.facility-name-tag')!.textContent?.trim()).toBe(name);
      expect(marker().querySelector('img')).toBeNull();
    }
    act(() => useDashboardStore.getState().setSearchQuery('no-matching-facility'));
    expect(marker()).toBeNull();
    act(() => useDashboardStore.getState().setSearchQuery(''));
    expect(marker().querySelector('.facility-name-tag')!.textContent?.trim()).toBe(name);
  });
});
