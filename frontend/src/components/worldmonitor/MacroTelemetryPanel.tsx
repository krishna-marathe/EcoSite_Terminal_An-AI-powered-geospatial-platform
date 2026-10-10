import React from 'react';
import { DEMO_FACILITIES } from '../../data/demo/facilities';

export const MacroTelemetryPanel: React.FC = () => {
  const totalCapacityMw = DEMO_FACILITIES.reduce((acc, f) => acc + (f.capacityMw || 0), 0);
  const avgRiskScore = Math.round(
    DEMO_FACILITIES.reduce((acc, f) => acc + f.overallRiskScore, 0) / DEMO_FACILITIES.length
  );
  const totalPop5km = DEMO_FACILITIES.reduce(
    (acc, f) => acc + (f.nearbyPopulation.radius5km || 0),
    0
  );

  const metrics = [
    {
      label: 'Monitored Capacity',
      value: `${(totalCapacityMw / 1000).toFixed(1)} GW`,
      badge: '+4.2% YoY',
      badgeClass: 'text-sky-400 bg-sky-950/60 border-sky-800/60',
      sub: 'Grid-Connected Base',
    },
    {
      label: 'Mean Aquifer Draft',
      value: '74.2%',
      badge: 'Critical',
      badgeClass: 'text-rose-400 bg-rose-950/60 border-rose-800/60',
      sub: 'CGWB Assessment Stage',
    },
    {
      label: 'Peak Grid Stress',
      value: '84.6%',
      badge: '15.4% Headroom',
      badgeClass: 'text-amber-400 bg-amber-950/60 border-amber-800/60',
      sub: 'Transmission Corridor',
    },
    {
      label: 'National Risk Index',
      value: `${avgRiskScore}/100`,
      badge: 'Elevated',
      badgeClass: 'text-amber-400 bg-amber-950/60 border-amber-800/60',
      sub: 'Compound Geospatial',
    },
    {
      label: 'Buffer Population',
      value: `${(totalPop5km / 1000000).toFixed(1)}M`,
      badge: '5km Radius',
      badgeClass: 'text-purple-400 bg-purple-950/60 border-purple-800/60',
      sub: 'Human Exposure Zone',
    },
    {
      label: 'Clean RE Capacity',
      value: '12.7 GW',
      badge: '+18.4% RE',
      badgeClass: 'text-emerald-400 bg-emerald-950/60 border-emerald-800/60',
      sub: 'Solar & Wind Parks',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 select-none font-sans">
      {metrics.map((m, idx) => (
        <div
          key={idx}
          className="bg-[#0F172A]/90 border border-[#1E293B] rounded-lg p-3 flex flex-col justify-between hover:border-slate-600 transition-colors shadow-sm"
        >
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="font-medium truncate">{m.label}</span>
            <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded border ${m.badgeClass}`}>
              {m.badge}
            </span>
          </div>

          <div className="text-xl font-bold tracking-tight text-slate-100 font-mono my-0.5">
            {m.value}
          </div>

          <div className="text-[11px] text-slate-400 truncate">{m.sub}</div>
        </div>
      ))}
    </div>
  );
};
