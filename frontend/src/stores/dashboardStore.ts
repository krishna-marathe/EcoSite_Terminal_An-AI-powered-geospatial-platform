import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DASHBOARD_KEY, dashboardStorage, activeCandidates, activeScenario, inContext, saveRecord, validCandidate, type SavedRecord, type Scenario } from '../utils/savedContext';
import { getPilotCity } from '../data/pilotCities';
import { DEMO_LAYERS } from '../data/demo/layers';

import type {
  Facility,
  CityId,
  DataMode,
  InfrastructureType,
  IntelligenceSignal,
  ProposedSite,
  RiskLevel,
  TimeRange,
  DashboardViewMode,
  WorldMonitorLayerKey,
  ScenarioType,
} from '../types';

export interface DashboardState {
  cityId: CityId;
  setCityId: (cityId: CityId) => void;
  dataMode: DataMode;
  setDataMode: (mode: DataMode) => void;
  facilities: Facility[];
  setFacilities: (facilities: Facility[]) => void;
  facilitiesStatus: 'loading' | 'ready' | 'error';
  facilitiesError: string | null;
  savedCandidates: SavedRecord<ProposedSite>[];
  savedScenarios: SavedRecord<Scenario>[];
  storageNotice: string;
  // Facility Selection
  selectedFacilityId: string | null;
  selectedFacility: Facility | null;
  setSelectedFacilityId: (id: string | null) => void;

  // Filter State
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  typeFilter: InfrastructureType | 'all';
  setTypeFilter: (type: InfrastructureType | 'all') => void;
  riskFilter: RiskLevel | 'all';
  setRiskFilter: (risk: RiskLevel | 'all') => void;

  // World Monitor HUD State
  timeRange: TimeRange;
  setTimeRange: (tr: TimeRange) => void;
  viewMode: DashboardViewMode;
  setViewMode: (vm: DashboardViewMode) => void;
  wmLayers: Record<WorldMonitorLayerKey, boolean>;
  toggleWmLayer: (key: WorldMonitorLayerKey) => void;
  setWmLayer: (key: WorldMonitorLayerKey, active: boolean) => void;
  setAllWmLayers: (active: boolean) => void;
  scenario: { type: ScenarioType; severity: number } | null;
  setScenario: (scenario: { type: ScenarioType; severity: number } | null) => void;
  audioAlertsEnabled: boolean;
  toggleAudioAlerts: () => void;

  // Live OSINT Signals
  signals: IntelligenceSignal[];
  signalFilter: 'all' | 'critical' | 'high' | 'elevated' | 'nominal';
  setSignalFilter: (filter: 'all' | 'critical' | 'high' | 'elevated' | 'nominal') => void;

  // Layer Management (Detailed GIS)
  activeLayers: Record<string, boolean>;
  layerOpacities: Record<string, number>;
  toggleLayer: (layerId: string) => void;
  setLayerOpacity: (layerId: string, opacity: number) => void;
  resetLayers: () => void;

  // Map Viewport
  mapStyle: 'dark' | 'satellite' | 'streets';
  setMapStyle: (style: 'dark' | 'satellite' | 'streets') => void;
  viewport: {
    longitude: number;
    latitude: number;
    zoom: number;
  };
  setViewport: (vp: { longitude: number; latitude: number; zoom: number }) => void;
  fitToIndia: () => void;

  // Proposed Sites for Comparison
  candidateSites: ProposedSite[];
  addCandidateSite: (site: ProposedSite) => void;
  removeCandidateSite: (siteId: string) => void;
  clearCandidateSites: () => void;

  // Sidebar & Slide-over Toggles
  isLeftSidebarOpen: boolean;
  toggleLeftSidebar: () => void;
  isRightPanelOpen: boolean;
  toggleRightPanel: () => void;
}

const initialLayersState: Record<string, boolean> = {};
const initialLayersOpacity: Record<string, number> = {};

DEMO_LAYERS.forEach((l) => {
  initialLayersState[l.id] = l.active;
  initialLayersOpacity[l.id] = l.opacity;
});

// All 12 World Monitor layers active by default matching URL
const initialWmLayers: Record<WorldMonitorLayerKey, boolean> = {
  hotspots: true,
  conflicts: true,
  bases: true,
  nuclear: true,
  military: true,
  weather: true,
  canadaAlerts: true,
  outages: true,
  natural: true,
  waterways: true,
  economic: true,
  sanctions: true,
};

const cityViewport = (cityId: CityId) => {
  const city = getPilotCity(cityId);
  return { longitude: city.center[0], latitude: city.center[1], zoom: city.zoom };
};

