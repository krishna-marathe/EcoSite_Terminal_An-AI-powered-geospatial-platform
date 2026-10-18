import React from 'react';
import { useDashboardStore } from '../../stores/dashboardStore';
import { hotspotScore } from '../../utils/environmentalIntelligence';
import { FACILITY_TYPE_LABELS, scoreColor } from '../../theme/tokens';
import { RiskBadge, SourceTag } from '../ui/Badge';
import { EmptyState, ErrorState, LoadingSkeleton } from '../ui/StateViews';
import type { RiskLevel } from '../../types';

const scoreLevel = (score: number): RiskLevel =>
  score >= 80 ? 'critical' : score >= 65 ? 'high' : score >= 45 ? 'moderate' : 'low';

export const ActiveHotspotsPanel: React.FC = () => {
  const {
    selectedFacilityId,
    setSelectedFacilityId,
    scenario,
    facilities,
    facilitiesStatus,
    facilitiesError,
    setDataMode,
  } = useDashboardStore();

  // Sort facilities by overall risk score descending
  const sortedHotspots = [...facilities].sort((a, b) => hotspotScore(b, scenario) - hotspotScore(a, scenario));

  if (facilitiesStatus === 'loading') {
    return (
      <div className="flex h-full flex-col p-3">
        <LoadingSkeleton rows={5} />
      </div>
    );
  }

  if (facilitiesStatus === 'error') {
    return (
      <div className="flex h-full flex-col">
        <ErrorState
          title="Facility data unavailable"
          cause={facilitiesError ?? undefined}
          onDemo={() => setDataMode('demo')}
        />
      </div>
    );
  }

  if (facilities.length === 0) {
    return (
      <div className="flex h-full flex-col">
        <EmptyState
          title="No facilities in this city"
          body="Evaluate a site or switch data mode."
          action={{ label: 'Evaluate a site', to: '/site-analysis' }}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
        {sortedHotspots.slice(0, 10).map((facility) => {
          const isSelected = facility.id === selectedFacilityId;
          const score = hotspotScore(facility, scenario);

          return (
            <button
              key={facility.id}
              type="button"
              onClick={() => setSelectedFacilityId(facility.id)}
              aria-pressed={isSelected}
              className={`block w-full space-y-2 rounded-sm border-l-2 p-3 text-left transition-colors ${
                isSelected
                  ? 'border-eco-primary bg-eco-primary/10'
                  : 'border-transparent hover:bg-eco-surface-secondary'
              }`}
            >
              <span className="flex items-start justify-between gap-2">
                <span className="min-w-0">
                  <span className="block truncate text-body font-medium text-eco-text">{facility.name}</span>
                  <span className="mt-0.5 block truncate text-meta text-eco-muted">
                    {facility.district}, {facility.state} · {FACILITY_TYPE_LABELS[facility.type]}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-0.5">
                  <RiskBadge level={scoreLevel(score)} score={score} />
                  <span className="text-meta text-eco-muted">
                    {scenario ? 'Scenario index' : 'Screening index'}
                  </span>
                </span>
              </span>

              <span aria-hidden="true" className="block h-1.5 overflow-hidden rounded-full bg-eco-surface-secondary">
                <span
                  className="block h-full rounded-full"
                  style={{ width: `${score}%`, backgroundColor: scoreColor(score) }}
                />
              </span>

              <span className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
                <SourceTag
                  organization={facility.provenance.sourceOrganization}
                  status={facility.provenance.dataStatus}
                />
                <span className="font-mono text-data tabular-nums text-eco-muted">
                  Water {facility.indicators.waterStress} · Grid {facility.indicators.gridPressure} · Air{' '}
                  {facility.indicators.airPollution}
                </span>
              </span>
            </button>
          );
        })}
        {sortedHotspots.length > 10 && (
          <p className="px-1 py-1.5 text-meta text-eco-muted">
            Showing top 10 of {sortedHotspots.length} facilities by screening score.
          </p>
        )}
      </div>
    </div>
  );
};
