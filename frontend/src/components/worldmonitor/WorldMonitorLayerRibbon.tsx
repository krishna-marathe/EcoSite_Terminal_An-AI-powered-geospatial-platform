import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Server,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { WM_LAYER_CATALOG } from '../../data/demo/wmLayers';
import { useDashboardStore } from '../../stores/dashboardStore';
import type { WorldMonitorLayerKey } from '../../types';

const ICON_MAP: Record<string, React.ReactNode> = {
  Server: <Server className="h-3 w-3" />,
};

// The legacy store contains keys for several infrastructure types. This view is
// deliberately scoped to the single tracked asset class without migrating that
// persisted state.
const DATA_CENTRE_LAYERS = WM_LAYER_CATALOG.filter((layer) => layer.key === 'bases');

export interface WorldMonitorLayerRibbonProps {
  /** Marker total from the public data-centre registry that feeds the map. */
  dataCentreCount?: number;
}

export const WorldMonitorLayerRibbon: React.FC<WorldMonitorLayerRibbonProps> = ({ dataCentreCount }) => {
  const { wmLayers, toggleWmLayer } = useDashboardStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isExpanded, setIsExpanded] = useState(false);

  const handleToggle = (key: WorldMonitorLayerKey) => {
    toggleWmLayer(key);

    const nextLayers = { ...wmLayers, [key]: !wmLayers[key] };
    const activeKeys = DATA_CENTRE_LAYERS
      .filter((layer) => nextLayers[layer.key])
      .map((layer) => layer.key)
      .join(',');

    const newParams = new URLSearchParams(searchParams);
    if (activeKeys) {
      newParams.set('layers', activeKeys);
    } else {
      newParams.delete('layers');
    }
    setSearchParams(newParams, { replace: true });
  };

  const activeCount = DATA_CENTRE_LAYERS.filter((layer) => wmLayers[layer.key]).length;
  const totalCount = DATA_CENTRE_LAYERS.length;

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
            <span>Data centre markers</span>
            <span className="rounded-sm border border-eco-primary/40 bg-eco-primary/10 px-1.5 py-0.5 font-mono text-micro text-eco-primary">
              {activeCount}/{totalCount} selected
            </span>
          </button>

          {!isExpanded && (
            <div className="hidden max-w-xl items-center gap-1 truncate md:flex">
              <span className="text-eco-muted">Selected:</span>
              {DATA_CENTRE_LAYERS.filter((l) => wmLayers[l.key])
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
                  title="Show data centre marker controls"
                  className="cursor-pointer font-mono text-micro text-eco-muted underline-offset-2 hover:text-eco-primary hover:underline"
                >
                  +{activeCount - 6} more
                </button>
              )}
            </div>
          )}
        </div>

        <span className="hidden text-eco-muted lg:inline">Context layers are managed in Layers &amp; filters</span>
      </div>

      {isExpanded && (
        <div className="border-t border-eco-border/60 pb-2.5 pt-2">
          <p className="mb-2 text-eco-muted">This is the only tracked facility layer. AQI, water, heat, hazard, biodiversity and grid overlays are contextual planning evidence.</p>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2">
            {DATA_CENTRE_LAYERS.map((layer) => {
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
                    {ICON_MAP[layer.iconName] || <Server className="h-3 w-3" />}
                  </span>
                  <span>{layer.shortLabel}</span>
                  <span
                    className={`rounded-sm px-1 font-mono text-micro ${
                      isActive ? 'border border-eco-border bg-eco-bg text-eco-primary' : 'text-eco-muted'
                    }`}
                  >
                    {dataCentreCount ?? '—'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
