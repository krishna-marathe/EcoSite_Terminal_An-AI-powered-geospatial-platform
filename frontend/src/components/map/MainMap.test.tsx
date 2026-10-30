import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MainMap } from './MainMap';
import { PILOT_FACILITIES } from '../../data/pilotCities';
import { getFacilities } from '../../services/facilities';
import { apiClient } from '../../services/api';
import { useDashboardStore } from '../../stores/dashboardStore';
import type { PublicFacility } from '../../types/publicFacilities';

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
    isStyleLoaded() { return false; }
    getSource() { return undefined; }
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

describe('public data-centre markers', () => {
  const publicFacility: PublicFacility = {
    id: 'public-dc-1',
    name: '<img src=x onerror="window.mapInjectionExecuted = true">',
    operator: 'Public Operator',
    ownershipCategory: 'private',
    facilityType: 'colocation',
    stateCode: 'IN-MH',
    state: 'Maharashtra',
    city: 'Mumbai',
    locality: 'General locality',
    publicCoordinates: [72.8777, 19.076],
    locationPrecision: 'locality',
    operationalSince: 2020,
    capacityDisclosures: [],
    verification: {
      status: 'public_operator_confirmed',
      verifiedAt: '2026-01-01T00:00:00Z',
      expiresAt: '2026-04-01T00:00:00Z',
      source: {
        title: 'Facility page',
        publisher: 'Public Operator',
        url: 'https://example.test/facility',
        sourceClass: 'operator',
        retrievedAt: '2026-01-01T00:00:00Z',
      },
    },
  };

  it('replaces legacy pins with a safe, selectable and keyboard-native registry marker', () => {
    useDashboardStore.getState().setFacilities([{ ...PILOT_FACILITIES[0] }]);
    const onSelect = vi.fn();
    const onOpen = vi.fn();
    const view = render(
      <MainMap
        publicDataCentres={[publicFacility]}
        onSelectPublicFacility={onSelect}
        onOpenPublicFacility={onOpen}
      />
    );

    expect(view.container.querySelector('.facility-marker-pin')).toBeNull();
    const marker = view.container.querySelector<HTMLButtonElement>('.public-data-centre-marker')!;
    expect(marker).toBeInstanceOf(HTMLButtonElement);
    expect(marker.getAttribute('aria-label')).toContain('Mumbai, Maharashtra');
    expect(marker.querySelector('img, script, [onerror]')).toBeNull();
    expect(marker.querySelector('.public-data-centre-marker-label')?.textContent).toContain(publicFacility.name);
    expect(marker.textContent).not.toContain('72.8777');

    fireEvent.focus(marker);
    expect(marker.querySelector<HTMLElement>('.public-data-centre-marker-label')!.style.opacity).toBe('1');
    fireEvent.click(marker);
    expect(onSelect).toHaveBeenCalledWith(publicFacility);
    expect(onOpen).toHaveBeenCalledWith(publicFacility);
    expect(view.container.querySelector<HTMLButtonElement>('.public-data-centre-marker')?.getAttribute('aria-pressed')).toBe('true');
  });

  it('never claims zero data centres while the registry is loading or unavailable', () => {
    const view = render(<MainMap publicDataCentres={[]} publicDataCentresStatus="loading" />);
    expect(screen.getByText('Loading data centres…')).toBeTruthy();
    expect(screen.queryByText(/0 operating data centre/)).toBeNull();

    view.rerender(<MainMap publicDataCentres={[]} publicDataCentresStatus="error" />);
    expect(screen.getByText('Data centres unavailable')).toBeTruthy();
    expect(screen.queryByText(/0 operating data centre/)).toBeNull();

    view.rerender(<MainMap publicDataCentres={[publicFacility]} publicDataCentresStatus="ready" />);
    expect(screen.getByText('1 operating data centre')).toBeTruthy();
  });
});