export const useDashboardStore = create<DashboardState>()(persist((set, get) => ({
  cityId: 'pune',
  dataMode: 'demo',
  facilities: [],
  facilitiesStatus: 'loading',
  facilitiesError: null,
  savedCandidates: [],
  savedScenarios: [],
  storageNotice: '',
  setCityId: (cityId) => set({ cityId, facilities: [], facilitiesStatus: 'loading', facilitiesError: null, selectedFacility: null, selectedFacilityId: null, scenario: activeScenario(get().savedScenarios, get().dataMode, cityId), viewport: cityViewport(cityId) }),
  setDataMode: (dataMode) => set({ dataMode, candidateSites: activeCandidates(get().savedCandidates, dataMode), scenario: activeScenario(get().savedScenarios, dataMode, get().cityId), facilities: [], facilitiesStatus: 'loading', facilitiesError: null, selectedFacility: null, selectedFacilityId: null }),
  setFacilities: (facilities) => set((state) => {
    const selectedFacility = facilities.find((facility) => facility.id === state.selectedFacilityId) || facilities[0] || null;
    return { facilities, facilitiesStatus: 'ready', facilitiesError: null, selectedFacility, selectedFacilityId: selectedFacility?.id || null };
  }),
  selectedFacilityId: null,
  selectedFacility: null,
  setSelectedFacilityId: (id) => {
    if (!id) {
      set({ selectedFacilityId: null, selectedFacility: null, isRightPanelOpen: false });
      return;
    }
    const found = get().facilities.find((f) => f.id === id) || null;
    set({
      selectedFacilityId: id,
      selectedFacility: found,
      isRightPanelOpen: true,
      viewport: found
        ? {
            longitude: found.coordinates[0],
            latitude: found.coordinates[1],
            zoom: 8.5,
          }
        : get().viewport,
    });
  },

  searchQuery: '',
  setSearchQuery: (query) => set({ searchQuery: query }),

  typeFilter: 'all',
  setTypeFilter: (type) => set({ typeFilter: type }),

  riskFilter: 'all',
  setRiskFilter: (risk) => set({ riskFilter: risk }),

  // World Monitor HUD Controls
  timeRange: '7d',
  setTimeRange: (tr) => set({ timeRange: tr }),

  viewMode: 'split',
  setViewMode: (vm) => set({ viewMode: vm }),

  wmLayers: initialWmLayers,
  toggleWmLayer: (key) =>
    set((state) => ({
      wmLayers: {
        ...state.wmLayers,
        [key]: !state.wmLayers[key],
      },
    })),
  setWmLayer: (key, active) =>
    set((state) => ({
      wmLayers: {
        ...state.wmLayers,
        [key]: active,
      },
    })),
  setAllWmLayers: (active) =>
    set((state) => {
      const updated = { ...state.wmLayers };
      Object.keys(updated).forEach((k) => {
        updated[k as WorldMonitorLayerKey] = active;
      });
      return { wmLayers: updated };
    }),

  scenario: null,
  setScenario: (scenario) => set((state) => ({ scenario, savedScenarios: [
    ...state.savedScenarios.filter(record => !inContext(record, state.dataMode, state.cityId)),
    ...(scenario ? [saveRecord(state.dataMode, state.cityId, state.cityId, scenario)] : []),
  ] })),

  audioAlertsEnabled: true,
  toggleAudioAlerts: () => set((state) => ({ audioAlertsEnabled: !state.audioAlertsEnabled })),

  signals: [],
  signalFilter: 'all',
  setSignalFilter: (filter) => set({ signalFilter: filter }),

  // GIS Layer Management
  activeLayers: initialLayersState,
  layerOpacities: initialLayersOpacity,

  toggleLayer: (layerId) =>
    set((state) => ({
      activeLayers: {
        ...state.activeLayers,
        [layerId]: !state.activeLayers[layerId],
      },
    })),

  setLayerOpacity: (layerId, opacity) =>
    set((state) => ({
      layerOpacities: {
        ...state.layerOpacities,
        [layerId]: opacity,
      },
    })),

  resetLayers: () =>
    set({
      activeLayers: initialLayersState,
      layerOpacities: initialLayersOpacity,
      wmLayers: initialWmLayers,
    }),

  mapStyle: 'dark',
  setMapStyle: (style) => set({ mapStyle: style }),

  viewport: cityViewport('pune'),
  setViewport: (vp) => set({ viewport: vp }),

  fitToIndia: () =>
    set({
      viewport: cityViewport(get().cityId),
    }),

  candidateSites: [],
  addCandidateSite: (site) => set((state) => {
    if (!validCandidate(site)) return state;
    const savedCandidates = [...state.savedCandidates.filter(record => !(inContext(record, state.dataMode, site.cityId) && record.id === site.id)), saveRecord(state.dataMode, site.cityId, site.id, site)];
    return { savedCandidates, candidateSites: activeCandidates(savedCandidates, state.dataMode) };
  }),
  removeCandidateSite: (siteId) => set((state) => {
    const savedCandidates = state.savedCandidates.filter(record => !(inContext(record, state.dataMode, state.cityId) && record.id === siteId));
    return { savedCandidates, candidateSites: activeCandidates(savedCandidates, state.dataMode) };
  }),
  clearCandidateSites: () => set((state) => {
    const savedCandidates = state.savedCandidates.filter(record => !inContext(record, state.dataMode, state.cityId));
    return { savedCandidates, candidateSites: activeCandidates(savedCandidates, state.dataMode) };
  }),

  isLeftSidebarOpen: false, // Collapsed by default like World Monitor to give maximum room to map & panels!
  toggleLeftSidebar: () => set((state) => ({ isLeftSidebarOpen: !state.isLeftSidebarOpen })),

  isRightPanelOpen: false, // Opens upon facility click
  toggleRightPanel: () => set((state) => ({ isRightPanelOpen: !state.isRightPanelOpen })),
}), {
  name: DASHBOARD_KEY,
  version: 2,
  storage: dashboardStorage,
  partialize: (state) => ({ schemaVersion: 2 as const, cityId: state.cityId, dataMode: state.dataMode, savedCandidates: state.savedCandidates, savedScenarios: state.savedScenarios }),
  merge: (persisted, current) => {
    const saved = persisted as import('../utils/savedContext').SavedDashboard;
    return { ...current, cityId: saved.cityId, dataMode: saved.dataMode, savedCandidates: saved.savedCandidates, savedScenarios: saved.savedScenarios, storageNotice: saved.storageNotice || '', candidateSites: activeCandidates(saved.savedCandidates, saved.dataMode), scenario: activeScenario(saved.savedScenarios, saved.dataMode, saved.cityId), viewport: cityViewport(saved.cityId) };
  },
}));
