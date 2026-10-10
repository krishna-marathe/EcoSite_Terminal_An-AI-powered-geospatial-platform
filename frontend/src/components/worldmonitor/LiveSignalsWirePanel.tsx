import React from 'react';
import { Radio, Clock } from 'lucide-react';
import { useDashboardStore } from '../../stores/dashboardStore';
import type { IntelligenceSignal } from '../../types';

export const LiveSignalsWirePanel: React.FC = () => {
  const { signals, signalFilter, setSignalFilter, setSelectedFacilityId } = useDashboardStore();

  const filteredSignals = signals.filter((s) => {
    if (signalFilter === 'all') return true;
    return s.severity === signalFilter;
  });

  const getSeverityBadge = (severity: IntelligenceSignal['severity']) => {
    switch (severity) {
      case 'critical':
        return (
          <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-950/80 text-rose-300 border border-rose-800/80 font-semibold uppercase">
            Critical
          </span>
        );
      case 'high':
        return (
          <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-950/80 text-amber-300 border border-amber-800/80 font-semibold uppercase">
            High
          </span>
        );
      case 'elevated':
        return (
          <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-950/80 text-sky-300 border border-sky-800/80 font-semibold uppercase">
            Elevated
          </span>
        );
      case 'nominal':
        return (
          <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800/80 font-semibold uppercase">
            Nominal
          </span>
        );
    }
  };

  return (
    <div className="bg-[#0F172A]/90 border border-[#1E293B] rounded-lg flex flex-col h-full overflow-hidden text-xs font-sans select-none shadow-sm">
      {/* Panel Header */}
      <div className="h-10 px-3.5 bg-[#111A2E] border-b border-[#1E293B] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
          <span className="font-semibold text-slate-100 text-xs">
            Live Alert Feed
          </span>
          <span className="text-[10px] text-slate-400 bg-[#080D1A] px-1.5 py-0.2 rounded border border-[#1E293B]">
            {filteredSignals.length}
          </span>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 text-[11px]">
          {(['all', 'critical', 'high', 'elevated'] as const).map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setSignalFilter(filter)}
              className={`px-2 py-0.5 rounded-md capitalize font-medium transition-colors cursor-pointer ${
                signalFilter === filter
                  ? 'bg-[#1E293B] text-sky-400 font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* Signals Feed Stream */}
      <div className="flex-1 overflow-y-auto divide-y divide-[#1E293B]/60 p-1">
        {filteredSignals.map((signal) => (
          <div
            key={signal.id}
            onClick={() => setSelectedFacilityId(signal.facilityId)}
            className="p-3 rounded-md hover:bg-[#15233D] cursor-pointer transition-all space-y-1.5 group"
          >
            {/* Top metadata line */}
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <div className="flex items-center gap-2">
                {getSeverityBadge(signal.severity)}
                <span className="text-slate-200 font-semibold truncate max-w-[180px]">
                  {signal.facilityName}
                </span>
              </div>
              <div className="flex items-center gap-1 text-slate-400 shrink-0">
                <Clock className="w-3 h-3 text-slate-500" />
                <span>{signal.timeAgo}</span>
              </div>
            </div>

            {/* Signal Message */}
            <p className="text-xs text-slate-300 leading-relaxed group-hover:text-slate-100">
              {signal.message}
            </p>

            {/* Telemetry Footer */}
            <div className="flex items-center justify-between text-[11px] pt-0.5 text-slate-400">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500">Source:</span>
                <span className="text-sky-400 font-medium">{signal.agency}</span>
              </div>
              {signal.metricValue && (
                <span className="text-amber-400 font-mono font-medium">{signal.metricValue}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
