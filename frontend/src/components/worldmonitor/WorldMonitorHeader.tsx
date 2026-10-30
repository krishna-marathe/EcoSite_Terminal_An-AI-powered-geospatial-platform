import React from 'react';
import { NavLink, useLocation, useSearchParams } from 'react-router-dom';
import { Search, Layers, Columns2, Map as MapIcon, LayoutGrid } from 'lucide-react';
import { useDashboardStore } from '../../stores/dashboardStore';
import { AppNav } from '../layout/AppNav';
import type { DashboardViewMode } from '../../types';

const VIEW_MODES: Array<{ mode: DashboardViewMode; label: string; icon: React.ReactNode; title: string }> = [
  { mode: 'split', label: 'Split', icon: <Columns2 className="h-3 w-3" />, title: 'Split view — map and insight rail' },
  { mode: 'map_only', label: 'Map', icon: <MapIcon className="h-3 w-3" />, title: 'Maximised map' },
  { mode: 'grid_only', label: 'Grid', icon: <LayoutGrid className="h-3 w-3" />, title: 'Panel grid' },
];

export const WorldMonitorHeader: React.FC = () => {
  const {
    viewMode,
    setViewMode,
    searchQuery,
    setSearchQuery,
    toggleLeftSidebar,
    isLeftSidebarOpen,
    wmLayers,
  } = useDashboardStore();

  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const handleViewModeChange = (vm: DashboardViewMode) => {
    setViewMode(vm);
    const newParams = new URLSearchParams(searchParams);
    newParams.set('view', vm === 'map_only' ? 'global' : vm === 'grid_only' ? 'grid' : 'split');
    setSearchParams(newParams, { replace: true });
  };

  const activeLayerCount = Object.values(wmLayers).filter(Boolean).length;
  const showDashboardTools = location.pathname.startsWith('/dashboard');

  return (
    <header className="z-30 flex h-14 shrink-0 select-none items-center justify-between border-b border-eco-border bg-eco-bg/95 px-4 backdrop-blur-md">
      {/* Brand */}
      <div className="flex shrink-0 items-center gap-3">
        <NavLink to="/dashboard" className="group flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-md border border-eco-primary/40 bg-eco-primary/10">
            <span className="h-1.5 w-1.5 rounded-full bg-eco-primary" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 leading-tight">
              <span className="font-mono text-body font-semibold tracking-tight text-eco-text transition-colors group-hover:text-eco-primary">
                EcoSite<span className="text-eco-primary"> Terminal</span>
              </span>
            </div>
            <p className="mt-0.5 hidden text-micro text-eco-muted lg:block">Government data-centre oversight</p>
          </div>
        </NavLink>
      </div>

      <AppNav />

      {/* Dashboard tools: search · view mode · layers. Map actions live in the map. */}
      <div className="flex items-center gap-2">
        {showDashboardTools && (
          <>
            <div className="relative hidden w-36 sm:block sm:w-48">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-eco-muted" />
              <input
                type="text"
                aria-label="Search facilities"
                placeholder="Search facilities"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 w-full rounded-sm border border-eco-border bg-eco-surface pl-8 pr-2.5 text-meta text-eco-text placeholder:text-eco-muted transition-colors focus-visible:border-eco-primary/60"
              />
            </div>

            <div className="hidden items-center rounded-md border border-eco-border bg-eco-surface p-0.5 text-meta lg:flex">
              {VIEW_MODES.map((view) => (
                <button
                  key={view.mode}
                  type="button"
                  onClick={() => handleViewModeChange(view.mode)}
                  title={view.title}
                  aria-pressed={viewMode === view.mode}
                  className={`flex cursor-pointer items-center gap-1 rounded-sm px-2 py-1 transition-colors ${
                    viewMode === view.mode
                      ? 'bg-eco-surface-secondary font-semibold text-eco-primary'
                      : 'text-eco-muted hover:text-eco-text'
                  }`}
                >
                  {view.icon}
                  <span className="hidden xl:inline">{view.label}</span>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={toggleLeftSidebar}
              aria-pressed={isLeftSidebarOpen}
              className={`flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1 text-meta transition-colors ${
                isLeftSidebarOpen
                  ? 'border-eco-primary/40 bg-eco-surface-secondary text-eco-primary'
                  : 'border-eco-border bg-eco-surface text-eco-muted hover:text-eco-text'
              }`}
              title="Toggle layers & filters panel"
              aria-label={`Layers and filters, ${activeLayerCount} active`}
            >
              <Layers className="h-3.5 w-3.5" />
              <span className="hidden font-medium sm:inline">Layers</span>
              <span className="rounded-sm border border-eco-border bg-eco-bg px-1 font-mono text-micro text-eco-muted">
                {activeLayerCount}
              </span>
            </button>
          </>
        )}
      </div>
    </header>
  );
};
