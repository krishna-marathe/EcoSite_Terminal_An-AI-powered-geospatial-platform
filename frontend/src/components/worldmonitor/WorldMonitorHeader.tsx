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
} from 'lucide-react';
import { useDashboardStore } from '../../stores/dashboardStore';
import { ApiKeyModal } from '../ui/ApiKeyModal';
import type { TimeRange, DashboardViewMode } from '../../types';

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
      const utcString = now.toUTCString().slice(17, 25);
      setUtcTime(`UTC ${utcString}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Sync timeRange & viewMode with URL
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

  const navModules = [
    { to: '/dashboard', label: 'Dashboard', icon: <Globe2 className="w-3.5 h-3.5" /> },
    { to: '/risk-analysis', label: 'Risk Analysis', icon: <Activity className="w-3.5 h-3.5" /> },
    { to: '/forecast', label: 'ML Forecast', icon: <TrendingUp className="w-3.5 h-3.5" /> },
    { to: '/site-analysis', label: 'Site Evaluation', icon: <MapPin className="w-3.5 h-3.5" /> },
    { to: '/mitigation', label: 'AI Mitigation', icon: <Sparkles className="w-3.5 h-3.5" /> },
    { to: '/reports', label: 'Reports', icon: <FileSpreadsheet className="w-3.5 h-3.5" /> },
  ];

  const activeLayerCount = Object.values(wmLayers).filter(Boolean).length;

  return (
    <header className="h-14 bg-[#080D1A]/95 border-b border-[#1E293B] px-4 flex items-center justify-between z-30 select-none shrink-0 backdrop-blur-md">
      {/* Brand & Live Status */}
      <div className="flex items-center gap-3 shrink-0">
        <NavLink to="/dashboard" className="flex items-center gap-2.5 group">
          <div className="w-7 h-7 rounded-lg bg-emerald-950/80 border border-emerald-500/40 flex items-center justify-center relative shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping absolute opacity-70" />
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 leading-tight">
              <span className="font-bold text-slate-100 text-sm tracking-tight group-hover:text-emerald-400 transition-colors">
                EcoSite<span className="text-emerald-400 font-semibold"> Terminal</span>
              </span>
              <span className="text-[10px] text-amber-300/90 font-medium bg-amber-950/60 border border-amber-800/60 px-1.5 py-0.2 rounded">
                Demo Data
              </span>
            </div>
            <p className="text-[10px] text-slate-400 hidden lg:block leading-none mt-0.5 font-medium">
              Environmental Intelligence Platform
            </p>
          </div>
        </NavLink>

        {/* Live Clock Chip */}
        <div className="hidden 2xl:flex items-center gap-1.5 px-2 py-0.5 bg-[#0F172A] border border-[#1E293B] rounded-md text-[11px] text-slate-300 font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>{utcTime || 'UTC --:--:--'}</span>
        </div>
      </div>

      {/* Primary Navigation Tabs */}
      <nav className="hidden md:flex items-center gap-1 bg-[#0B1220]/60 p-1 rounded-lg border border-[#1E293B]/60">
        {navModules.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                isActive
                  ? 'bg-[#1E293B] text-emerald-400 shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#111A2E]'
              }`
            }
          >
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Right Controls: Search, View Switcher, Time Range, Layers */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <div className="relative w-36 sm:w-48">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search facilities, states..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#0F172A] border border-[#1E293B] rounded-lg pl-8 pr-2.5 py-1 text-xs text-slate-200 placeholder-slate-400 focus:outline-none focus:border-emerald-500/80 transition-colors"
          />
        </div>

        {/* View Mode Switcher */}
        <div className="hidden lg:flex items-center bg-[#0F172A] border border-[#1E293B] rounded-lg p-0.5 text-xs">
          <button
            type="button"
            onClick={() => handleViewModeChange('split')}
            title="Split Mode (Map & Telemetry)"
            className={`flex items-center gap-1 px-2 py-1 rounded-md transition-colors cursor-pointer ${
              viewMode === 'split'
                ? 'bg-[#1E293B] text-emerald-400 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Columns2 className="w-3 h-3" />
            <span className="hidden xl:inline">Split</span>
          </button>
          <button
            type="button"
            onClick={() => handleViewModeChange('map_only')}
            title="Maximized Map Mode"
            className={`flex items-center gap-1 px-2 py-1 rounded-md transition-colors cursor-pointer ${
              viewMode === 'map_only'
                ? 'bg-[#1E293B] text-emerald-400 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <MapIcon className="w-3 h-3" />
            <span className="hidden xl:inline">Map</span>
          </button>
          <button
            type="button"
            onClick={() => handleViewModeChange('grid_only')}
            title="Data Grid Mode"
            className={`flex items-center gap-1 px-2 py-1 rounded-md transition-colors cursor-pointer ${
              viewMode === 'grid_only'
                ? 'bg-[#1E293B] text-emerald-400 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <LayoutGrid className="w-3 h-3" />
            <span className="hidden xl:inline">Grid</span>
          </button>
        </div>

        {/* Time Range Pills */}
        <div className="hidden sm:flex items-center bg-[#0F172A] border border-[#1E293B] rounded-lg p-0.5 text-[11px]">
          {(['24h', '7d', '30d'] as TimeRange[]).map((tr) => (
            <button
              key={tr}
              type="button"
              onClick={() => handleTimeRangeChange(tr)}
              className={`px-2 py-0.5 rounded-md uppercase font-medium transition-colors cursor-pointer ${
                timeRange === tr
                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tr}
            </button>
          ))}
        </div>

        {/* Layers Sidebar Toggle Button */}
        <button
          type="button"
          onClick={toggleLeftSidebar}
          className={`px-2.5 py-1 rounded-lg border text-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
            isLeftSidebarOpen
              ? 'bg-[#1E293B] text-emerald-400 border-emerald-500/50 shadow-sm'
              : 'bg-[#0F172A] text-slate-300 border-[#1E293B] hover:bg-[#1E293B]'
          }`}
          title="Toggle Layers & Filters Panel"
        >
          <Layers className="w-3.5 h-3.5 text-sky-400" />
          <span className="font-medium hidden sm:inline">Layers</span>
          <span className="text-[10px] text-slate-400 bg-[#080D1A] px-1 py-0.2 rounded border border-[#1E293B] font-mono">
            {activeLayerCount}
          </span>
        </button>

        {/* Fit Map Button */}
        <button
          type="button"
          onClick={() => {
            fitToIndia();
            navigate('/dashboard');
          }}
          className="p-1.5 rounded-lg bg-[#0F172A] border border-[#1E293B] text-slate-300 hover:text-emerald-400 hover:bg-[#1E293B] transition-colors cursor-pointer"
          title="Recenter Map on India"
        >
          <Compass className="w-4 h-4" />
        </button>

        {/* Audio Alert Toggle */}
        <button
          type="button"
          onClick={toggleAudioAlerts}
          className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
            audioAlertsEnabled
              ? 'bg-emerald-950/60 text-emerald-400 border-emerald-700/60'
              : 'bg-[#0F172A] text-slate-400 border-[#1E293B] hover:text-slate-200'
          }`}
          title={audioAlertsEnabled ? 'Audio Alerts Enabled' : 'Audio Alerts Muted'}
        >
          {audioAlertsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>

        {/* API Key & Settings Modal Toggle */}
        <button
          type="button"
          onClick={() => setIsApiKeyModalOpen(true)}
          className="p-1.5 rounded-lg bg-[#0F172A] border border-[#1E293B] text-slate-300 hover:text-emerald-400 hover:bg-[#1E293B] transition-colors cursor-pointer"
          title="API Keys & Platform Settings"
        >
          <Key className="w-4 h-4" />
        </button>
      </div>

      {/* API Key Modal Dialog */}
      <ApiKeyModal isOpen={isApiKeyModalOpen} onClose={() => setIsApiKeyModalOpen(false)} />
    </header>
  );
};
