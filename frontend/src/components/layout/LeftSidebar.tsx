import { layerAvailable, environmentalMessage } from '../../utils/environmentalLayers';
import React, { useEffect, useState } from 'react';
import { Building2, ChevronDown, Droplets, Filter, Flame, Layers, RotateCcw, Search, SlidersHorizontal, X } from 'lucide-react';
import { useDashboardStore } from '../../stores/dashboardStore';
import { DEMO_LAYERS } from '../../data/demo/layers';
import { IconButton } from '../ui/Button';
import { SourceTag } from '../ui/Badge';
import type { RiskLevel } from '../../types';

const DATA_CENTRE_CONTEXT_LAYER_IDS = new Set([
  'layer-data-centres',
  'layer-substations',
  'layer-transmission-lines',
  'env-groundwater-stress',
  'env-air-quality',
  'env-surface-temp',
  'env-flood-susceptibility',
  'env-protected-areas',
  'pred-water-stress',
  'pred-electricity-demand',
  'pred-climate-exposure',
]);

const RISK_TIERS: Array<{ value: RiskLevel | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'critical', label: 'Crit' },
  { value: 'high', label: 'High' },
  { value: 'moderate', label: 'Mod' },
  { value: 'low', label: 'Low' },
];

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  infrastructure: <Building2 className="h-3.5 w-3.5" />,
  environmental: <Droplets className="h-3.5 w-3.5" />,
  predictive: <Flame className="h-3.5 w-3.5" />,
};

