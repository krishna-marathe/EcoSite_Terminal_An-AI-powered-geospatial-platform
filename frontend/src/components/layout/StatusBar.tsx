import React from 'react';
import { Activity, ShieldCheck } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useDashboardStore } from '../../stores/dashboardStore';
import { DataModeBadge } from '../ui/Badge';
import { FACILITY_TYPE_COLORS, FACILITY_TYPE_LABELS } from '../../theme/tokens';

/** Coordinate suffix from sign — never print "°N/°E" for southern/western values. */
const latSuffix = (value: number) => (value >= 0 ? 'N' : 'S');
const lngSuffix = (value: number) => (value >= 0 ? 'E' : 'W');

export const StatusBar: React.FC = () => {
  const { pathname } = useLocation();
  const { viewport, selectedFacility, dataMode, facilitiesStatus } = useDashboardStore();
  const usesPublicRegistry = ['/dashboard', '/public-facilities', '/ministry', '/operator'].some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  const statusText =
    facilitiesStatus === 'ready'
      ? usesPublicRegistry ? 'Public data-centre registry ready' : 'Candidate evidence ready'
      : facilitiesStatus === 'loading'
        ? usesPublicRegistry ? 'Loading public data-centre registry…' : 'Loading candidate evidence…'
        : usesPublicRegistry ? 'Public data-centre registry unavailable' : 'Candidate evidence unavailable';

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

      {/* The application tracks only data centres; every other map layer is context. */}
      <div className="hidden items-center gap-3 md:flex">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: FACILITY_TYPE_COLORS.data_centre }} />
          <span className="text-eco-text">{FACILITY_TYPE_LABELS.data_centre}</span>
        </div>
      </div>

      {/* World Monitor Digest Coverage Telemetry */}
      <div className="hidden 2xl:flex items-center gap-1.5 font-mono text-micro text-eco-muted border-l border-r border-eco-border px-3">
        <span className="text-eco-primary font-bold">DIGEST COVERAGE:</span>
        <span className="text-eco-text">19 Facilities Screened</span>
        <span>•</span>
        <span>4 Focus States (MH, TG, KA, TN)</span>
        <span>•</span>
        <span className="text-emerald-400 font-semibold">SRTM 30m</span>
        <span>•</span>
        <span className="text-cyan-400 font-semibold">JRC GSW</span>
        <span>•</span>
        <span className="text-amber-400 font-semibold">CGWB 2024</span>
      </div>

      <div className="flex items-center gap-3">
        {selectedFacility && (
          <span className="hidden max-w-[200px] truncate text-eco-text xl:inline">
            Selected: <span className="font-medium text-eco-text">{selectedFacility.name}</span>
          </span>
        )}
        {!usesPublicRegistry && <DataModeBadge mode={dataMode === 'demo' ? 'demo' : 'api'} />}
        <div className="hidden items-center gap-1 sm:flex">
          <ShieldCheck className="h-3.5 w-3.5 text-eco-primary" />
          <span>Screening only</span>
        </div>
      </div>
    </footer>
  );
};
