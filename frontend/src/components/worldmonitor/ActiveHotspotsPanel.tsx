import React from 'react';
import { Flame, ArrowUpRight } from 'lucide-react';
import { DEMO_FACILITIES } from '../../data/demo/facilities';
import { useDashboardStore } from '../../stores/dashboardStore';
import { hotspotScore } from '../../utils/environmentalIntelligence';

export const ActiveHotspotsPanel: React.FC = () => {
  const { selectedFacilityId, setSelectedFacilityId, scenario } = useDashboardStore();

  // Sort facilities by overall risk score descending
  const sortedHotspots = [...DEMO_FACILITIES].sort((a, b) => hotspotScore(b, scenario) - hotspotScore(a, scenario));

  return (
    <div className="bg-[#0F172A]/90 border border-[#1E293B] rounded-lg flex flex-col h-full overflow-hidden text-xs font-sans select-none shadow-sm">
      {/* Panel Header */}
      <div className="h-10 px-3.5 bg-[#111A2E] border-b border-[#1E293B] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Flame className="w-4 h-4 text-rose-400" />
          <span className="font-semibold text-slate-100 text-xs">
            Environmental Hotspots
          </span>
          <span className="text-[10px] text-rose-400 bg-rose-950/70 border border-rose-800/60 px-1.5 py-0.2 rounded font-medium">
            Top Stress
          </span>
        </div>
        <span className="text-[11px] text-slate-400">Sorted by Risk Score</span>
      </div>

      {/* Hotspots List */}
      <div className="flex-1 overflow-y-auto divide-y divide-[#1E293B]/60 p-1">
        {sortedHotspots.slice(0, 10).map((facility, index) => {
          const isSelected = facility.id === selectedFacilityId;
          const score = hotspotScore(facility, scenario);

          return (
            <div
              key={facility.id}
              onClick={() => setSelectedFacilityId(facility.id)}
              className={`p-3 rounded-md hover:bg-[#15233D] cursor-pointer transition-all space-y-2 ${
                isSelected ? 'bg-[#15233D] border-l-2 border-sky-400 shadow-sm' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5">
                  <span className="text-xs text-slate-500 font-mono font-bold w-4 shrink-0 mt-0.5">
                    #{index + 1}
                  </span>
                  <div>
                    <h4 className="font-semibold text-slate-100 text-xs leading-snug">
                      {facility.name}
                    </h4>
                    <span className="text-[11px] text-slate-400">
                      {facility.district}, {facility.state} •{' '}
                      <span className="capitalize">{facility.type.replace('_', ' ')}</span>
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span
                    className={`font-bold text-sm font-mono block ${
                      score >= 80
                        ? 'text-rose-400'
                        : score >= 65
                        ? 'text-amber-400'
                        : score >= 45
                        ? 'text-sky-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    {score}/100
                  </span>
                  <span className="text-[10px] text-slate-400 flex items-center justify-end gap-0.5">
                    <ArrowUpRight className="w-2.5 h-2.5 text-rose-400" />
                    <span>+{(score * 0.04).toFixed(1)}% 7d</span>
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-[#1E293B] h-1.5 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    score >= 80
                      ? 'bg-rose-500'
                      : score >= 65
                      ? 'bg-amber-400'
                      : score >= 45
                      ? 'bg-sky-400'
                      : 'bg-emerald-400'
                  }`}
                  style={{ width: `${score}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-500">
                <span>Source: {facility.provenance.sourceOrganization}</span>
                <span className={facility.provenance.dataStatus === 'synthetic' ? 'text-amber-300' : 'text-emerald-300'}>{facility.provenance.dataStatus} · {facility.provenance.confidenceScore}%</span>
              </div>

              {/* Indicators preview */}
              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
                <span>Water: {facility.indicators.waterStress}%</span>
                <span>Grid: {facility.indicators.gridPressure}%</span>
                <span>Air: {facility.indicators.airPollution} µg/m³</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
