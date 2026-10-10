import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Flame,
  Droplets,
  Server,
  Zap,
  Radio,
  Wind,
  Sun,
  Activity,
  Waves,
  ShieldAlert,
  Compass,
  TreePine,
  CheckCheck,
  XCircle,
  ChevronDown,
  ChevronUp,
  Search,
} from 'lucide-react';
import { WM_LAYER_CATALOG } from '../../data/demo/wmLayers';
import { useDashboardStore } from '../../stores/dashboardStore';
import type { WorldMonitorLayerKey } from '../../types';

const ICON_MAP: Record<string, React.ReactNode> = {
  Flame: <Flame className="w-3 h-3" />,
  Droplets: <Droplets className="w-3 h-3" />,
  Server: <Server className="w-3 h-3" />,
  Zap: <Zap className="w-3 h-3" />,
  Radio: <Radio className="w-3 h-3" />,
  Wind: <Wind className="w-3 h-3" />,
  Sun: <Sun className="w-3 h-3" />,
  Activity: <Activity className="w-3 h-3" />,
  Waves: <Waves className="w-3 h-3" />,
  ShieldAlert: <ShieldAlert className="w-3 h-3" />,
  Compass: <Compass className="w-3 h-3" />,
  TreePine: <TreePine className="w-3 h-3" />,
};

export const WorldMonitorLayerRibbon: React.FC = () => {
  const { wmLayers, toggleWmLayer, setAllWmLayers } = useDashboardStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isExpanded, setIsExpanded] = useState(false);
  const [catalogQuery, setCatalogQuery] = useState('');

  const handleToggle = (key: WorldMonitorLayerKey) => {
    toggleWmLayer(key);

    const nextLayers = { ...wmLayers, [key]: !wmLayers[key] };
    const activeKeys = Object.entries(nextLayers)
      .filter(([, active]) => active)
      .map(([k]) => k)
      .join(',');

    const newParams = new URLSearchParams(searchParams);
    if (activeKeys) {
      newParams.set('layers', activeKeys);
    } else {
      newParams.delete('layers');
    }
    setSearchParams(newParams, { replace: true });
  };

  const handleSetAll = (active: boolean) => {
    setAllWmLayers(active);
    const newParams = new URLSearchParams(searchParams);
    if (active) {
      const allKeys = WM_LAYER_CATALOG.map((l) => l.key).join(',');
      newParams.set('layers', allKeys);
    } else {
      newParams.delete('layers');
    }
    setSearchParams(newParams, { replace: true });
  };

  const activeCount = Object.values(wmLayers).filter(Boolean).length;
  const filteredCatalog = useMemo(() => WM_LAYER_CATALOG.filter((layer) => `${layer.label} ${layer.description} ${layer.source}`.toLowerCase().includes(catalogQuery.toLowerCase())), [catalogQuery]);

  return (
    <div className="bg-[#090E1A]/90 border-b border-[#1E293B] px-3 transition-all z-20 shrink-0 select-none text-xs backdrop-blur-sm">
      {/* Collapsed / Summary Bar */}
      <div className="h-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1.5 text-xs font-medium text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Map Layers</span>
            <span className="text-[10px] text-emerald-400 font-mono bg-emerald-950/80 px-1.5 py-0.2 rounded border border-emerald-800/60">
              {activeCount}/12 active
            </span>
            {isExpanded ? (
              <ChevronUp className="w-3 h-3 text-slate-400" />
            ) : (
              <ChevronDown className="w-3 h-3 text-slate-400" />
            )}
          </button>

          {/* Quick Active Indicators in collapsed mode */}
          {!isExpanded && (
            <div className="hidden md:flex items-center gap-1 text-[11px] text-slate-400 truncate max-w-xl">
              <span className="text-slate-500">Active:</span>
              {WM_LAYER_CATALOG.filter((l) => wmLayers[l.key])
                .slice(0, 6)
                .map((l) => (
                  <span
                    key={l.key}
                    className="px-1.5 py-0.2 rounded text-[10px] bg-[#111A2E] text-slate-300 border border-[#1E293B]"
                  >
                    {l.shortLabel}
                  </span>
                ))}
              {activeCount > 6 && (
                <span className="text-[10px] text-slate-500">+{activeCount - 6} more</span>
              )}
            </div>
          )}
        </div>

        {/* Global Controls */}
        <div className="flex items-center gap-2 text-[11px]">
          <button
            type="button"
            onClick={() => handleSetAll(true)}
            className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-[#111A2E] transition-colors cursor-pointer"
            title="Enable all layers"
          >
            <CheckCheck className="w-3 h-3" />
            <span className="hidden sm:inline">Select All</span>
          </button>
          <span className="text-slate-600">|</span>
          <button
            type="button"
            onClick={() => handleSetAll(false)}
            className="text-slate-400 hover:text-rose-400 flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-[#111A2E] transition-colors cursor-pointer"
            title="Clear all layers"
          >
            <XCircle className="w-3 h-3" />
            <span className="hidden sm:inline">Clear</span>
          </button>
        </div>
      </div>

      {/* Expanded Layer Grid / Pills */}
      {isExpanded && (
        <div className="border-t border-[#1E293B]/60 py-2.5 pt-1">
          <div className="mb-2 flex items-center gap-2 rounded border border-[#294033] bg-[#122018]/60 px-2 py-1">
            <Search className="h-3.5 w-3.5 text-emerald-300" /><input value={catalogQuery} onChange={(event) => setCatalogQuery(event.target.value)} placeholder="Search layers, sources, or hazards" className="min-w-0 flex-1 bg-transparent text-[11px] text-slate-200 outline-none placeholder:text-slate-500" />
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
          {filteredCatalog.map((layer) => {
            const isActive = !!wmLayers[layer.key];
            return (
              <button
                key={layer.key}
                type="button"
                onClick={() => handleToggle(layer.key)}
                title={`${layer.label}: ${layer.description} (${layer.source})`}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border whitespace-nowrap transition-all text-xs cursor-pointer ${
                  isActive
                    ? 'bg-[#15233D] border-sky-500/50 text-slate-100 shadow-sm font-medium'
                    : 'bg-[#0B1220]/60 border-[#1E293B] text-slate-400 hover:text-slate-200 hover:border-slate-600'
                }`}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: layer.color }}
                />
                <span className="shrink-0" style={{ color: isActive ? layer.color : '#64748B' }}>
                  {ICON_MAP[layer.iconName] || <Activity className="w-3 h-3" />}
                </span>
                <span>{layer.shortLabel}</span>
                <span
                  className={`text-[10px] px-1 py-0.2 rounded font-mono ${
                    isActive
                      ? 'bg-[#0A101D] text-sky-300 border border-[#1E293B]'
                      : 'text-slate-500'
                  }`}
                >
                  {layer.count}
                </span>
              </button>
            );
          })}
          {filteredCatalog.length === 0 && <span className="px-2 text-[10px] text-slate-500">No matching layers</span>}
          </div>
        </div>
      )}
    </div>
  );
};
