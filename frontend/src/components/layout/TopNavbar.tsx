import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Globe2,
  Activity,
  TrendingUp,
  MapPin,
  Sparkles,
  FileSpreadsheet,
  Search,
  Crosshair,
  Layers,
} from 'lucide-react';
import { useDashboardStore } from '../../stores/dashboardStore';

export const TopNavbar: React.FC = () => {
  const { searchQuery, setSearchQuery, fitToIndia, selectedFacility } = useDashboardStore();
  const navigate = useNavigate();

  const navLinks = [
    { to: '/dashboard', label: 'Command Center', icon: <Globe2 className="w-4 h-4" /> },
    { to: '/risk-analysis', label: 'Risk Analysis', icon: <Activity className="w-4 h-4" /> },
    { to: '/forecast', label: 'ML Forecast', icon: <TrendingUp className="w-4 h-4" /> },
    { to: '/site-analysis', label: 'Site Evaluation', icon: <MapPin className="w-4 h-4" /> },
    { to: '/mitigation', label: 'AI Mitigation', icon: <Sparkles className="w-4 h-4" /> },
    { to: '/reports', label: 'Reports & Data', icon: <FileSpreadsheet className="w-4 h-4" /> },
  ];

  return (
    <header className="h-14 bg-[#080D16] border-b border-[#263447] px-4 flex items-center justify-between z-30 select-none shrink-0 sticky top-0">
      {/* Brand & Tagline */}
      <div className="flex items-center gap-4">
        <NavLink to="/dashboard" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-sm bg-gradient-to-br from-emerald-500 to-sky-600 flex items-center justify-center p-0.5 shadow-md shadow-emerald-500/10">
            <div className="w-full h-full bg-[#080D16] rounded-[2px] flex items-center justify-center">
              <Layers className="w-4 h-4 text-emerald-400 group-hover:rotate-12 transition-transform duration-300" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-100 tracking-tight text-base font-mono">
                EcoSite<span className="text-emerald-400"> Terminal</span>
              </span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 bg-amber-950/80 text-amber-400 border border-amber-500/40 rounded">
                DEMO MODE
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono hidden md:block">
              Intelligent Infrastructure. Sustainable India.
            </p>
          </div>
        </NavLink>
      </div>

      {/* Primary Navigation Links */}
      <nav className="hidden lg:flex items-center gap-1">
        {navLinks.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              `flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-medium transition-all ${
                isActive
                  ? 'bg-[#172131] text-sky-400 border border-[#263447] shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#111827]'
              }`
            }
          >
            {link.icon}
            <span>{link.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Search & Actions */}
      <div className="flex items-center gap-2.5">
        <div className="relative w-44 md:w-60">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search facility, state, city..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#111827] border border-[#263447] rounded-sm pl-8 pr-2.5 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
          />
        </div>

        <button
          type="button"
          onClick={() => {
            fitToIndia();
            navigate('/dashboard');
          }}
          title="Fit view to India"
          className="flex items-center gap-1 px-2.5 py-1 bg-[#172131] hover:bg-[#1E2C42] border border-[#263447] text-slate-300 rounded-sm text-xs font-mono transition-colors"
        >
          <Crosshair className="w-3.5 h-3.5 text-sky-400" />
          <span className="hidden sm:inline">Fit India</span>
        </button>

        {selectedFacility && (
          <div className="hidden xl:flex items-center gap-1.5 pl-2 border-l border-[#263447] text-xs font-mono text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="truncate max-w-[140px] text-slate-200">{selectedFacility.name}</span>
          </div>
        )}
      </div>
    </header>
  );
};
