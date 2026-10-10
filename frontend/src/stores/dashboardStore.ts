import { create } from 'zustand';
import { DEMO_FACILITIES } from '../data/demo/facilities';
import { DEMO_LAYERS } from '../data/demo/layers';
import { DEMO_SIGNALS } from '../data/demo/signals';
import type {
  Facility,
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

const DEFAULT_INDIA_VIEWPORT = {
  longitude: 78.9629,
  latitude: 22.5937,
  zoom: 4.8,
};

export const useDashboardStore = create<DashboardState>((set, get) => ({
  selectedFacilityId: 'dc-mumbai-01',
  selectedFacility: DEMO_FACILITIES[0],
  setSelectedFacilityId: (id) => {
    if (!id) {
      set({ selectedFacilityId: null, selectedFacility: null, isRightPanelOpen: false });
      return;
    }
    const found = DEMO_FACILITIES.find((f) => f.id === id) || null;
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
  setScenario: (scenario) => set({ scenario }),

  audioAlertsEnabled: true,
  toggleAudioAlerts: () => set((state) => ({ audioAlertsEnabled: !state.audioAlertsEnabled })),

  signals: DEMO_SIGNALS,
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

  viewport: DEFAULT_INDIA_VIEWPORT,
  setViewport: (vp) => set({ viewport: vp }),

  fitToIndia: () =>
    set({
      viewport: DEFAULT_INDIA_VIEWPORT,
    }),

  candidateSites: [],
  addCandidateSite: (site) =>
    set((state) => ({
      candidateSites: [...state.candidateSites.filter((s) => s.id !== site.id), site],
    })),
  removeCandidateSite: (siteId) =>
    set((state) => ({
      candidateSites: state.candidateSites.filter((s) => s.id !== siteId),
    })),
  clearCandidateSites: () => set({ candidateSites: [] }),

  isLeftSidebarOpen: false, // Collapsed by default like World Monitor to give maximum room to map & panels!
  toggleLeftSidebar: () => set((state) => ({ isLeftSidebarOpen: !state.isLeftSidebarOpen })),

  isRightPanelOpen: false, // Opens upon facility click
  toggleRightPanel: () => set((state) => ({ isRightPanelOpen: !state.isRightPanelOpen })),
}));
