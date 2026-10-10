import React from 'react';
import {
  Building2,
  Server,
  Zap,
  Sun,
  AlertTriangle,
  MapPin,
} from 'lucide-react';
import { DEMO_FACILITIES } from '../../data/demo/facilities';

export const DashboardStatsBar: React.FC = () => {

  // Dynamically compute stats from dataset
  const totalFacilities = DEMO_FACILITIES.length;
  const dataCentresCount = DEMO_FACILITIES.filter((f) => f.type === 'data_centre').length;
  const thermalPowerCount = DEMO_FACILITIES.filter((f) => f.type === 'thermal_power').length;
  const renewableCount = DEMO_FACILITIES.filter(
    (f) => f.type === 'solar_farm' || f.type === 'wind_farm' || f.type === 'hydro_power'
  ).length;
  const criticalRiskCount = DEMO_FACILITIES.filter(
    (f) => f.riskLevel === 'critical' || f.riskLevel === 'high'
  ).length;

  const statesCovered = new Set(DEMO_FACILITIES.map((f) => f.state)).size;

  const stats = [
    {
      label: 'Mapped Facilities',
      value: totalFacilities,
      icon: <Building2 className="w-3.5 h-3.5 text-slate-400" />,
      subtext: 'Pan-India Register',
    },
    {
      label: 'Data Centres',
      value: dataCentresCount,
      icon: <Server className="w-3.5 h-3.5 text-sky-400" />,
      subtext: '560+ MW IT Load',
    },
    {
      label: 'Thermal Stations',
      value: thermalPowerCount,
      icon: <Zap className="w-3.5 h-3.5 text-rose-400" />,
      subtext: '4.0 GW Base Capacity',
    },
    {
      label: 'Renewables & Hydro',
      value: renewableCount,
      icon: <Sun className="w-3.5 h-3.5 text-emerald-400" />,
      subtext: '12.7 GW Green Power',
    },
    {
      label: 'High/Critical Risk',
      value: criticalRiskCount,
      icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />,
      subtext: 'Assessment Required',
    },
    {
      label: 'States Monitored',
      value: statesCovered,
      icon: <MapPin className="w-3.5 h-3.5 text-purple-400" />,
      subtext: 'National Coverage',
    },
  ];

  return (
    <div className="h-12 bg-[#080D16] border-b border-[#263447] px-4 flex items-center justify-between overflow-x-auto z-20 shrink-0 select-none divide-x divide-[#263447]/60">
      {stats.map((stat, i) => (
        <div key={i} className="flex items-center gap-2.5 px-3 first:pl-0 last:pr-0 whitespace-nowrap">
          <div className="w-7 h-7 rounded bg-[#111827] border border-[#263447] flex items-center justify-center shrink-0">
            {stat.icon}
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-sm font-bold text-slate-100 font-mono tracking-tight leading-none">
                {stat.value}
              </span>
              <span className="text-[11px] font-medium text-slate-400 leading-none">
                {stat.label}
              </span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
              {stat.subtext}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};
