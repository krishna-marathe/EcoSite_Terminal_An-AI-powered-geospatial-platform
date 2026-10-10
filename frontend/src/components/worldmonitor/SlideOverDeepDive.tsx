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
  Tooltip as RechartsTooltip,
} from 'recharts';
import { useDashboardStore } from '../../stores/dashboardStore';
import { RiskBadge } from '../ui/Badge';
import { DataConfidenceTag } from '../ui/DataConfidenceTag';
import { Button } from '../ui/Button';
import { scenarioAdjustedScore } from '../../utils/environmentalIntelligence';

export const SlideOverDeepDive: React.FC = () => {
  const {
    selectedFacility,
    setSelectedFacilityId,
    isRightPanelOpen,
    scenario,
  } = useDashboardStore();

  const navigate = useNavigate();

  if (!isRightPanelOpen || !selectedFacility) return null;

  const displayedScore = scenarioAdjustedScore(selectedFacility, scenario);

  const radarData = [
    { subject: 'Water Stress', value: selectedFacility.indicators.waterStress },
    { subject: 'Grid Pressure', value: selectedFacility.indicators.gridPressure },
    { subject: 'Air Pollution', value: selectedFacility.indicators.airPollution },
    { subject: 'Heat Exposure', value: selectedFacility.indicators.heatExposure },
    { subject: 'Flood Hazard', value: selectedFacility.indicators.floodHazard },
    { subject: 'Biodiversity', value: selectedFacility.indicators.biodiversityConstraint },
  ];

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-105 md:w-115 bg-[#080D16]/95 backdrop-blur-xl border-l border-[#1E293B] shadow-2xl flex flex-col font-sans text-xs select-none transition-transform duration-300">
      {/* Header */}
      <div className="p-3.5 bg-[#0F172A] border-b border-[#1E293B] flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase px-1.5 py-0.2 rounded bg-sky-950 text-sky-400 border border-sky-800 font-bold">
              {selectedFacility.type.replace('_', ' ')}
            </span>
            <RiskBadge level={displayedScore >= 80 ? 'critical' : displayedScore >= 65 ? 'high' : displayedScore >= 45 ? 'moderate' : 'low'} score={displayedScore} />
            <span className="text-[10px] text-slate-500">ID: {selectedFacility.id}</span>
          </div>
          <h2 className="text-base font-bold text-slate-100 font-sans tracking-tight leading-snug">
            {selectedFacility.name}
          </h2>
          <p className="text-[11px] text-slate-400">
            {selectedFacility.district}, {selectedFacility.state} • [
            {selectedFacility.coordinates[1].toFixed(4)}°N, {selectedFacility.coordinates[0].toFixed(4)}°E]
          </p>
        </div>

        <button
          type="button"
          onClick={() => setSelectedFacilityId(null)}
          className="p-1 text-slate-400 hover:text-slate-100 hover:bg-[#1E293B] rounded transition-colors"
          title="Close Dossier"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Core Metadata Grid */}
        <div className="grid grid-cols-2 gap-2 bg-[#0B111A] border border-[#1E293B] rounded-lg p-3">
          <div>
            <span className="text-[10px] text-slate-500 uppercase block">Installed Capacity</span>
            <span className="text-sm font-bold text-emerald-400">
              {selectedFacility.capacityMw ? `${selectedFacility.capacityMw.toLocaleString()} MW` : 'N/A'}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase block">Operator / Developer</span>
            <span className="text-xs font-bold text-slate-200 truncate block">
              {selectedFacility.operator || 'Verified Record'}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase block">Commissioned Year</span>
            <span className="text-xs text-slate-300">{selectedFacility.yearCommissioned || 2022}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase block">Operational Status</span>
            <span className="text-xs text-sky-400 font-bold">Active Telemetry</span>
          </div>
        </div>

        {/* 6-Axis Multi-Dimensional Radar */}
        <div className="bg-[#0B111A] border border-[#1E293B] rounded-lg p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-slate-200 uppercase flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-sky-400" />
              <span>Multidimensional Stress Profile</span>
            </span>
            <span className="text-[10px] text-slate-400">Score: {displayedScore}/100</span>
          </div>

          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData} margin={{ top: 10, right: 15, bottom: 10, left: 15 }}>
                <PolarGrid stroke="#1E293B" />
                <PolarAngleAxis dataKey="subject" stroke="#94A3B8" tick={{ fill: '#94A3B8', fontSize: 10 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#1E293B" tick={false} />
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

        {/* Key Contributing Vulnerabilities */}
        <div className="bg-[#0B111A] border border-[#1E293B] rounded-lg p-3 space-y-2">
          <div className="text-xs font-bold text-amber-400 uppercase flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Key Risk Drivers & Vulnerabilities</span>
          </div>
          <ul className="space-y-1.5 text-slate-300">
            {selectedFacility.keyRiskFactors.map((factor, i) => (
              <li key={i} className="flex items-start gap-1.5 text-[11px] leading-relaxed">
                <span className="text-amber-400 mt-0.5">•</span>
                <span className="font-sans">{factor}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Population Exposure Buffer */}
        <div className="bg-[#0B111A] border border-[#1E293B] rounded-lg p-3 space-y-2">
          <div className="text-xs font-bold text-slate-200 uppercase flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-rose-400" />
            <span>Nearby Population Exposure Density</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5 text-center font-mono">
            <div className="bg-[#131E2E] p-2 rounded-lg border border-[#1E293B]">
              <span className="text-[10px] text-slate-400 block">&lt; 5 km</span>
              <span className="text-sm font-bold text-slate-100">
                {(selectedFacility.nearbyPopulation.radius5km / 1000).toFixed(0)}k
              </span>
            </div>
            <div className="bg-[#131E2E] p-2 rounded-lg border border-[#1E293B]">
              <span className="text-[10px] text-slate-400 block">&lt; 15 km</span>
              <span className="text-sm font-bold text-slate-100">
                {(selectedFacility.nearbyPopulation.radius15km / 1000).toFixed(0)}k
              </span>
            </div>
            <div className="bg-[#131E2E] p-2 rounded-lg border border-[#1E293B]">
              <span className="text-[10px] text-slate-400 block">&lt; 25 km</span>
              <span className="text-sm font-bold text-slate-100">
                {(selectedFacility.nearbyPopulation.radius25km / 1000000).toFixed(1)}M
              </span>
            </div>
          </div>
        </div>

        {/* Historical Water & Power Trend */}
        {selectedFacility.historicalTrends && selectedFacility.historicalTrends.length > 0 && (
          <div className="bg-[#0B111A] border border-[#1E293B] rounded-lg p-3 space-y-1">
            <div className="flex items-center justify-between text-xs font-bold text-slate-200">
              <span className="flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                <span>5-Year Water Demand Trend (kLD)</span>
              </span>
              <span className="text-[10px] text-slate-400">2021 - 2025</span>
            </div>
            <div className="h-24 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={selectedFacility.historicalTrends}>
                  <defs>
                    <linearGradient id="wmWaterGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#38BDF8" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#38BDF8" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="year" stroke="#64748B" tick={{ fontSize: 9 }} />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: '#0F172A',
                      borderColor: '#1E293B',
                      fontSize: '11px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="waterDemandKld"
                    stroke="#38BDF8"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#wmWaterGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Dataset Provenance */}
        <div className="bg-[#0B111A] border border-[#1E293B] rounded-lg p-3 space-y-1.5">
          <span className="text-[10px] uppercase text-slate-400 block font-bold">
            Dataset Attribution & Provenance
          </span>
          <DataConfidenceTag provenance={selectedFacility.provenance} showDetails={true} />
          {scenario && <div className="mt-2 rounded border border-emerald-400/20 bg-emerald-950/20 px-2 py-1.5 text-[10px] text-emerald-200">Scenario-adjusted score: {displayedScore}/100 · {scenario.severity}% stress applied</div>}
        </div>

        {/* Navigation Action Buttons */}
        <div className="pt-2 border-t border-[#1E293B] space-y-2">
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
            <span>Generate Executive Report</span>
            <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
          </Button>
        </div>
      </div>
    </div>
  );
};
