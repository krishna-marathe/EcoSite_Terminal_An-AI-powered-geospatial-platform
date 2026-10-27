vi.mock('../components/projects/PhaseEditor', () => ({ PhaseEditor: () => null }));
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Projects } from './Projects';
import * as service from '../services/projects';
import type { CandidateSite, PolygonGeometry } from '../services/projects';

const mocks = vi.hoisted(() => ({ maps: [] as Array<{ handlers: Record<string, (e?: unknown) => void>; emit: (name: string, e?: unknown) => void; data: unknown; removed: boolean }> }));
vi.mock('maplibre-gl', () => ({
  Map: class {
    handlers: Record<string, (e?: unknown) => void> = {};
    data: unknown; removed = false;
    constructor() { mocks.maps.push(this); }
    on(name: string, handler: (e?: unknown) => void) { this.handlers[name] = handler; }
    off(name: string) { delete this.handlers[name]; }
    emit(name: string, event?: unknown) { this.handlers[name]?.(event); }
    addControl() {} addLayer() {} resize() {} easeTo() {} flyTo() {} fitBounds() {}
    getCenter() { return { lng:73.8567, lat:18.5204 }; }
    getSource() { return { setData: (data: unknown) => { this.data = data; } }; }
    addSource(_id: string, source: { data: unknown }) { this.data = source.data; }
    remove() { this.removed = true; this.handlers = {}; }
  },
  AttributionControl: class {},
  Marker: class { setLngLat() { return this; } addTo() { return this; } remove() {} },
}));
vi.mock('../services/projects', async () => ({ ...await vi.importActual('../services/projects'), getProjects: vi.fn(), createProject: vi.fn(), getSites: vi.fn(), saveSite: vi.fn(), archiveSite: vi.fn() }));
vi.mock('../services/observations', async () => ({
  ...await vi.importActual('../services/observations'),
  getSiteObservations: vi.fn(async () => ({ items: [], total: 0 })),
  runEnvironmentalAnalysis: vi.fn(),
}));
const polygon: PolygonGeometry = { type:'Polygon',coordinates:[[[73.85,18.52],[73.86,18.52],[73.86,18.53],[73.85,18.52]]] };
const saved: CandidateSite = { id:'s1',project_id:'p1',name:'Saved parcel',geometry:polygon,area_ha:58,state_code:'IN-MH',district:'Pune',geometry_hash:'hash',boundary_source:'Test boundary',boundary_sha256:'test',status:'active',revision:2,created_at:'2026-10-27T00:00:00Z',updated_at:'2026-10-27T00:00:00Z' };
let records: CandidateSite[];
function mount(path='/projects?project=p1') {
  const client = new QueryClient({ defaultOptions:{queries:{retry:false,gcTime:0}} });
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}><Projects /></MemoryRouter></QueryClientProvider>);
}
beforeEach(() => {
  records=[]; mocks.maps.length=0;
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.stubEnv('VITE_MAPBOX_TOKEN','');
  vi.mocked(service.getProjects).mockResolvedValue({items:[{id:'p1',name:'Project one',organization_label:'Test',archetype:'edge',stage:'concept',status:'active',revision:1}],total:1});
  vi.mocked(service.getSites).mockImplementation(async () => [...records]);
  vi.mocked(service.saveSite).mockImplementation(async (_project, body, existing) => {
    const result = { ...saved,...body,revision:existing ? existing.revision+1 : 1 };
    records=[result]; return result;
  });
  vi.mocked(service.archiveSite).mockImplementation(async site => { records=[]; return {...site,status:'archived',revision:site.revision+1}; });
});
afterEach(() => { cleanup();vi.clearAllMocks();vi.restoreAllMocks();vi.unstubAllEnvs();vi.unstubAllGlobals(); });

it('draws a polygon through actual map click callbacks and saves the current coordinates',async () => {
  mount(); await screen.findByLabelText('Candidate name');
  fireEvent.change(screen.getByLabelText('Candidate name'),{target:{value:'Drawn parcel'}});
  fireEvent.click(screen.getByRole('button',{name:'Draw new polygon'}));
  const map=mocks.maps.at(-1)!;
  for (const [lng,lat] of [[73.85123456,18.52],[73.86,18.52],[73.86,18.53]]) act(()=>map.emit('click',{lngLat:{lng,lat}}));
  expect(screen.getByRole('status').textContent).toContain('3 vertices');
  fireEvent.click(screen.getByRole('button',{name:'Finish drawing'}));
  fireEvent.click(screen.getByRole('button',{name:'Save candidate polygon'}));
  await waitFor(()=>expect(service.saveSite).toHaveBeenCalledOnce());
  expect(vi.mocked(service.saveSite).mock.calls[0][1]).toMatchObject({name:'Drawn parcel',geometry:{coordinates:[[[73.85123456,18.52],[73.86,18.52],[73.86,18.53],[73.85123456,18.52]]]}});
  await screen.findByRole('button',{name:'Drawn parcel'});
  expect(map.removed).toBe(true);
});

