import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  BarChart3,
  ChevronDown,
  Droplets,
  ExternalLink,
  Flame,
  GripVertical,
  Leaf,
  LineChart,
  Radio,
  RotateCcw,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  Thermometer,
  X,
  Zap,
  FlaskConical,
} from 'lucide-react';
import { ActiveHotspotsPanel } from './ActiveHotspotsPanel';
import { LiveSignalsWirePanel } from './LiveSignalsWirePanel';
import { MacroTelemetryPanel } from './MacroTelemetryPanel';
import { MainMap } from '../map/MainMap';
import type { WorldMonitorLayerKey } from '../../types';
import { useDashboardStore } from '../../stores/dashboardStore';
import { ScenarioEngine } from './ScenarioEngine';
import { DataQualityBanner } from './DataQualityBanner';
import { PolicyNewsPanel } from './PolicyNewsPanel';

type PanelId = 'hotspots' | 'signals' | 'telemetry' | 'risk' | 'forecast' | 'mitigation' | 'news';

interface PanelDefinition {
  id: PanelId;
  title: string;
  status: string;
  icon: React.ReactNode;
  accent: string;
  content: React.ReactNode;
}

const WORKSPACES: {
  id: string;
  label: string;
  description: string;
  layers: WorldMonitorLayerKey[];
  panels: PanelId[];
}[] = [
  {
    id: 'command',
    label: 'Command Center',
    description: 'All-India environmental situation picture',
    layers: ['hotspots', 'weather', 'outages', 'natural', 'waterways', 'economic'],
    panels: ['hotspots', 'signals', 'telemetry', 'risk', 'news'],
  },
  {
    id: 'water',
    label: 'Water Security',
    description: 'Aquifer stress, demand, and exposure',
    layers: ['hotspots', 'waterways', 'natural', 'weather'],
    panels: ['hotspots', 'telemetry', 'forecast', 'mitigation'],
  },
  {
    id: 'grid',
    label: 'Grid Resilience',
    description: 'Grid pressure, outages, and capacity',
    layers: ['hotspots', 'outages', 'economic', 'weather'],
    panels: ['signals', 'telemetry', 'risk', 'forecast'],
  },
  {
    id: 'datacenter',
    label: 'Data Centre Screening',
    description: 'Cooling, power, heat, and population exposure',
    layers: ['hotspots', 'bases', 'weather', 'outages', 'natural'],
    panels: ['hotspots', 'risk', 'forecast', 'mitigation'],
  },
  {
    id: 'renewables',
    label: 'Renewable Expansion',
    description: 'Land, biodiversity, water, and grid context',
    layers: ['hotspots', 'natural', 'waterways', 'economic'],
    panels: ['hotspots', 'telemetry', 'risk', 'mitigation'],
  },
];

const PANEL_META: Record<PanelId, Omit<PanelDefinition, 'content'>> = {
  hotspots: {
    id: 'hotspots',
    title: 'ENVIRONMENTAL HOTSPOTS',
    status: 'DEMO · RISK SORTED',
    icon: <Flame className="h-3.5 w-3.5" />,
    accent: 'text-rose-400',
  },
  signals: {
    id: 'signals',
    title: 'FACILITY SIGNALS',
    status: 'DEMO · 4 ALERTS',
    icon: <Radio className="h-3.5 w-3.5" />,
    accent: 'text-sky-400',
  },
  telemetry: {
    id: 'telemetry',
    title: 'MACRO TELEMETRY',
    status: 'SYNTHETIC · 7D',
    icon: <BarChart3 className="h-3.5 w-3.5" />,
    accent: 'text-emerald-400',
  },
  risk: {
    id: 'risk',
    title: 'RISK POSTURE',
    status: 'SCREENING · 20 ASSETS',
    icon: <ShieldAlert className="h-3.5 w-3.5" />,
    accent: 'text-amber-400',
  },
  forecast: {
    id: 'forecast',
    title: 'ENVIRONMENTAL FORECASTS',
    status: 'SYNTHETIC · MODEL V1',
    icon: <LineChart className="h-3.5 w-3.5" />,
    accent: 'text-violet-400',
  },
  mitigation: {
    id: 'mitigation',
    title: 'MITIGATION ACTIONS',
    status: 'AI-ASSISTED · REVIEW',
    icon: <Sparkles className="h-3.5 w-3.5" />,
    accent: 'text-cyan-400',
  },
  news: {
    id: 'news',
    title: 'POLICY & ENVIRONMENTAL NEWS',
    status: 'INTERNET · RSS',
    icon: <Radio className="h-3.5 w-3.5" />,
    accent: 'text-emerald-300',
  },
};

