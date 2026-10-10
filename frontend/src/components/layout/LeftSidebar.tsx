import React, { useState } from 'react';
import {
  Layers,
  ChevronDown,
  SlidersHorizontal,
  Search,
  Filter,
  Flame,
  Droplets,
  Building2,
  RotateCcw,
} from 'lucide-react';
import { useDashboardStore } from '../../stores/dashboardStore';
import { DEMO_LAYERS } from '../../data/demo/layers';
import type { InfrastructureType, RiskLevel } from '../../types';

export const LeftSidebar: React.FC = () => {
  const {
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
  const [collapsedCategories, setCollapsedCategories] = useState<{ [key: string]: boolean }>({
    predictive: false,
    environmental: false,
    infrastructure: false,
  });
  const [expandedOpacityLayerId, setExpandedOpacityLayerId] = useState<string | null>(null);

  const toggleCategory = (cat: string) => {
    setCollapsedCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  const categories = [
    { id: 'infrastructure', name: 'Infrastructure Layers', count: 8 },
    { id: 'environmental', name: 'Environmental & Hazard Layers', count: 7 },
    { id: 'predictive', name: 'Predictive & Stress Forecast Layers', count: 4 },
  ];

  const filteredLayers = DEMO_LAYERS.filter((layer) => {
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
    <aside className="w-80 md:w-84 bg-[#090E1A]/95 backdrop-blur-md border-r border-[#1E293B] flex flex-col h-full z-30 shrink-0 select-none shadow-xl font-sans">
      {/* Sidebar Header */}
      <div className="h-12 border-b border-[#1E293B] px-4 flex items-center justify-between bg-[#0F172A]">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-100">
          <Layers className="w-4 h-4 text-sky-400" />
          <span>Layers & Intelligence Filters</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={resetLayers}
            className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-[#1E293B] rounded-md transition-colors cursor-pointer"
            title="Reset All Layers to Default"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={toggleLeftSidebar}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-[#1E293B] rounded-md transition-colors cursor-pointer"
            title="Close Sidebar"
          >
            <ChevronDown className="w-4 h-4 rotate-90" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Layer Search Box */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search geospatial layers..."
            value={searchLayerText}
            onChange={(e) => setSearchLayerText(e.target.value)}
            className="w-full bg-[#111827] border border-[#263447] rounded-sm pl-8 pr-2.5 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono"
          />
        </div>

        {/* Global Facility Filters */}
        <div className="bg-[#111827]/90 border border-[#263447] rounded-sm p-2.5 space-y-2.5 text-xs font-mono">
          <div className="flex items-center justify-between text-slate-300 font-semibold border-b border-[#263447]/60 pb-1">
            <span className="flex items-center gap-1.5 text-slate-200">
              <Filter className="w-3.5 h-3.5 text-emerald-400" />
              <span>FACILITY FILTERS</span>
            </span>
            {(typeFilter !== 'all' || riskFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setTypeFilter('all');
                  setRiskFilter('all');
                }}
                className="text-[10px] text-sky-400 hover:underline"
              >
                Clear
              </button>
            )}
          </div>

          {/* Type Filter Dropdown */}
          <div className="space-y-1">
            <label className="text-[10px] text-slate-400 uppercase tracking-wider">Infrastructure Type</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as InfrastructureType | 'all')}
              className="w-full bg-[#172131] border border-[#263447] rounded-sm px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-sky-500 font-sans"
            >
              <option value="all">All Infrastructure Types</option>
              <option value="data_centre">Data Centres (IT Load)</option>
              <option value="thermal_power">Thermal Power Plants</option>
              <option value="solar_farm">Solar Farms</option>
              <option value="wind_farm">Wind Farms</option>
              <option value="hydro_power">Hydro Power Plants</option>
              <option value="substation">Substations & Grid</option>
              <option value="industrial">Industrial & Fab Clusters</option>
            </select>
          </div>

          {/* Risk Filter Buttons */}
          <div className="space-y-1">
            <label className="text-[10px] text-slate-400 uppercase tracking-wider">Screening Risk Tier</label>
            <div className="grid grid-cols-4 gap-1 text-[10px]">
              {(['all', 'critical', 'high', 'moderate', 'low'] as const)
                .slice(0, 4)
                .map((tier) => (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => setRiskFilter(tier as RiskLevel | 'all')}
                    className={`py-1 rounded-sm border uppercase font-mono transition-colors text-center ${
                      riskFilter === tier
                        ? 'bg-[#1E2C42] text-sky-300 border-sky-500 font-bold'
                        : 'bg-[#172131]/60 text-slate-400 border-[#263447] hover:text-slate-200'
                    }`}
                  >
                    {tier}
                  </button>
                ))}
            </div>
          </div>
        </div>

        {/* Layer Categories */}
        <div className="space-y-3">
          {categories.map((category) => {
            const isCollapsed = collapsedCategories[category.id];
            const categoryLayers = filteredLayers.filter((l) => l.category === category.id);

            if (categoryLayers.length === 0) return null;

            return (
              <div key={category.id} className="border border-[#263447] rounded-sm overflow-hidden bg-[#111827]">
                {/* Category Header */}
                <button
                  type="button"
                  onClick={() => toggleCategory(category.id)}
                  className="w-full px-3 py-2 bg-[#172131]/80 hover:bg-[#1E2C42] flex items-center justify-between text-xs font-mono font-medium text-slate-200 transition-colors border-b border-[#263447]"
                >
                  <div className="flex items-center gap-1.5">
                    {category.id === 'infrastructure' && <Building2 className="w-3.5 h-3.5 text-sky-400" />}
                    {category.id === 'environmental' && <Droplets className="w-3.5 h-3.5 text-emerald-400" />}
                    {category.id === 'predictive' && <Flame className="w-3.5 h-3.5 text-rose-400" />}
                    <span className="text-[11px] font-semibold">{category.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-400 text-[10px]">
                    <span className="px-1.5 py-0.2 bg-[#080D16] rounded border border-[#263447]">
                      {categoryLayers.filter((l) => activeLayers[l.id]).length}/{categoryLayers.length}
                    </span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 transition-transform duration-200 ${
                        isCollapsed ? '-rotate-90' : ''
                      }`}
                    />
                  </div>
                </button>

                {/* Layer Items List */}
                {!isCollapsed && (
                  <div className="divide-y divide-[#263447]/60">
                    {categoryLayers.map((layer) => {
                      const isActive = !!activeLayers[layer.id];
                      const opacity = layerOpacities[layer.id] ?? 1.0;
                      const isOpacityOpen = expandedOpacityLayerId === layer.id;

                      return (
                        <div
                          key={layer.id}
                          className={`p-2.5 transition-colors ${
                            isActive ? 'bg-[#172131]/30' : 'bg-transparent opacity-85'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            {/* Layer Checkbox & Title */}
                            <button
                              type="button"
                              onClick={() => toggleLayer(layer.id)}
                              className="flex items-start gap-2 text-left flex-1 group"
                            >
                              <div className="mt-0.5 shrink-0">
                                {isActive ? (
                                  <div
                                    className="w-3.5 h-3.5 rounded-sm flex items-center justify-center border border-current text-[10px]"
                                    style={{ color: layer.color }}
                                  >
                                    ✓
                                  </div>
                                ) : (
                                  <div className="w-3.5 h-3.5 rounded-sm border border-slate-600 group-hover:border-slate-400" />
                                )}
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className={`text-xs font-medium ${
                                      isActive ? 'text-slate-100 font-semibold' : 'text-slate-400'
                                    }`}
                                  >
                                    {layer.name}
                                  </span>
                                  <span
                                    className="w-2 h-2 rounded-full shrink-0"
                                    style={{ backgroundColor: layer.color }}
                                  />
                                </div>
                                <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">
                                  {layer.description}
                                </p>
                              </div>
                            </button>

                            {/* Opacity & Info Toggle */}
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedOpacityLayerId(isOpacityOpen ? null : layer.id)
                                }
                                className={`p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-[#1E2C42] ${
                                  isOpacityOpen ? 'text-sky-400 bg-[#1E2C42]' : ''
                                }`}
                                title="Adjust Layer Opacity"
                              >
                                <SlidersHorizontal className="w-3 h-3" />
                              </button>
                            </div>
                          </div>

                          {/* Expanded Opacity Slider & Metadata */}
                          {isOpacityOpen && (
                            <div className="mt-2.5 pt-2 border-t border-[#263447]/60 space-y-1.5 text-xs font-mono">
                              <div className="flex items-center justify-between text-[10px] text-slate-400">
                                <span>Opacity</span>
                                <span className="text-sky-400 font-semibold">{Math.round(opacity * 100)}%</span>
                              </div>
                              <input
                                type="range"
                                min="0.1"
                                max="1.0"
                                step="0.05"
                                value={opacity}
                                onChange={(e) => setLayerOpacity(layer.id, parseFloat(e.target.value))}
                                className="w-full accent-sky-400 h-1 bg-[#263447] rounded cursor-pointer"
                              />
                              <div className="text-[10px] text-slate-500 pt-1 flex justify-between">
                                <span>Source: {layer.provenance.sourceOrganization.slice(0, 24)}...</span>
                                <span className="uppercase text-amber-400">{layer.provenance.dataStatus}</span>
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
