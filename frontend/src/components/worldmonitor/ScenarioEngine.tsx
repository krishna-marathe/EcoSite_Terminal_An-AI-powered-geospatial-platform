import React, { useState } from 'react';
import { FlaskConical, Play, RotateCcw, X } from 'lucide-react';
import { useDashboardStore } from '../../stores/dashboardStore';
import type { ScenarioType } from '../../types';

const SCENARIOS: { type: ScenarioType; label: string; description: string }[] = [
  { type: 'water_reduction', label: 'Water availability reduction', description: 'Reduce available water for cooling and operations.' },
  { type: 'heatwave', label: 'Extreme heatwave', description: 'Increase heat exposure and cooling demand.' },
  { type: 'grid_curtailment', label: 'Grid curtailment', description: 'Reduce available grid capacity around assets.' },
  { type: 'flood_event', label: 'Flood event', description: 'Increase flood exposure around vulnerable facilities.' },
];

export const ScenarioEngine: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { scenario, setScenario } = useDashboardStore();
  const [type, setType] = useState<ScenarioType>(scenario?.type || 'water_reduction');
  const [severity, setSeverity] = useState(scenario?.severity || 30);

  return (
    <div className="absolute left-3 top-11 z-50 w-[min(360px,calc(100vw-24px))] rounded-lg border border-[#294033] bg-[#122018]/95 p-3 shadow-2xl backdrop-blur-xl">
      <div className="mb-3 flex items-center justify-between border-b border-[#294033] pb-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-100"><FlaskConical className="h-4 w-4 text-emerald-300" /> Scenario engine <span className="text-[10px] font-normal text-slate-500">what-if analysis</span></div>
        <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-200" aria-label="Close scenario engine"><X className="h-4 w-4" /></button>
      </div>
      <div className="space-y-2">
        {SCENARIOS.map((item) => <button key={item.type} type="button" onClick={() => setType(item.type)} className={`w-full rounded border px-2.5 py-2 text-left ${type === item.type ? 'border-emerald-400/60 bg-emerald-950/30 text-emerald-200' : 'border-[#294033] text-slate-300 hover:bg-[#182a20]'}`}><div className="text-[11px] font-medium">{item.label}</div><div className="mt-0.5 text-[10px] text-slate-500">{item.description}</div></button>)}
      </div>
      <label className="mt-3 block text-[10px] uppercase tracking-widest text-slate-500">Severity · {severity}%<input aria-label="Scenario severity" className="mt-2 w-full accent-emerald-300" type="range" min="10" max="80" step="5" value={severity} onChange={(event) => setSeverity(Number(event.target.value))} /></label>
      <div className="mt-3 flex gap-2"><button type="button" onClick={() => setScenario({ type, severity })} className="flex flex-1 items-center justify-center gap-1.5 rounded bg-emerald-400/80 px-2 py-1.5 text-[11px] font-semibold text-[#0b1510] hover:bg-emerald-300"><Play className="h-3 w-3" /> Apply scenario</button><button type="button" onClick={() => setScenario(null)} className="rounded border border-[#294033] px-2 text-slate-400 hover:bg-[#182a20]" title="Clear scenario"><RotateCcw className="h-3 w-3" /></button></div>
      {scenario && <div className="mt-2 rounded border border-emerald-400/20 bg-emerald-950/20 p-2 text-[10px] text-emerald-200">Scenario active. Hotspot scores and facility dossier indicators now reflect a {scenario.severity}% stress adjustment.</div>}
    </div>
  );
};
