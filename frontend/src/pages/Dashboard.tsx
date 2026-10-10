import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { WorldMonitorLayerRibbon } from '../components/worldmonitor/WorldMonitorLayerRibbon';
import { LiveSignalsWirePanel } from '../components/worldmonitor/LiveSignalsWirePanel';
import { ActiveHotspotsPanel } from '../components/worldmonitor/ActiveHotspotsPanel';
import { MacroTelemetryPanel } from '../components/worldmonitor/MacroTelemetryPanel';
import { SlideOverDeepDive } from '../components/worldmonitor/SlideOverDeepDive';
import { EcoWorkspace } from '../components/worldmonitor/EcoWorkspace';
import { LeftSidebar } from '../components/layout/LeftSidebar';
import { MainMap } from '../components/map/MainMap';
import { useDashboardStore } from '../stores/dashboardStore';
import type { TimeRange, WorldMonitorLayerKey } from '../types';

export const Dashboard: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { setTimeRange, setViewMode, setWmLayer, viewMode } = useDashboardStore();

  // Parse and sync initial parameters from URL
  useEffect(() => {
    const timeRangeParam = searchParams.get('timeRange');
    if (timeRangeParam && ['1h', '24h', '7d', '30d', 'all'].includes(timeRangeParam)) {
      setTimeRange(timeRangeParam as TimeRange);
    }

    const viewParam = searchParams.get('view');
    if (viewParam === 'global') {
      setViewMode('map_only');
    } else if (viewParam === 'grid') {
      setViewMode('grid_only');
    } else if (viewParam === 'split') {
      setViewMode('split');
    }

    const layersParam = searchParams.get('layers');
    if (layersParam) {
      const requestedKeys = new Set(layersParam.split(',').map((k) => k.trim()));
      const allPossibleKeys: WorldMonitorLayerKey[] = [
        'hotspots',
        'conflicts',
        'bases',
        'nuclear',
        'military',
        'weather',
        'canadaAlerts',
        'outages',
        'natural',
        'waterways',
        'economic',
        'sanctions',
      ];

      allPossibleKeys.forEach((key) => {
        setWmLayer(key, requestedKeys.has(key));
      });
    }
  }, [searchParams, setTimeRange, setViewMode, setWmLayer]);

  return (
    <div className="flex flex-col w-full h-full bg-[#080D1A] text-[#F1F5F9] overflow-hidden select-none font-sans">
      {/* 1. Tactical Layer Ribbon Dock (Collapsible) */}
      <WorldMonitorLayerRibbon />

      {/* 2. Main Workspace */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Collapsible Detailed GIS Sidebar */}
        <LeftSidebar />

        {/* Dynamic Multi-Pane Layout Based on View Mode */}
        {viewMode === 'map_only' ? (
          // Maximized Map View (100% Canvas)
          <div className="flex-1 relative h-full w-full overflow-hidden">
            <MainMap />
          </div>
        ) : viewMode === 'grid_only' ? (
          // Full Terminal Grid Matrix View
          <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-[#080D1A]">
            <div>
              <h2 className="text-sm font-semibold text-slate-200 mb-2">Macro Infrastructure Telemetry</h2>
              <MacroTelemetryPanel />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-[calc(100vh-240px)]">
              <LiveSignalsWirePanel />
              <ActiveHotspotsPanel />
            </div>
          </div>
        ) : (
          // World Monitor-inspired split workspace with map surface and modular intelligence panels
          <div className="flex-1 flex flex-col w-full h-full min-h-0 overflow-hidden relative">
            <EcoWorkspace />
          </div>
        )}

        {/* 3. Slide-Over Deep Dive Panel */}
        <SlideOverDeepDive />
      </div>
    </div>
  );
};
