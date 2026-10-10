import React, { useState } from 'react';
import {
  MapPin,
  Compass,
  CheckCircle2,
  Plus,
  Trash2,
  Layers,
  Activity,
} from 'lucide-react';
import { assessProposedSite, type SiteAssessmentRequest } from '../services/siteAssessments';
import { useDashboardStore } from '../stores/dashboardStore';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { SiteMapPicker } from '../components/site-analysis/SiteMapPicker';
import type { InfrastructureType, ProposedSite } from '../types';

const PRESET_CORRIDORS = [
  { name: 'Dholera SIR Electronics Node', type: 'industrial' as InfrastructureType, lat: 22.25, lng: 72.2, capacity: 400, state: 'Gujarat' },
  { name: 'Navi Mumbai Hyper-DC Phase 3', type: 'data_centre' as InfrastructureType, lat: 19.12, lng: 73.02, capacity: 150, state: 'Maharashtra' },
  { name: 'Oragadam Mega Industrial Corridor', type: 'industrial' as InfrastructureType, lat: 12.83, lng: 79.95, capacity: 250, state: 'Tamil Nadu' },
  { name: 'Noida Expressway Data Zone', type: 'data_centre' as InfrastructureType, lat: 28.52, lng: 77.38, capacity: 100, state: 'Uttar Pradesh' },
  { name: 'Kurnool Green Hydrogen Hub', type: 'solar_farm' as InfrastructureType, lat: 15.65, lng: 78.25, capacity: 1200, state: 'Andhra Pradesh' },
];