export const LeftSidebar: React.FC = () => {
  const {
    dataMode,
    activeLayers,
    layerOpacities,
    toggleLayer,
    setLayerOpacity,
    resetLayers,
    typeFilter,
    setTypeFilter,
    riskFilter,
    setRiskFilter,
    isLeftSidebarOpen,
    toggleLeftSidebar,
  } = useDashboardStore();

  const [searchLayerText, setSearchLayerText] = useState('');
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({
    predictive: false,
    environmental: false,
    infrastructure: false,
  });
  const [expandedOpacityLayerId, setExpandedOpacityLayerId] = useState<string | null>(null);

  useEffect(() => {
    if (typeFilter !== 'data_centre') setTypeFilter('data_centre');
  }, [setTypeFilter, typeFilter]);

  const toggleCategory = (cat: string) => {
    setCollapsedCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  const categories = [
    { id: 'infrastructure', name: 'Data centres & grid context' },
    { id: 'environmental', name: 'Environmental context' },
    { id: 'predictive', name: 'Forecast context' },
  ];

  const filteredLayers = DEMO_LAYERS.filter((layer) => DATA_CENTRE_CONTEXT_LAYER_IDS.has(layer.id)).filter((layer) => {
    if (!searchLayerText.trim()) return true;
    const q = searchLayerText.toLowerCase();
    return (
      layer.name.toLowerCase().includes(q) ||
      layer.description.toLowerCase().includes(q) ||
      layer.category.toLowerCase().includes(q)
    );
  });

  if (!isLeftSidebarOpen) {
    return null;
  }

  return (
    <aside className="absolute inset-y-0 left-0 z-30 flex h-full w-[min(20rem,calc(100vw-3rem))] shrink-0 flex-col border-r border-eco-border bg-eco-surface md:relative md:w-[340px]">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-eco-border px-4">
        <div className="flex items-center gap-2 text-body font-semibold text-eco-text">
          <Layers className="h-4 w-4 text-eco-primary" />
          <span>Layers &amp; filters</span>
        </div>
        <div className="flex items-center gap-1">
          <IconButton label="Reset layers to defaults" icon={<RotateCcw className="h-3.5 w-3.5" />} onClick={resetLayers} />
          <IconButton label="Close panel" icon={<X className="h-4 w-4" />} onClick={toggleLeftSidebar} />
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-eco-muted" />
          <input
            type="text"
            aria-label="Search geospatial layers"
            placeholder="Search geospatial layers"
            value={searchLayerText}
            onChange={(e) => setSearchLayerText(e.target.value)}
            className="h-7 w-full rounded-sm border border-eco-border bg-eco-surface pl-8 pr-2.5 text-meta text-eco-text placeholder:text-eco-muted focus-visible:border-eco-primary/60"
          />
        </div>

        {/* Facility filters */}
        <div className="space-y-3 rounded-md border border-eco-border bg-eco-surface p-3">
          <div className="flex items-center justify-between border-b border-eco-border/60 pb-2">
            <span className="flex items-center gap-1.5 font-mono text-micro uppercase tracking-[0.06em] text-eco-text">
              <Filter className="h-3.5 w-3.5 text-eco-primary" />
              Facility filters
            </span>
            {riskFilter !== 'all' && (
              <button
                type="button"
                onClick={() => {
                  setRiskFilter('all');
                }}
                className="cursor-pointer text-meta text-eco-muted underline-offset-2 hover:text-eco-primary hover:underline"
              >
                Clear
              </button>
            )}
          </div>

          <div className="space-y-1">
            <label htmlFor="filter-type" className="block text-meta text-eco-muted">
              Facility type
            </label>
            <div id="filter-type" className="flex h-7 items-center rounded-sm border border-eco-border bg-eco-surface-secondary px-2.5 text-meta font-medium text-eco-text">
              Data centres (fixed)
            </div>
          </div>

          <div className="space-y-1">
            <span className="block text-meta text-eco-muted">Screening risk tier</span>
            <div className="grid grid-cols-5 gap-1" role="group" aria-label="Screening risk tier">
              {RISK_TIERS.map((tier) => (
                <button
                  key={tier.value}
                  type="button"
                  aria-pressed={riskFilter === tier.value}
                  onClick={() => setRiskFilter(tier.value)}
                  className={`cursor-pointer rounded-sm border py-1 text-center font-mono text-micro uppercase tracking-[0.06em] transition-colors ${
                    riskFilter === tier.value
                      ? 'border-eco-primary/40 bg-eco-primary/10 font-semibold text-eco-primary'
                      : 'border-eco-border text-eco-muted hover:text-eco-text'
                  }`}
                >
                  {tier.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="text-meta text-eco-warning">{environmentalMessage(dataMode)}</p>
        {/* Layer categories */}
        <div className="space-y-3">
          {categories.map((category) => {
            const isCollapsed = collapsedCategories[category.id];
            const categoryLayers = filteredLayers.filter((l) => l.category === category.id);

            if (categoryLayers.length === 0) return null;

            return (
              <div key={category.id} className="overflow-hidden rounded-md border border-eco-border bg-eco-surface">
                <button
                  type="button"
                  onClick={() => toggleCategory(category.id)}
                  aria-expanded={!isCollapsed}
                  className="flex w-full cursor-pointer items-center justify-between border-b border-eco-border bg-eco-surface-secondary/60 px-3 py-2 text-meta font-medium text-eco-text transition-colors hover:bg-eco-surface-secondary"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-eco-muted">{CATEGORY_ICONS[category.id]}</span>
                    <span>{category.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-eco-muted">
                    <span className="rounded-sm border border-eco-border bg-eco-bg px-1.5 font-mono text-micro">
                      {categoryLayers.filter((l) => layerAvailable(l.id, l.category, dataMode) && activeLayers[l.id]).length}/{categoryLayers.length}
                    </span>
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`} />
                  </div>
                </button>

                {!isCollapsed && (
                  <div className="divide-y divide-eco-border/60">
                    {categoryLayers.map((layer) => {
                      const available = layerAvailable(layer.id, layer.category, dataMode);
                      const isActive = available && !!activeLayers[layer.id];
                      const opacity = layerOpacities[layer.id] ?? 1.0;
                      const isOpacityOpen = expandedOpacityLayerId === layer.id;

                      return (
                        <div key={layer.id} className={`p-2.5 transition-colors ${isActive ? 'bg-eco-surface-secondary/40' : 'opacity-90'}`}>
                          <div className="flex items-start justify-between gap-2">
                            <button
                              type="button"
                              disabled={!available}
                              onClick={() => toggleLayer(layer.id)}
                              aria-pressed={isActive}
                              className="group flex flex-1 items-start gap-2 text-left"
                            >
                              <span className="mt-0.5 shrink-0">
                                {isActive ? (
                                  <span
                                    className="flex h-3.5 w-3.5 items-center justify-center rounded-sm border border-current text-micro"
                                    style={{ color: layer.color }}
                                  >
                                    ✓
                                  </span>
                                ) : (
                                  <span className="block h-3.5 w-3.5 rounded-sm border border-eco-border group-hover:border-eco-muted" />
                                )}
                              </span>
                              <span>
                                <span className={`flex items-center gap-1.5 text-body ${isActive ? 'font-medium text-eco-text' : 'text-eco-muted'}`}>
                                  {layer.id === 'layer-data-centres' ? layer.name : `${layer.name} · Context`}
                                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: layer.color }} />
                                </span>
                                <span className="mt-0.5 line-clamp-1 text-meta text-eco-muted">{available ? layer.description : 'Unavailable — no observation geometry is connected.'}</span>
                              </span>
                            </button>

                            <IconButton
                              size="sm"
                              disabled={!available}
                              label={isOpacityOpen ? 'Hide opacity control' : 'Adjust layer opacity'}
                              aria-pressed={isOpacityOpen}
                              icon={<SlidersHorizontal className="h-3 w-3" />}
                              onClick={() => setExpandedOpacityLayerId(isOpacityOpen ? null : layer.id)}
                              className={isOpacityOpen ? 'text-eco-primary' : ''}
                            />
                          </div>

                          {available && isOpacityOpen && (
                            <div className="mt-2.5 space-y-1.5 border-t border-eco-border/60 pt-2">
                              <div className="flex items-center justify-between text-meta text-eco-muted">
                                <label htmlFor={`opacity-${layer.id}`}>Opacity</label>
                                <span className="font-mono text-eco-primary">{Math.round(opacity * 100)}%</span>
                              </div>
                              <input
                                id={`opacity-${layer.id}`}
                                type="range"
                                min="0.1"
                                max="1.0"
                                step="0.05"
                                value={opacity}
                                onChange={(e) => setLayerOpacity(layer.id, parseFloat(e.target.value))}
                                className="h-1 w-full cursor-pointer rounded accent-eco-primary"
                              />
                              <div className="flex items-center justify-between gap-2 pt-1">
                                <SourceTag
                                  organization={layer.provenance.sourceOrganization}
                                  status={layer.provenance.dataStatus}
                                  className="min-w-0 truncate"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
};