it('restores the selected persisted polygon after reload and edits vertices without changing unrelated fields',async () => {
  records=[saved];const view=mount('/projects?project=p1&site=s1');
  await screen.findByDisplayValue('Saved parcel');
  expect((screen.getByLabelText('District (optional)') as HTMLInputElement).value).toBe('Pune');
  fireEvent.change(screen.getByLabelText('Ring 0 vertex 1 longitude'),{target:{value:'73.84'}});
  fireEvent.click(screen.getByRole('button',{name:'Save candidate polygon'}));
  await waitFor(()=>expect(service.saveSite).toHaveBeenCalledOnce());
  const call=vi.mocked(service.saveSite).mock.calls[0];
  expect(call[2]?.revision).toBe(2);
  expect(call[1].geometry.coordinates[0][0]).toEqual([73.84,18.52]);
  expect(call[1].geometry.coordinates[0].at(-1)).toEqual([73.84,18.52]);
  expect(call[1]).toMatchObject({name:'Saved parcel',state_code:'IN-MH',district:'Pune'});
  await waitFor(()=>expect(records[0].revision).toBe(3));view.unmount();
  mount('/projects?project=p1&site=s1');await screen.findByDisplayValue('Saved parcel');
  expect((screen.getByLabelText('Ring 0 vertex 1 longitude') as HTMLInputElement).value).toBe('73.84');
});

it('imports a GeoJSON Feature and rejects malformed or unsupported input without replacing the draft',async () => {
  mount();await screen.findByLabelText('Candidate name');
  const input=screen.getByLabelText('GeoJSON polygon');
  fireEvent.change(input,{target:{value:JSON.stringify({type:'Feature',geometry:polygon,properties:{name:'ignored'}})}});
  fireEvent.click(screen.getByRole('button',{name:'Import GeoJSON'}));
  expect((screen.getByLabelText('Ring 0 vertex 1 longitude') as HTMLInputElement).value).toBe('73.85');
  fireEvent.change(input,{target:{value:'{"type":"MultiPolygon","coordinates":[]}'}});
  fireEvent.click(screen.getByRole('button',{name:'Import GeoJSON'}));
  expect(screen.getByRole('alert').textContent).toContain('Import one GeoJSON Polygon');
  expect((screen.getByLabelText('Ring 0 vertex 1 longitude') as HTMLInputElement).value).toBe('73.85');
  expect(service.saveSite).not.toHaveBeenCalled();
});

it('does not fabricate success on unavailable boundary or stale revision errors',async () => {
  records=[saved];vi.mocked(service.saveSite).mockRejectedValue(new Error('Approved India screening boundary is unavailable; no polygon was saved.'));
  mount('/projects?project=p1&site=s1');await screen.findByDisplayValue('Saved parcel');
  fireEvent.click(screen.getByRole('button',{name:'Save candidate polygon'}));
  await screen.findByRole('alert');expect(screen.getByRole('alert').textContent).toContain('boundary');
  expect(screen.queryByText('Candidate saved to the local backend.')).toBeNull();
  expect(screen.getByRole('button',{name:'Save candidate polygon'}).hasAttribute('disabled')).toBe(false);
});

it('limits the new-candidate action to three active records and frees a slot by archive',async () => {
  records=[saved,{...saved,id:'s2',name:'Second'},{...saved,id:'s3',name:'Third'}];
  vi.spyOn(window,'confirm').mockReturnValue(true);
  mount();await screen.findByLabelText('Candidate name');
  fireEvent.change(screen.getByLabelText('GeoJSON polygon'),{target:{value:JSON.stringify(polygon)}});
  fireEvent.click(screen.getByRole('button',{name:'Import GeoJSON'}));
  expect(screen.getByRole('button',{name:'Save candidate polygon'}).hasAttribute('disabled')).toBe(true);
  fireEvent.click(screen.getByRole('button',{name:'Archive Saved parcel'}));
  await waitFor(()=>expect(service.archiveSite).toHaveBeenCalledWith(saved));
  await waitFor(()=>expect(screen.getByRole('button',{name:'Save candidate polygon'}).hasAttribute('disabled')).toBe(false));
});

it('never combines one project candidate query with another project after switching',async () => {
  vi.mocked(service.getProjects).mockResolvedValue({items:[{id:'p1',name:'Project one',organization_label:'T',archetype:'edge',stage:'concept',status:'active',revision:1},{id:'p2',name:'Project two',organization_label:'T',archetype:'edge',stage:'concept',status:'active',revision:1}],total:2});
  vi.mocked(service.getSites).mockImplementation(async id=>id==='p1'?[saved]:[]);
  mount();await screen.findByRole('button',{name:'Saved parcel'});
  fireEvent.change(screen.getByLabelText('Project',{exact:true}),{target:{value:'p2'}});
  await waitFor(()=>expect(screen.queryByRole('button',{name:'Saved parcel'})).toBeNull());
  expect(service.getSites).toHaveBeenCalledWith('p2',expect.any(AbortSignal));
});

it('labels legacy and borderline boundary records for review without claiming legal verification', async () => {
  records=[{...saved,boundary_screening:{status:'review_required',version:'9469f09',licence:'CC0 1.0',screening_only:true}}];
  mount();
  expect(await screen.findByText(/Boundary review required — consult Survey of India/)).toBeTruthy();
  expect(screen.getByText(/not official legal boundary verification/)).toBeTruthy();
});
