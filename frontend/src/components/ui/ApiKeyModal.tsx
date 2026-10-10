import React, { useState } from 'react';
import {
  X,
  Key,
  CheckCircle2,
  Sparkles,
  Map,
  Shield,
  ExternalLink,
  Save,
} from 'lucide-react';
import { Button } from './Button';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose }) => {
  const [geminiKey, setGeminiKey] = useState(
    () => localStorage.getItem('ECOSITE_GEMINI_API_KEY') || import.meta.env.VITE_GEMINI_API_KEY || ''
  );
  const [mapboxToken, setMapboxToken] = useState(
    () => localStorage.getItem('ECOSITE_MAPBOX_TOKEN') || import.meta.env.VITE_MAPBOX_TOKEN || ''
  );
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (geminiKey.trim()) {
      localStorage.setItem('ECOSITE_GEMINI_API_KEY', geminiKey.trim());
    } else {
      localStorage.removeItem('ECOSITE_GEMINI_API_KEY');
    }

    if (mapboxToken.trim()) {
      localStorage.setItem('ECOSITE_MAPBOX_TOKEN', mapboxToken.trim());
    } else {
      localStorage.removeItem('ECOSITE_MAPBOX_TOKEN');
    }

    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#0F172A] border border-[#1E293B] rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col font-sans select-none text-slate-100">
        {/* Header */}
        <div className="px-5 py-4 bg-[#111A2E] border-b border-[#1E293B] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-950/80 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Key className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-slate-100">
                API Key Configuration
              </h3>
              <p className="text-[11px] text-slate-400">
                Manage platform connectivity and optional keys
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-100 hover:bg-[#1E293B] rounded-md transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Informational Banner: No Key Required by Default */}
        <div className="p-4 bg-emerald-950/30 border-b border-emerald-900/40 flex items-start gap-3">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <span className="font-semibold text-emerald-300 block">
              No API key is required to use EcoSite Terminal
            </span>
            <p className="text-slate-300 leading-relaxed text-[11px]">
              All maps, facilities, ML forecasts, risk screeners, and mitigation plans run out of the box with open-source basemaps and built-in models. Keys are completely optional.
            </p>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-5 space-y-4 text-xs">
          {/* Service Status List */}
          <div className="space-y-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Built-in Services (Zero-Config)
            </span>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="p-2.5 bg-[#0B111A] border border-[#1E293B] rounded-lg flex items-center gap-2">
                <Map className="w-4 h-4 text-sky-400 shrink-0" />
                <div>
                  <span className="font-medium text-slate-200 block">OpenStreetMap & ESRI</span>
                  <span className="text-emerald-400 text-[10px]">Active • No key needed</span>
                </div>
              </div>
              <div className="p-2.5 bg-[#0B111A] border border-[#1E293B] rounded-lg flex items-center gap-2">
                <Shield className="w-4 h-4 text-amber-400 shrink-0" />
                <div>
                  <span className="font-medium text-slate-200 block">ML Forecasting Engine</span>
                  <span className="text-emerald-400 text-[10px]">Active • Local model</span>
                </div>
              </div>
            </div>
          </div>

          {/* Optional Gemini Key */}
          <div className="space-y-1.5 pt-2 border-t border-[#1E293B]">
            <div className="flex items-center justify-between">
              <label className="font-medium text-slate-200 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Google Gemini API Key (Optional)</span>
              </label>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-[10px] text-sky-400 hover:underline flex items-center gap-1"
              >
                <span>Get free key</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
            <input
              type="password"
              placeholder="AIzaSy... or AQ.... (leave blank to use built-in models)"
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
              className="w-full bg-[#0B111A] border border-[#1E293B] rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/80 font-mono"
            />
            <p className="text-[10px] text-slate-400">
              Enables live generative AI prompt synthesis via Gemini 3.7 Flash for custom sustainability plans.
            </p>
          </div>

          {/* Optional Mapbox Token */}
          <div className="space-y-1.5 pt-2 border-t border-[#1E293B]">
            <div className="flex items-center justify-between">
              <label className="font-medium text-slate-200 flex items-center gap-1.5">
                <Map className="w-3.5 h-3.5 text-sky-400" />
                <span>Mapbox / MapTiler Token (Optional)</span>
              </label>
              <a
                href="https://account.mapbox.com/"
                target="_blank"
                rel="noreferrer"
                className="text-[10px] text-sky-400 hover:underline flex items-center gap-1"
              >
                <span>Mapbox Portal</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
            <input
              type="password"
              placeholder="pk.ey... (leave blank to use built-in Carto/ESRI)"
              value={mapboxToken}
              onChange={(e) => setMapboxToken(e.target.value)}
              className="w-full bg-[#0B111A] border border-[#1E293B] rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/80 font-mono"
            />
            <p className="text-[10px] text-slate-400">
              Only required if you want custom Mapbox Studio basemap styles.
            </p>
          </div>

          {/* Footer buttons */}
          <div className="pt-3 border-t border-[#1E293B] flex items-center justify-between">
            <div>
              {savedSuccess && (
                <span className="text-emerald-400 text-xs flex items-center gap-1 font-medium animate-in fade-in">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Settings saved!</span>
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" type="button" onClick={onClose}>
                Close
              </Button>
              <Button
                variant="primary"
                size="sm"
                type="submit"
                icon={<Save className="w-3.5 h-3.5" />}
              >
                Save Settings
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
