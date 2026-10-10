import React from 'react';
import { ShieldCheck, Activity, Database } from 'lucide-react';
import { useDashboardStore } from '../../stores/dashboardStore';

export const StatusBar: React.FC = () => {
  const { viewport, selectedFacility } = useDashboardStore();

  return (
    <footer className="h-7 bg-[#080D1A] border-t border-[#1E293B] px-4 flex items-center justify-between text-xs text-slate-400 font-sans z-30 select-none shrink-0">
      {/* Left: System Status & Viewport readout */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-emerald-400">
          <Activity className="w-3 h-3 animate-pulse" />
          <span className="font-medium text-[11px]">Demo Telemetry Online</span>
        </div>

        <div className="hidden sm:flex items-center gap-1 text-slate-400 border-l border-[#1E293B] pl-3 font-mono text-[11px]">
          <span>VIEWPORT:</span>
          <span className="text-slate-300">
            {viewport.latitude.toFixed(2)}°N, {viewport.longitude.toFixed(2)}°E
          </span>
        </div>
      </div>

      {/* Center: Infrastructure Marker Color Legend */}
      <div className="hidden md:flex items-center gap-4 text-[11px]">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-sky-400" />
          <span className="text-slate-300">Data Centre</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-rose-500" />
          <span className="text-slate-300">Thermal Power</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="text-slate-300">Renewable Energy</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          <span className="text-slate-300">Substation</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-purple-400" />
          <span className="text-slate-300">Industrial</span>
        </div>
      </div>

      {/* Right: Telemetry sync and verification tag */}
      <div className="flex items-center gap-3 text-[11px]">
        {selectedFacility && (
          <span className="text-slate-300 truncate max-w-[200px] hidden xl:inline">
            Selected: <span className="text-white font-medium">{selectedFacility.name}</span>
          </span>
        )}
        <div className="flex items-center gap-1 text-slate-400">
          <Database className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-amber-300">Demo Dataset</span>
        </div>
        <div className="hidden sm:flex items-center gap-1 text-slate-400">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Attribution Ready</span>
        </div>
      </div>
    </footer>
  );
};
