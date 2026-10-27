import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search,
  Layers,
  Globe2,
  Activity,
  TrendingUp,
  MapPin,
  Sparkles,
  FileSpreadsheet,
  Volume2,
  VolumeX,
  Compass,
  Columns2,
  Map as MapIcon,
  LayoutGrid,
  Key,
  Database,
} from 'lucide-react';
import { useDashboardStore } from '../../stores/dashboardStore';
import { ApiKeyModal } from '../ui/ApiKeyModal';
import { IconButton } from '../ui/Button';
import type { TimeRange, DashboardViewMode } from '../../types';

const NAV_MODULES = [
  { to: '/dashboard', label: 'Dashboard', icon: <Globe2 className="h-3.5 w-3.5" /> },
  { to: '/risk-analysis', label: 'Risk', icon: <Activity className="h-3.5 w-3.5" /> },
  { to: '/forecast', label: 'Forecast', icon: <TrendingUp className="h-3.5 w-3.5" /> },
  { to: '/site-analysis', label: 'Site analysis', icon: <MapPin className="h-3.5 w-3.5" /> },
  { to: '/mitigation', label: 'Mitigation', icon: <Sparkles className="h-3.5 w-3.5" /> },
  { to: '/reports', label: 'Reports', icon: <FileSpreadsheet className="h-3.5 w-3.5" /> },
  { to: '/data-sources', label: 'Data sources', icon: <Database className="h-3.5 w-3.5" /> },
];

const VIEW_MODES: Array<{ mode: DashboardViewMode; label: string; icon: React.ReactNode; title: string }> = [
  { mode: 'split', label: 'Split', icon: <Columns2 className="h-3 w-3" />, title: 'Split view — map and intelligence panels' },
  { mode: 'map_only', label: 'Map', icon: <MapIcon className="h-3 w-3" />, title: 'Maximized map' },
  { mode: 'grid_only', label: 'Grid', icon: <LayoutGrid className="h-3 w-3" />, title: 'Data grid' },
];

export const WorldMonitorHeader: React.FC = () => {
  const {
    timeRange,
    setTimeRange,
    viewMode,
    setViewMode,
    audioAlertsEnabled,
    toggleAudioAlerts,
    searchQuery,
    setSearchQuery,
    fitToIndia,
    toggleLeftSidebar,
    isLeftSidebarOpen,
    wmLayers,
  } = useDashboardStore();

  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);

  // Live ticking UTC clock
  const [utcTime, setUtcTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setUtcTime(`UTC ${now.toUTCString().slice(17, 25)}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleTimeRangeChange = (tr: TimeRange) => {
    setTimeRange(tr);
    const newParams = new URLSearchParams(searchParams);
    newParams.set('timeRange', tr);
    setSearchParams(newParams, { replace: true });
  };

  const handleViewModeChange = (vm: DashboardViewMode) => {
    setViewMode(vm);
    const newParams = new URLSearchParams(searchParams);
    newParams.set('view', vm === 'map_only' ? 'global' : vm === 'grid_only' ? 'grid' : 'split');
    setSearchParams(newParams, { replace: true });
  };

  const activeLayerCount = Object.values(wmLayers).filter(Boolean).length;

  return (
    <header className="z-30 flex h-14 shrink-0 select-none items-center justify-between border-b border-eco-border bg-eco-bg/95 px-4 backdrop-blur-md">
      {/* Brand + live clock */}
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
            <p className="mt-0.5 hidden text-micro text-eco-muted lg:block">Environmental intelligence platform</p>
          </div>
        </NavLink>

        <div className="hidden items-center gap-1.5 rounded-sm border border-eco-border bg-eco-surface px-2 py-0.5 font-mono text-micro text-eco-muted 2xl:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-eco-primary" />
          <span>{utcTime || 'UTC --:--:--'}</span>
        </div>
      </div>

      {/* Primary navigation */}
      <nav className="hidden items-center gap-1 rounded-md border border-eco-border/60 bg-eco-surface-secondary/60 p-1 md:flex">
        {NAV_MODULES.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-meta font-medium transition-colors ${
                isActive
                  ? 'border border-eco-border bg-eco-surface text-eco-primary'
                  : 'border border-transparent text-eco-muted hover:bg-eco-surface-secondary hover:text-eco-text'
              }`
            }
          >
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Search · view · time · layers · utilities */}
      <div className="flex items-center gap-2">
        <div className="relative w-36 sm:w-48">
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

        <div className="hidden items-center rounded-md border border-eco-border bg-eco-surface p-0.5 font-mono text-micro sm:flex">
          {(['24h', '7d', '30d'] as TimeRange[]).map((tr) => (
            <button
              key={tr}
              type="button"
              onClick={() => handleTimeRangeChange(tr)}
              aria-pressed={timeRange === tr}
              className={`cursor-pointer rounded-sm px-2 py-0.5 uppercase transition-colors ${
                timeRange === tr
                  ? 'border border-eco-primary/30 bg-eco-surface-secondary font-semibold text-eco-primary'
                  : 'border border-transparent text-eco-muted hover:text-eco-text'
              }`}
            >
              {tr}
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
        >
          <Layers className="h-3.5 w-3.5" />
          <span className="hidden font-medium sm:inline">Layers</span>
          <span className="rounded-sm border border-eco-border bg-eco-bg px-1 font-mono text-micro text-eco-muted">
            {activeLayerCount}
          </span>
        </button>

        <IconButton
          label="Recenter map"
          icon={<Compass className="h-4 w-4" />}
          onClick={() => {
            fitToIndia();
            navigate('/dashboard');
          }}
        />

        <IconButton
          label={audioAlertsEnabled ? 'Mute audio alerts' : 'Enable audio alerts'}
          aria-pressed={audioAlertsEnabled}
          icon={audioAlertsEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          onClick={toggleAudioAlerts}
          className={audioAlertsEnabled ? 'text-eco-primary' : ''}
        />

        <IconButton
          label="API keys & settings"
          icon={<Key className="h-4 w-4" />}
          onClick={() => setIsApiKeyModalOpen(true)}
        />
      </div>

      <ApiKeyModal isOpen={isApiKeyModalOpen} onClose={() => setIsApiKeyModalOpen(false)} />
    </header>
  );
};
