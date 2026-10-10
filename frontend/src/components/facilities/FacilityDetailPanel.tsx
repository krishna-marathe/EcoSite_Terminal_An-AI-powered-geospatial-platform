import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X,
  Activity,
  AlertTriangle,
  TrendingUp,
  FileText,
  Sparkles,
  Users,
  Compass,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
} from 'recharts';
import { useDashboardStore } from '../../stores/dashboardStore';
import { RiskBadge } from '../ui/Badge';
import { DataConfidenceTag } from '../ui/DataConfidenceTag';
import { Button } from '../ui/Button';

export const FacilityDetailPanel: React.FC = () => {
  const {
    selectedFacility,
    setSelectedFacilityId,
    isRightPanelOpen,
    toggleRightPanel,
  } = useDashboardStore();

  const navigate = useNavigate();

  if (!isRightPanelOpen) {
    return (
      <div className="w-10 bg-[#080D16] border-l border-[#263447] flex flex-col items-center py-3 z-20 shrink-0">
        <button
          type="button"
          onClick={toggleRightPanel}
          className="p-2 text-slate-400 hover:text-sky-400 rounded hover:bg-[#111827] transition-colors"
          title="Expand Facility Dossier"
        >
          <Activity className="w-5 h-5" />
        </button>
        <div className="mt-8 [writing-mode:vertical-rl] rotate-180 text-xs font-mono tracking-wider text-slate-400 uppercase">
          Intelligence Dossier
        </div>
      </div>
    );
  }

  if (!selectedFacility) {
    return (
      <aside className="w-88 md:w-96 bg-[#080D16] border-l border-[#263447] flex flex-col h-full z-20 shrink-0 select-none p-4 justify-between">
        <div>
          <div className="flex items-center justify-between border-b border-[#263447] pb-3 mb-4">
            <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-2">
              <Activity className="w-4 h-4 text-sky-400" />
              <span>Facility Dossier</span>
            </h3>
            <button
              type="button"
              onClick={toggleRightPanel}
              className="text-slate-400 hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-6 bg-[#111827]/60 border border-[#263447] rounded-sm text-center space-y-3">
            <Compass className="w-10 h-10 text-slate-600 mx-auto animate-spin" style={{ animationDuration: '20s' }} />
            <h4 className="text-sm font-semibold text-slate-200">No Facility Selected</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Select an infrastructure marker on the interactive India map or use the top search bar to inspect environmental risk indicators, aquifer drawdown, and grid exposure.
            </p>
          </div>
        </div>

        <div className="text-[11px] font-mono text-slate-500 border-t border-[#263447] pt-3">
          EcoSite Terminal v1.4 • Data verified against Central Ground Water Board and CEA registers.
        </div>
      </aside>
    );
  }

  // Prepare radar chart data for 6 key dimensions
  const radarData = [
    { subject: 'Water Stress', value: selectedFacility.indicators.waterStress },
    { subject: 'Grid Pressure', value: selectedFacility.indicators.gridPressure },
    { subject: 'Air Pollution', value: selectedFacility.indicators.airPollution },
    { subject: 'Heat Exposure', value: selectedFacility.indicators.heatExposure },
    { subject: 'Flood Hazard', value: selectedFacility.indicators.floodHazard },
    { subject: 'Biodiversity', value: selectedFacility.indicators.biodiversityConstraint },
  ];

  return (
    <aside className="w-88 md:w-96 bg-[#080D16] border-l border-[#263447] flex flex-col h-full z-20 shrink-0 select-none overflow-hidden">
      {/* Dossier Header */}
      <div className="p-3.5 border-b border-[#263447] bg-[#111827]/80 flex items-start justify-between gap-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono uppercase px-1.5 py-0.2 rounded bg-sky-950 text-sky-400 border border-sky-800 font-bold">
              {selectedFacility.type.replace('_', ' ')}
            </span>
            <RiskBadge level={selectedFacility.riskLevel} score={selectedFacility.overallRiskScore} />
          </div>
          <h2 className="text-sm font-bold text-slate-100 tracking-tight leading-snug">
            {selectedFacility.name}
          </h2>
          <p className="text-xs text-slate-400 font-mono">
            {selectedFacility.district}, {selectedFacility.state} • [
            {selectedFacility.coordinates[1].toFixed(2)}°N, {selectedFacility.coordinates[0].toFixed(2)}°E]
          </p>
        </div>
        <button
          type="button"
          onClick={() => setSelectedFacilityId(null)}
          className="p-1 text-slate-400 hover:text-slate-200 hover:bg-[#1E2C42] rounded"
          title="Deselect Facility"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Dossier Content Body */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
        {/* Core Metadata Grid */}
        <div className="grid grid-cols-2 gap-2 bg-[#111827] border border-[#263447] rounded-sm p-2.5 text-xs font-mono">
          <div>
            <span className="text-[10px] text-slate-500 block uppercase">Capacity</span>
            <span className="text-emerald-400 font-semibold">
              {selectedFacility.capacityMw ? `${selectedFacility.capacityMw.toLocaleString()} MW` : 'N/A'}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 block uppercase">Operator</span>
            <span className="text-slate-200 truncate block">
              {selectedFacility.operator || 'Verified Public Record'}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 block uppercase">Commissioned</span>
            <span className="text-slate-300">{selectedFacility.yearCommissioned || 'Est. 2022'}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 block uppercase">Status</span>
            <span className="text-sky-300 font-medium">Active Operational</span>
          </div>
        </div>

        {/* Environmental Risk Radar Assessment */}
        <div className="bg-[#111827] border border-[#263447] rounded-sm p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-mono font-semibold text-slate-200 uppercase flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-sky-400" />
              <span>Multidimensional Risk Profile</span>
            </span>
            <span className="text-[10px] font-mono text-slate-400">Score: {selectedFacility.overallRiskScore}/100</span>
          </div>

          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData} margin={{ top: 10, right: 15, bottom: 10, left: 15 }}>
                <PolarGrid stroke="#263447" />
                <PolarAngleAxis dataKey="subject" stroke="#94A3B8" tick={{ fill: '#94A3B8', fontSize: 10 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#263447" tick={false} />
                <Radar
                  name="Environmental Stress"
                  dataKey="value"
                  stroke="#38BDF8"
                  fill="#38BDF8"
                  fillOpacity={0.35}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Key Contributing Risk Factors */}
        <div className="bg-[#111827] border border-[#263447] rounded-sm p-3 space-y-2">
          <div className="text-xs font-mono font-semibold text-amber-400 uppercase flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Key Risk Drivers & Vulnerabilities</span>
          </div>
          <ul className="space-y-1.5 text-xs text-slate-300">
            {selectedFacility.keyRiskFactors.map((factor, i) => (
              <li key={i} className="flex items-start gap-1.5 text-[11px] leading-relaxed">
                <span className="text-amber-400 mt-0.5">•</span>
                <span>{factor}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Nearby Population Exposure Buffer */}
        <div className="bg-[#111827] border border-[#263447] rounded-sm p-3 space-y-2">
          <div className="text-xs font-mono font-semibold text-slate-200 uppercase flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-rose-400" />
            <span>Surrounding Population Exposure</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5 text-center font-mono">
            <div className="bg-[#172131] p-1.5 rounded-sm border border-[#263447]">
              <span className="text-[10px] text-slate-400 block">&lt; 5 km</span>
              <span className="text-xs font-bold text-slate-100">
                {(selectedFacility.nearbyPopulation.radius5km / 1000).toFixed(0)}k
              </span>
            </div>
            <div className="bg-[#172131] p-1.5 rounded-sm border border-[#263447]">
              <span className="text-[10px] text-slate-400 block">&lt; 15 km</span>
              <span className="text-xs font-bold text-slate-100">
                {(selectedFacility.nearbyPopulation.radius15km / 1000).toFixed(0)}k
              </span>
            </div>
            <div className="bg-[#172131] p-1.5 rounded-sm border border-[#263447]">
              <span className="text-[10px] text-slate-400 block">&lt; 25 km</span>
              <span className="text-xs font-bold text-slate-100">
                {(selectedFacility.nearbyPopulation.radius25km / 1000000).toFixed(1)}M
              </span>
            </div>
          </div>
        </div>

        {/* Historical Water & Environmental Trend Sparkline */}
        {selectedFacility.historicalTrends && selectedFacility.historicalTrends.length > 0 && (
          <div className="bg-[#111827] border border-[#263447] rounded-sm p-3 space-y-1">
            <div className="flex items-center justify-between text-xs font-mono font-semibold text-slate-200">
              <span className="flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                <span>Water Demand Trend (kLD)</span>
              </span>
              <span className="text-[10px] text-slate-400">2021 - 2025</span>
            </div>
            <div className="h-24 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={selectedFacility.historicalTrends}>
                  <defs>
                    <linearGradient id="colorWater" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#38BDF8" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#38BDF8" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="year" stroke="#64748B" tick={{ fontSize: 9 }} />
                  <YAxis stroke="#64748B" tick={{ fontSize: 9 }} hide />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: '#111827',
                      borderColor: '#263447',
                      fontSize: '11px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="waterDemandKld"
                    stroke="#38BDF8"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorWater)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Data Provenance & Integrity Status */}
        <div className="bg-[#111827] border border-[#263447] rounded-sm p-3 space-y-1.5">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block font-semibold">
            Data Provenance & Confidence Rating
          </span>
          <DataConfidenceTag provenance={selectedFacility.provenance} showDetails={true} />
        </div>

        {/* Action Buttons */}
        <div className="pt-2 border-t border-[#263447] space-y-2">
          <Button
            variant="secondary"
            size="sm"
            className="w-full justify-between"
            icon={<Activity className="w-3.5 h-3.5 text-emerald-400" />}
            onClick={() => navigate(`/risk-analysis?facility=${selectedFacility.id}`)}
          >
            <span>In-depth Risk Assessment</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
          </Button>

          <Button
            variant="secondary"
            size="sm"
            className="w-full justify-between"
            icon={<TrendingUp className="w-3.5 h-3.5 text-sky-400" />}
            onClick={() => navigate(`/forecast?facility=${selectedFacility.id}`)}
          >
            <span>ML Future Projections</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
          </Button>

          <Button
            variant="secondary"
            size="sm"
            className="w-full justify-between"
            icon={<Sparkles className="w-3.5 h-3.5 text-amber-400" />}
            onClick={() => navigate(`/mitigation?facility=${selectedFacility.id}`)}
          >
            <span>AI Mitigation Action Plan</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="w-full justify-between"
            icon={<FileText className="w-3.5 h-3.5 text-slate-400" />}
            onClick={() => navigate(`/reports?facility=${selectedFacility.id}`)}
          >
            <span>Export Intelligence Dossier</span>
            <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
          </Button>
        </div>
      </div>
    </aside>
  );
};
