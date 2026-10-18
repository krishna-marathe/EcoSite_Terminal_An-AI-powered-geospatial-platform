import { CityComparison } from '../components/worldmonitor/CityComparison';
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
import { Card } from '../components/ui/Card';
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
    <div className="flex h-full w-full flex-col overflow-hidden bg-eco-bg text-eco-text select-none">
      {/* Tactical layer ribbon (collapsible) */}
      <WorldMonitorLayerRibbon />
      <CityComparison />

      {/* Main workspace */}
      <div className="relative flex flex-1 overflow-hidden">
        {/* Collapsible GIS layer sidebar */}
        <LeftSidebar />

        {viewMode === 'map_only' ? (
          // Maximized map view
          <div className="relative flex-1 h-full w-full overflow-hidden">
            <MainMap />
          </div>
        ) : viewMode === 'grid_only' ? (
          // Full terminal grid: telemetry matrix plus signal and hotspot panels
          <div className="flex-1 space-y-4 overflow-y-auto bg-eco-bg p-4">
            <Card title="Macro infrastructure telemetry">
              <MacroTelemetryPanel />
            </Card>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card
                title="Environmental alerts"
                className="flex h-[calc(100vh-330px)] min-h-[320px] flex-col"
              >
                <LiveSignalsWirePanel />
              </Card>
              <Card
                title="Environmental hotspots"
                className="flex h-[calc(100vh-330px)] min-h-[320px] flex-col"
              >
                <ActiveHotspotsPanel />
              </Card>
            </div>
          </div>
        ) : (
          // Split workspace: map surface with modular intelligence panels
          <div className="relative flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden">
            <EcoWorkspace />
          </div>
        )}

        {/* Slide-over deep dive */}
        <SlideOverDeepDive />
      </div>
    </div>
  );
};