export const SiteAnalysis: React.FC = () => {
  const { candidateSites, addCandidateSite, removeCandidateSite, clearCandidateSites } = useDashboardStore();

  const [form, setForm] = useState<SiteAssessmentRequest>({
    name: 'Proposed Hyperscale DC Alpha',
    type: 'data_centre',
    latitude: 19.12,
    longitude: 73.02,
    capacityMw: 120,
    waterDemandKld: 950,
    powerDemandMw: 120,
    state: 'Maharashtra',
  });

  const [currentResult, setCurrentResult] = useState<ProposedSite | null>(null);
  const [evaluating, setEvaluating] = useState(false);

  const handleEvaluate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setEvaluating(true);
    try {
      const res = await assessProposedSite(form);
      setCurrentResult(res);
    } finally {
      setEvaluating(false);
    }
  };

  const handleApplyPreset = (preset: typeof PRESET_CORRIDORS[0]) => {
    setForm({
      name: preset.name,
      type: preset.type,
      latitude: preset.lat,
      longitude: preset.lng,
      capacityMw: preset.capacity,
      waterDemandKld: preset.type === 'data_centre' ? 900 : 250,
      powerDemandMw: preset.capacity,
      state: preset.state,
    });
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#080D16] overflow-y-auto p-4 md:p-6 space-y-6 select-none font-sans">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#263447]">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase font-mono tracking-wider text-sky-400 bg-sky-950/80 px-2 py-0.5 rounded border border-sky-800">
              Module 04
            </span>
            <h1 className="text-lg md:text-xl font-bold text-slate-100 font-mono tracking-tight">
              Proposed Site Environmental & Siting Evaluation
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl">
            Evaluate proposed greenfield or brownfield infrastructure coordinates against aquifer vulnerability, high-voltage grid proximity, and statutory wildlife buffer constraints.
          </p>
        </div>

        {candidateSites.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-300">
              {candidateSites.length} Candidate Sites in Comparison
            </span>
            <Button variant="outline" size="xs" onClick={clearCandidateSites}>
              Clear All
            </Button>
          </div>
        )}
      </div>

      {/* Main Grid: Form Inputs vs Evaluation Dossier */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Form: Site Specifications */}
        <div className="lg:col-span-5 space-y-4">
          <Card
            title="Site Specifications & Siting Parameters"
            subtitle="Click on the map or enter coordinates to evaluate candidate site"
            icon={<MapPin className="w-4 h-4 text-sky-400" />}
          >
            {/* Interactive Map Coordinate Picker */}
            <div className="mb-4">
              <SiteMapPicker
                latitude={form.latitude}
                longitude={form.longitude}
                siteName={form.name}
                onCoordinatesChange={({ latitude, longitude, state }) => {
                  setForm((prev) => ({
                    ...prev,
                    latitude,
                    longitude,
                    state: state || prev.state,
                  }));
                }}
              />
            </div>

            {/* Preset Corridors */}
            <div className="mb-4 pb-3 border-b border-[#263447] space-y-1.5">
              <span className="text-[10px] font-mono uppercase text-slate-400 block">
                Quick Preset Greenfield Corridors:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_CORRIDORS.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleApplyPreset(p)}
                    className="text-[10px] font-mono px-2 py-1 rounded bg-[#172131] hover:bg-[#1E2C42] border border-[#263447] text-slate-300 hover:text-sky-300 transition-colors"
                  >
                    {p.name.split(' ')[0]} ({p.state})
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleEvaluate} className="space-y-3 font-mono text-xs">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 uppercase">Site Project Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-[#172131] border border-[#263447] rounded-sm px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-sky-500 font-sans"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 uppercase">Infrastructure Category</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as InfrastructureType })}
                  className="w-full bg-[#172131] border border-[#263447] rounded-sm px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-sky-500 font-sans"
                >
                  <option value="data_centre">Data Centre (IT Computing)</option>
                  <option value="thermal_power">Thermal Power Plant</option>
                  <option value="solar_farm">Solar Power Park</option>
                  <option value="wind_farm">Wind Power Farm</option>
                  <option value="hydro_power">Hydro Electric Facility</option>
                  <option value="substation">Substation / Switching Yard</option>
                  <option value="industrial">Industrial Fab / Manufacturing</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 uppercase">Latitude (°N)</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={form.latitude}
                    onChange={(e) => setForm({ ...form, latitude: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-[#172131] border border-[#263447] rounded-sm px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 uppercase">Longitude (°E)</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={form.longitude}
                    onChange={(e) => setForm({ ...form, longitude: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-[#172131] border border-[#263447] rounded-sm px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 uppercase">State Jurisdiction</label>
                <input
                  type="text"
                  value={form.state}
                  onChange={(e) => setForm({ ...form, state: e.target.value })}
                  className="w-full bg-[#172131] border border-[#263447] rounded-sm px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-sky-500 font-sans"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 uppercase">Capacity (MW)</label>
                  <input
                    type="number"
                    value={form.capacityMw}
                    onChange={(e) => setForm({ ...form, capacityMw: parseInt(e.target.value) || 0 })}
                    className="w-full bg-[#172131] border border-[#263447] rounded-sm px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 uppercase">Water Demand (kLD)</label>
                  <input
                    type="number"
                    value={form.waterDemandKld}
                    onChange={(e) => setForm({ ...form, waterDemandKld: parseInt(e.target.value) || 0 })}
                    className="w-full bg-[#172131] border border-[#263447] rounded-sm px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="md"
                className="w-full mt-2 font-mono uppercase"
                loading={evaluating}
                icon={<Activity className="w-4 h-4" />}
              >
                Run Geospatial Siting Screening
              </Button>
            </form>
          </Card>
        </div>

        {/* Right Column: Screening Assessment Results */}
        <div className="lg:col-span-7 space-y-4">
          {currentResult ? (
            <Card
              title={`Siting Dossier: ${currentResult.name}`}
              subtitle={`${currentResult.coordinates[1].toFixed(4)}°N, ${currentResult.coordinates[0].toFixed(4)}°E • ${currentResult.state}`}
              icon={<Compass className="w-4 h-4 text-emerald-400" />}
              headerAction={
                <Button
                  variant="outline"
                  size="xs"
                  icon={<Plus className="w-3.5 h-3.5" />}
                  onClick={() => addCandidateSite(currentResult)}
                >
                  Save to Comparison
                </Button>
              }
            >
              {/* Scorecard Hero */}
              <div className="p-4 bg-[#172131] rounded border border-[#263447] flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-4">
                  <div
                    className={`w-18 h-18 rounded-full border-4 flex flex-col items-center justify-center font-mono ${
                      currentResult.suitabilityScore >= 75
                        ? 'border-emerald-500 text-emerald-400 bg-emerald-950/40'
                        : currentResult.suitabilityScore >= 55
                        ? 'border-amber-500 text-amber-400 bg-amber-950/40'
                        : 'border-rose-500 text-rose-400 bg-rose-950/40'
                    }`}
                  >
                    <span className="text-2xl font-bold">{currentResult.suitabilityScore}</span>
                    <span className="text-[8px] uppercase tracking-wider text-slate-400">out of 100</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-mono text-slate-400 uppercase block">
                      Screening Assessment Verdict
                    </span>
                    <h3 className="text-base font-bold text-slate-100 font-mono">
                      {currentResult.suitabilityStatus}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Based on CGWB aquifer stage, grid interconnect distance, and statutory buffers.
                    </p>
                  </div>
                </div>
              </div>

              {/* Spatial Proximity Metric Tiles */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs mb-4">
                <div className="p-2.5 bg-[#111827] border border-[#263447] rounded-sm">
                  <span className="text-[10px] text-slate-500 uppercase block">Nearest Substation</span>
                  <span className="text-sm font-bold text-slate-200 block">
                    {currentResult.substationDistanceKm} km
                  </span>
                  <span className="text-[9px] text-slate-400">400kV HV corridor</span>
                </div>

                <div className="p-2.5 bg-[#111827] border border-[#263447] rounded-sm">
                  <span className="text-[10px] text-slate-500 uppercase block">Protected Area</span>
                  <span
                    className={`text-sm font-bold block ${
                      currentResult.protectedAreaDistanceKm < 10 ? 'text-amber-400' : 'text-emerald-400'
                    }`}
                  >
                    {currentResult.protectedAreaDistanceKm} km
                  </span>
                  <span className="text-[9px] text-slate-400">Statutory ESZ 10km</span>
                </div>

                <div className="p-2.5 bg-[#111827] border border-[#263447] rounded-sm">
                  <span className="text-[10px] text-slate-500 uppercase block">Groundwater Aquifer</span>
                  <span
                    className={`text-xs font-bold block ${
                      currentResult.groundwaterZone === 'Over-Exploited'
                        ? 'text-rose-400'
                        : currentResult.groundwaterZone === 'Critical'
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    {currentResult.groundwaterZone}
                  </span>
                  <span className="text-[9px] text-slate-400">CGWB Assessment</span>
                </div>

                <div className="p-2.5 bg-[#111827] border border-[#263447] rounded-sm">
                  <span className="text-[10px] text-slate-500 uppercase block">5km Population</span>
                  <span className="text-sm font-bold text-slate-200 block">
                    {(currentResult.population5km / 1000).toFixed(0)}k
                  </span>
                  <span className="text-[9px] text-slate-400">Census/WorldPop</span>
                </div>
              </div>

              {/* Siting Considerations & Regulatory Flags */}
              <div className="space-y-2 mb-4">
                <span className="text-xs font-mono uppercase tracking-wider text-slate-300 font-semibold block">
                  Identified Siting Constraints & Considerations
                </span>
                <div className="space-y-1.5">
                  {currentResult.flags.map((flag, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 bg-[#172131]/60 border border-[#263447] rounded-sm text-xs flex items-start gap-2"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
                      <span className="text-slate-300 leading-relaxed font-sans">{flag}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Statutory Disclaimer */}
              <div className="p-2.5 bg-[#111827] border border-[#263447] rounded text-[11px] text-slate-400 font-mono">
                Disclaimer: Automated pre-feasibility screening. Development requires statutory State Pollution Control Board Consent to Establish (CTE) and CGWA approvals.
              </div>
            </Card>
          ) : (
            <div className="p-8 bg-[#111827]/60 border border-[#263447] rounded-sm text-center space-y-3">
              <Compass className="w-12 h-12 text-slate-600 mx-auto" />
              <h3 className="text-sm font-bold text-slate-200">No Evaluation Performed Yet</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Configure candidate site parameters on the left or select a preset corridor and click <strong>"Run Geospatial Siting Screening"</strong>.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Candidate Multi-Site Comparison Matrix */}
      {candidateSites.length > 0 && (
        <Card
          title="Candidate Alternative Sites Comparison Matrix"
          subtitle="Side-by-side screening comparison of saved candidate locations"
          icon={<Layers className="w-4 h-4 text-sky-400" />}
          headerAction={
            <Button variant="danger" size="xs" onClick={clearCandidateSites}>
              Clear Comparison
            </Button>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#263447] text-slate-400 text-[10px] uppercase bg-[#172131]/50">
                  <th className="p-2.5">Candidate Site</th>
                  <th className="p-2.5">Type</th>
                  <th className="p-2.5">Coordinates</th>
                  <th className="p-2.5">Suitability Score</th>
                  <th className="p-2.5">Groundwater Zone</th>
                  <th className="p-2.5">Substation Dist.</th>
                  <th className="p-2.5">Protected Area</th>
                  <th className="p-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#263447]/60">
                {candidateSites.map((site) => (
                  <tr key={site.id} className="hover:bg-[#172131]/40">
                    <td className="p-2.5 font-bold text-slate-100 font-sans">{site.name}</td>
                    <td className="p-2.5 uppercase text-slate-400 text-[11px]">
                      {site.type.replace('_', ' ')}
                    </td>
                    <td className="p-2.5 text-slate-400 text-[11px]">
                      [{site.coordinates[1].toFixed(2)}°N, {site.coordinates[0].toFixed(2)}°E]
                    </td>
                    <td className="p-2.5">
                      <span
                        className={`font-bold ${
                          site.suitabilityScore >= 75
                            ? 'text-emerald-400'
                            : site.suitabilityScore >= 55
                            ? 'text-amber-400'
                            : 'text-rose-400'
                        }`}
                      >
                        {site.suitabilityScore}/100 ({site.suitabilityStatus.split(' ')[0]})
                      </span>
                    </td>
                    <td className="p-2.5">{site.groundwaterZone}</td>
                    <td className="p-2.5">{site.substationDistanceKm} km</td>
                    <td className="p-2.5">{site.protectedAreaDistanceKm} km</td>
                    <td className="p-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => removeCandidateSite(site.id)}
                        className="text-rose-400 hover:text-rose-300 p-1"
                        title="Remove candidate"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};