const RiskPosture: React.FC = () => {
  const navigate = useNavigate();
  const items = [
    ['Water stress', 'High', 'bg-amber-400', '74%'],
    ['Grid pressure', 'Elevated', 'bg-sky-400', '62%'],
    ['Air quality', 'Critical', 'bg-rose-400', '58%'],
    ['Heat exposure', 'Elevated', 'bg-orange-400', '51%'],
  ];

  return (
    <div className="space-y-2.5 p-3">
      <div className="flex items-end justify-between border-b border-[#263447] pb-2">
        <div>
          <div className="text-2xl font-semibold tracking-tight text-slate-100">68<span className="text-sm text-slate-500">/100</span></div>
          <div className="text-[10px] uppercase tracking-widest text-slate-500">Weighted screening posture</div>
        </div>
        <span className="rounded border border-amber-500/40 bg-amber-950/50 px-1.5 py-0.5 text-[10px] text-amber-300">ELEVATED</span>
      </div>
      {items.map(([label, status, color, value]) => (
        <div key={label} className="space-y-1">
          <div className="flex justify-between text-[10px]">
            <span className="text-slate-300">{label}</span>
            <span className="text-slate-500">{status} · {value}</span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-[#172131]"><div className={`h-full ${color}`} style={{ width: value }} /></div>
        </div>
      ))}
      <button type="button" onClick={() => navigate('/risk-analysis')} className="mt-1 flex items-center gap-1 text-[10px] text-sky-400 hover:text-sky-300">
        Open explainable risk analysis <ExternalLink className="h-3 w-3" />
      </button>
    </div>
  );
};

const ForecastSummary: React.FC = () => {
  const navigate = useNavigate();
  return (
    <div className="space-y-3 p-3">
      <div className="rounded border border-violet-500/20 bg-violet-950/15 p-2.5">
        <div className="flex items-center justify-between text-[10px] text-slate-400"><span>Groundwater stress · Maharashtra</span><span className="text-violet-300">12 MONTHS</span></div>
        <div className="mt-2 flex items-end gap-2"><span className="text-xl font-semibold text-slate-100">+8.4%</span><span className="text-[10px] text-rose-400">projected stress</span></div>
        <div className="mt-2 flex h-9 items-end gap-1">{[32, 38, 41, 47, 54, 61, 70, 78].map((h, i) => <span key={i} className={`flex-1 rounded-t ${i > 4 ? 'bg-violet-400/70' : 'bg-slate-600'}`} style={{ height: `${h}%` }} />)}</div>
      </div>
      <div className="flex items-center justify-between text-[10px] text-slate-500"><span>Illustrative forecast · demo-v1</span><button type="button" onClick={() => navigate('/forecast')} className="text-sky-400 hover:text-sky-300">Open forecasts →</button></div>
    </div>
  );
};

const MitigationSummary: React.FC = () => {
  const navigate = useNavigate();
  return (
    <div className="space-y-2 p-3">
      {[['Reclaimed-water feasibility', 'HIGH', Droplets], ['Dual-feed and BESS study', 'HIGH', Zap], ['Cool-roof and green buffer', 'MODERATE', Thermometer]].map(([label, priority, Icon]) => (
        <div key={label as string} className="flex items-center gap-2 rounded border border-[#263447] bg-[#111827]/70 p-2">
          <Icon className="h-3.5 w-3.5 text-cyan-400" />
          <div className="min-w-0 flex-1"><div className="truncate text-[11px] text-slate-200">{label as string}</div><div className="text-[9px] uppercase tracking-wider text-slate-500">Structured recommendation</div></div>
          <span className="text-[9px] text-amber-300">{priority as string}</span>
        </div>
      ))}
      <button type="button" onClick={() => navigate('/mitigation')} className="flex items-center gap-1 pt-1 text-[10px] text-sky-400 hover:text-sky-300">Open mitigation planner <ExternalLink className="h-3 w-3" /></button>
    </div>
  );
};

export const EcoWorkspace: React.FC = () => {
  const { setAllWmLayers, setWmLayer } = useDashboardStore();
  const [workspaceId, setWorkspaceId] = useState('command');
  const [closedPanels, setClosedPanels] = useState<PanelId[]>([]);
  const [isMissionOpen, setIsMissionOpen] = useState(false);
  const [isPanelGuideOpen, setIsPanelGuideOpen] = useState(false);
  const [isScenarioOpen, setIsScenarioOpen] = useState(false);

  const workspace = WORKSPACES.find((item) => item.id === workspaceId) || WORKSPACES[0];
  const panels = useMemo(() => {
    const content: Record<PanelId, React.ReactNode> = {
      hotspots: <ActiveHotspotsPanel />,
      signals: <LiveSignalsWirePanel />,
      telemetry: <MacroTelemetryPanel />,
      risk: <RiskPosture />,
      forecast: <ForecastSummary />,
      mitigation: <MitigationSummary />,
      news: <PolicyNewsPanel />,
    };
    return workspace.panels.filter((id) => !closedPanels.includes(id)).map((id) => ({ ...PANEL_META[id], content: content[id] }));
  }, [closedPanels, workspace.panels]);

  const applyWorkspace = (id: string) => {
    const next = WORKSPACES.find((item) => item.id === id) || WORKSPACES[0];
    setWorkspaceId(next.id);
    setClosedPanels([]);
    setAllWmLayers(false);
    next.layers.forEach((layer) => setWmLayer(layer, true));
    setIsMissionOpen(false);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-t border-[#1E293B] bg-[#080D1A]">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-[#1E293B] bg-[#0B1220] px-3 text-xs">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setIsMissionOpen((value) => !value)} className={`flex items-center gap-2 rounded border px-2.5 py-1 font-medium transition-colors ${isMissionOpen ? 'border-emerald-500/50 bg-emerald-950/40 text-emerald-300' : 'border-[#263447] bg-[#111827] text-slate-300 hover:text-white'}`}>
            <Leaf className="h-3.5 w-3.5 text-emerald-400" />
            <span>MISSION</span><span className="text-slate-500">{workspace.label}</span><ChevronDown className="h-3 w-3" />
          </button>
          <span className="hidden text-[10px] text-slate-500 md:inline">{workspace.description}</span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-slate-500"><button type="button" onClick={() => setIsScenarioOpen((value) => !value)} className="flex items-center gap-1 rounded border border-[#294033] px-2 py-1 text-emerald-300 hover:bg-[#182a20]"><FlaskConical className="h-3 w-3" /> SCENARIO</button><span className="hidden sm:flex items-center gap-1"><Activity className="h-3 w-3 text-emerald-400" /> DEMO WORKSPACE</span><span className="hidden sm:inline">·</span><span className="hidden sm:inline">{panels.length} panels active</span></div>
      </div>

      {isMissionOpen && (
        <div className="absolute z-40 mt-10 w-72 rounded-b border border-[#263447] bg-[#0B1220] p-2 shadow-2xl">
          <div className="mb-2 flex items-center justify-between border-b border-[#263447] px-1 pb-2"><span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Choose workspace</span><button type="button" onClick={() => setIsMissionOpen(false)}><X className="h-3.5 w-3.5 text-slate-500" /></button></div>
          <div className="space-y-1">{WORKSPACES.map((item) => <button key={item.id} type="button" onClick={() => applyWorkspace(item.id)} className={`w-full rounded px-2.5 py-2 text-left transition-colors ${workspace.id === item.id ? 'bg-[#1E293B] text-emerald-300' : 'text-slate-300 hover:bg-[#172131]'}`}><div className="text-xs font-medium">{item.label}</div><div className="mt-0.5 text-[10px] text-slate-500">{item.description}</div></button>)}</div>
          <button type="button" onClick={() => applyWorkspace('command')} className="mt-2 flex w-full items-center justify-center gap-1 border-t border-[#263447] pt-2 text-[10px] text-slate-500 hover:text-slate-300"><RotateCcw className="h-3 w-3" /> Reset workspace</button>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {isScenarioOpen && <ScenarioEngine onClose={() => setIsScenarioOpen(false)} />}
        <div className="flex min-h-0 flex-[1.05] flex-col border-b border-[#263447] bg-[#070C14]">
          <div className="flex h-8 shrink-0 items-center justify-between border-b border-[#1E293B] px-3 text-[10px] uppercase tracking-widest text-slate-500"><span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> India environmental situation</span><span>Map · layers · selection</span></div>
          <div className="relative flex-1 overflow-hidden p-2"><div className="h-full overflow-hidden rounded border border-[#1E293B]"><MainMap /></div><div aria-hidden="true" className="pointer-events-none absolute inset-2 z-[2] opacity-[0.06]" style={{ backgroundImage: 'linear-gradient(rgba(126,174,137,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(126,174,137,.5) 1px, transparent 1px)', backgroundSize: '48px 48px', maskImage: 'linear-gradient(to bottom, black, transparent 85%)' }} /><div aria-hidden="true" className="pointer-events-none absolute inset-2 z-[2] rounded bg-[radial-gradient(circle_at_center,transparent_45%,rgba(36,64,43,.20)_100%)]" /></div>
          <DataQualityBanner />
        </div>
        <div className="flex min-h-0 flex-[0.95] flex-col bg-[#080D16]">
          <div className="flex h-8 shrink-0 items-center justify-between border-b border-[#1E293B] px-3"><span className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-slate-400"><SlidersHorizontal className="h-3 w-3 text-sky-400" /> Intelligence panels</span><button type="button" onClick={() => setIsPanelGuideOpen((value) => !value)} className="text-[10px] text-slate-500 hover:text-slate-300">{isPanelGuideOpen ? 'Hide guide' : 'Panel guide'}</button></div>
          {isPanelGuideOpen && <div className="border-b border-[#263447] bg-[#0B1220] px-3 py-2 text-[10px] text-slate-500">Panels are designed to be source-aware. Close cards that are not relevant to the current mission; each card links to the detailed EcoSite Terminal view.</div>}
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 overflow-y-auto p-2 md:grid-cols-2 xl:grid-cols-4">
            {panels.map((panel) => <section key={panel.id} className="flex min-h-[150px] min-w-0 flex-col overflow-hidden rounded border border-[#263447] bg-[#0F172A] shadow-lg"><div className="flex h-8 shrink-0 items-center justify-between border-b border-[#263447] bg-[#111827] px-2.5"><div className={`flex min-w-0 items-center gap-1.5 ${panel.accent}`}><GripVertical className="h-3 w-3 cursor-grab text-slate-600" />{panel.icon}<span className="truncate text-[10px] font-semibold tracking-wide">{panel.title}</span></div><div className="flex items-center gap-1"><span className="hidden text-[9px] text-slate-600 xl:inline">{panel.status}</span><button type="button" onClick={() => setClosedPanels((current) => [...current, panel.id])} className="rounded p-0.5 text-slate-600 hover:bg-[#1E293B] hover:text-slate-300" title={`Close ${panel.title}`}><X className="h-3 w-3" /></button></div></div><div className="min-h-0 flex-1 overflow-y-auto">{panel.content}</div></section>)}
            {panels.length < 4 && <button type="button" onClick={() => setClosedPanels([])} className="flex min-h-[150px] flex-col items-center justify-center rounded border border-dashed border-[#263447] text-slate-600 hover:border-sky-500/50 hover:text-sky-400"><span className="text-2xl">+</span><span className="text-[10px] uppercase tracking-widest">Restore panels</span></button>}
          </div>
        </div>
      </div>
    </div>
  );
};
