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
  Flame: <Flame className="h-3 w-3" />,
  Droplets: <Droplets className="h-3 w-3" />,
  Server: <Server className="h-3 w-3" />,
  Zap: <Zap className="h-3 w-3" />,
  Radio: <Radio className="h-3 w-3" />,
  Wind: <Wind className="h-3 w-3" />,
  Sun: <Sun className="h-3 w-3" />,
  Activity: <Activity className="h-3 w-3" />,
  Waves: <Waves className="h-3 w-3" />,
  ShieldAlert: <ShieldAlert className="h-3 w-3" />,
  Compass: <Compass className="h-3 w-3" />,
  TreePine: <TreePine className="h-3 w-3" />,
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
      newParams.set('layers', WM_LAYER_CATALOG.map((l) => l.key).join(','));
    } else {
      newParams.delete('layers');
    }
    setSearchParams(newParams, { replace: true });
  };

  const activeCount = Object.values(wmLayers).filter(Boolean).length;
  const totalCount = WM_LAYER_CATALOG.length;
  const filteredCatalog = useMemo(
    () =>
      WM_LAYER_CATALOG.filter((layer) =>
        `${layer.label} ${layer.description} ${layer.source}`.toLowerCase().includes(catalogQuery.toLowerCase()),
      ),
    [catalogQuery],
  );

  return (
    <div className="z-20 shrink-0 select-none border-b border-eco-border bg-eco-surface/90 px-3 text-meta backdrop-blur-sm">
      <div className="flex h-8 items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex cursor-pointer items-center gap-1.5 text-meta font-medium text-eco-text transition-colors hover:text-eco-primary"
          >
            {isExpanded ? <ChevronUp className="h-3 w-3 text-eco-muted" /> : <ChevronDown className="h-3 w-3 text-eco-muted" />}
            <span>Map layers</span>
            <span className="rounded-sm border border-eco-primary/40 bg-eco-primary/10 px-1.5 py-0.5 font-mono text-micro text-eco-primary">
              {activeCount}/{totalCount} active
            </span>
          </button>

          {!isExpanded && (
            <div className="hidden max-w-xl items-center gap-1 truncate md:flex">
              <span className="text-eco-muted">Active:</span>
              {WM_LAYER_CATALOG.filter((l) => wmLayers[l.key])
                .slice(0, 6)
                .map((l) => (
                  <span key={l.key} className="rounded-sm border border-eco-border bg-eco-surface-secondary px-1.5 py-0.5 font-mono text-micro text-eco-text">
                    {l.shortLabel}
                  </span>
                ))}
              {activeCount > 6 && (
                <button
                  type="button"
                  onClick={() => setIsExpanded(true)}
                  title="Show all layers"
                  className="cursor-pointer font-mono text-micro text-eco-muted underline-offset-2 hover:text-eco-primary hover:underline"
                >
                  +{activeCount - 6} more
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleSetAll(true)}
            className="flex cursor-pointer items-center gap-1 rounded-sm px-1.5 py-0.5 text-eco-primary transition-colors hover:bg-eco-surface-secondary"
            title="Enable all layers"
          >
            <CheckCheck className="h-3 w-3" />
            <span className="hidden sm:inline">Select all</span>
          </button>
          <button
            type="button"
            onClick={() => handleSetAll(false)}
            className="flex cursor-pointer items-center gap-1 rounded-sm px-1.5 py-0.5 text-eco-muted transition-colors hover:bg-eco-surface-secondary hover:text-eco-critical"
            title="Clear all layers"
          >
            <XCircle className="h-3 w-3" />
            <span className="hidden sm:inline">Clear</span>
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-eco-border/60 pb-2.5 pt-2">
          <div className="mb-2 flex items-center gap-2 rounded-sm border border-eco-border bg-eco-surface px-2 py-1">
            <Search className="h-3.5 w-3.5 text-eco-muted" />
            <input
              value={catalogQuery}
              onChange={(event) => setCatalogQuery(event.target.value)}
              placeholder="Search layers, sources, or hazards"
              aria-label="Search map layers"
              className="min-w-0 flex-1 bg-transparent text-meta text-eco-text outline-none placeholder:text-eco-muted"
            />
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2">
            {filteredCatalog.map((layer) => {
              const isActive = !!wmLayers[layer.key];
              return (
                <button
                  key={layer.key}
                  type="button"
                  onClick={() => handleToggle(layer.key)}
                  title={`${layer.label}: ${layer.description} (${layer.source})`}
                  aria-pressed={isActive}
                  className={`flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-sm border px-2.5 py-1 text-meta transition-colors ${
                    isActive
                      ? 'border-eco-primary/40 bg-eco-primary/10 font-medium text-eco-text'
                      : 'border-eco-border bg-eco-surface text-eco-muted hover:border-eco-border hover:text-eco-text'
                  }`}
                >
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: layer.color }} />
                  <span className="shrink-0" style={{ color: isActive ? layer.color : undefined }}>
                    {ICON_MAP[layer.iconName] || <Activity className="h-3 w-3" />}
                  </span>
                  <span>{layer.shortLabel}</span>
                  <span
                    className={`rounded-sm px-1 font-mono text-micro ${
                      isActive ? 'border border-eco-border bg-eco-bg text-eco-primary' : 'text-eco-muted'
                    }`}
                  >
                    {layer.count}
                  </span>
                </button>
              );
            })}
            {filteredCatalog.length === 0 && <span className="px-2 text-eco-muted">No matching layers</span>}
          </div>
        </div>
      )}
    </div>
  );
};
