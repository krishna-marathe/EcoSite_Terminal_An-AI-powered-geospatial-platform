import React from 'react';
import { Radio, Clock } from 'lucide-react';
import { useDashboardStore } from '../../stores/dashboardStore';
import { Badge } from '../ui/Badge';
import { EmptyState } from '../ui/StateViews';
import type { IntelligenceSignal } from '../../types';

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'elevated', label: 'Elevated' },
  { value: 'nominal', label: 'Nominal' },
] as const;

const severityVariant = (severity: IntelligenceSignal['severity']) => {
  if (severity === 'critical' || severity === 'high') return 'critical' as const;
  if (severity === 'elevated') return 'warning' as const;
  return 'secondary' as const;
};

export const LiveSignalsWirePanel: React.FC = () => {
  const { signals, signalFilter, setSignalFilter, setSelectedFacilityId } = useDashboardStore();

  const filteredSignals = signals.filter((s) => {
    if (signalFilter === 'all') return true;
    return s.severity === signalFilter;
  });

  const countText =
    signalFilter === 'all'
      ? `${signals.length} signals`
      : `${filteredSignals.length} of ${signals.length} signals`;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Count + severity filter row */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-eco-border px-3 py-2">
        <span className="flex items-center gap-1.5 text-body font-medium text-eco-text">
          <Radio className="h-3.5 w-3.5 text-eco-muted" />
          {countText}
        </span>

        <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Filter signals by severity">
          {FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              aria-pressed={signalFilter === filter.value}
              onClick={() => setSignalFilter(filter.value)}
              className={`rounded-sm border px-2 py-0.5 text-meta transition-colors ${
                signalFilter === filter.value
                  ? 'border-eco-primary/40 bg-eco-primary/10 text-eco-primary'
                  : 'border-eco-border text-eco-muted hover:text-eco-text'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Signals feed stream */}
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {signals.length === 0 ? (
          <EmptyState
            title="No city alert provider connected"
            body="Facility screening scores are available in the hotspots panel."
            icon={<Radio className="h-5 w-5" />}
          />
        ) : filteredSignals.length === 0 ? (
          <EmptyState
            title={`No ${signalFilter} signals`}
            body="Adjust the severity filter to view available alerts."
          />
        ) : (
          <div className="space-y-1">
            {filteredSignals.map((signal) => (
              <button
                key={signal.id}
                type="button"
                onClick={() => setSelectedFacilityId(signal.facilityId)}
                className="block w-full space-y-1.5 rounded-sm p-3 text-left transition-colors hover:bg-eco-surface-secondary"
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <Badge variant={severityVariant(signal.severity)} size="xs">
                      {signal.severity}
                    </Badge>
                    <span className="truncate text-body font-medium text-eco-text">{signal.facilityName}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1 text-meta text-eco-muted">
                    <Clock className="h-3 w-3" />
                    <span>{signal.timeAgo}</span>
                  </span>
                </span>

                <span className="block text-body text-eco-text">{signal.message}</span>

                <span className="flex flex-wrap items-center justify-between gap-2 text-meta text-eco-muted">
                  <span>
                    Source: <span className="text-eco-text">{signal.agency}</span>
                  </span>
                  {signal.metricValue && (
                    <span className="font-mono text-data tabular-nums text-eco-text">{signal.metricValue}</span>
                  )}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
