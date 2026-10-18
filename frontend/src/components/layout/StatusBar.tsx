import React from 'react';
import { Activity, ShieldCheck } from 'lucide-react';
import { useDashboardStore } from '../../stores/dashboardStore';
import { DataModeBadge } from '../ui/Badge';
import { FACILITY_TYPE_COLORS, FACILITY_TYPE_LABELS } from '../../theme/tokens';
import type { InfrastructureType } from '../../types';

const LEGEND_ORDER: InfrastructureType[] = [
  'data_centre',
  'thermal_power',
  'hydro_power',
  'solar_farm',
  'wind_farm',
  'substation',
  'industrial',
];

/** Coordinate suffix from sign — never print "°N/°E" for southern/western values. */
const latSuffix = (value: number) => (value >= 0 ? 'N' : 'S');
const lngSuffix = (value: number) => (value >= 0 ? 'E' : 'W');

export const StatusBar: React.FC = () => {
  const { viewport, selectedFacility, dataMode, facilitiesStatus } = useDashboardStore();

  const statusText =
    facilitiesStatus === 'ready'
      ? 'City records ready'
      : facilitiesStatus === 'loading'
        ? 'Loading city records…'
        : 'City records unavailable';

  return (
    <footer className="z-30 flex h-7 shrink-0 select-none items-center justify-between border-t border-eco-border bg-eco-surface px-4 text-meta text-eco-muted">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-eco-primary">
          <Activity className="h-3 w-3" />
          <span className="font-medium">{statusText}</span>
        </div>

        <div className="hidden items-center gap-1 border-l border-eco-border pl-3 font-mono text-micro sm:flex">
          <span>VIEWPORT</span>
          <span className="text-eco-text">
            {Math.abs(viewport.latitude).toFixed(2)}°{latSuffix(viewport.latitude)},{' '}
            {Math.abs(viewport.longitude).toFixed(2)}°{lngSuffix(viewport.longitude)}
          </span>
        </div>
      </div>

      {/* Shared marker-color vocabulary — identical to the map legend. */}
      <div className="hidden items-center gap-3 md:flex">
        {LEGEND_ORDER.map((type) => (
          <div key={type} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: FACILITY_TYPE_COLORS[type] }} />
            <span className="text-eco-text">{FACILITY_TYPE_LABELS[type]}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        {selectedFacility && (
          <span className="hidden max-w-[200px] truncate text-eco-text xl:inline">
            Selected: <span className="font-medium text-eco-text">{selectedFacility.name}</span>
          </span>
        )}
        <DataModeBadge mode={dataMode === 'demo' ? 'demo' : 'api'} />
        <div className="hidden items-center gap-1 sm:flex">
          <ShieldCheck className="h-3.5 w-3.5 text-eco-primary" />
          <span>Screening only</span>
        </div>
      </div>
    </footer>
  );
};
