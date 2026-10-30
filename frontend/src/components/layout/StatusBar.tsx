import React from 'react';
import { Activity, ShieldCheck } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useDashboardStore } from '../../stores/dashboardStore';
import { DataModeBadge } from '../ui/Badge';
import { FACILITY_TYPE_COLORS, FACILITY_TYPE_LABELS } from '../../theme/tokens';

export const StatusBar: React.FC = () => {
  const { pathname } = useLocation();
  const { selectedFacility, dataMode, facilitiesStatus } = useDashboardStore();
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

      </div>

      {/* The application tracks only data centres; every other map layer is context. */}
      <div className="hidden items-center gap-3 md:flex">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: FACILITY_TYPE_COLORS.data_centre }} />
          <span className="text-eco-text">{FACILITY_TYPE_LABELS.data_centre}</span>
        </div>
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
