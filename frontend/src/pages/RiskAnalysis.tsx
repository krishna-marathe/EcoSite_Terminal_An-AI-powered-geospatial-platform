import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Activity,
  Sliders,
  AlertTriangle,
  Info,
  CheckCircle2,
  RotateCcw,
  TrendingUp,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Cell,
} from 'recharts';
import { DEMO_FACILITIES } from '../data/demo/facilities';
import {
  DEFAULT_SECTOR_WEIGHTS,
  calculateWeightedRiskScore,
  getExplainableIndicators,
  getRiskLevel,
  type SectorWeights,
} from '../services/risk';
import { RiskBadge } from '../components/ui/Badge';
import { DataConfidenceTag } from '../components/ui/DataConfidenceTag';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';

export const RiskAnalysis: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const facilityIdParam = searchParams.get('facility');

  const selectedFacility =
    DEMO_FACILITIES.find((f) => f.id === facilityIdParam) || DEMO_FACILITIES[0];

  const defaultWeights =
    DEFAULT_SECTOR_WEIGHTS[selectedFacility.type] || DEFAULT_SECTOR_WEIGHTS.data_centre;
  const [customWeights, setCustomWeights] = useState<SectorWeights | null>(null);
  const weights = customWeights || defaultWeights;

  const [isCustomizingWeights, setIsCustomizingWeights] = useState(false);

  const handleFacilityChange = (facilityId: string) => {
    setSearchParams({ facility: facilityId });
    setCustomWeights(null);
  };

  const handleResetWeights = () => {
    setCustomWeights(null);
  };

  const currentScore = calculateWeightedRiskScore(selectedFacility.indicators, weights);
  const currentRiskLevel = getRiskLevel(currentScore);
  const indicators = getExplainableIndicators(selectedFacility, weights);

  // Prepare contribution chart data
  const sumWeights = Object.values(weights).reduce((a, b) => a + b, 0);
  const contributionData = indicators.map((ind) => {
    const rawContribution = (ind.score * (weights[ind.key as keyof SectorWeights] / sumWeights));
    const percentOfTotal = currentScore > 0 ? (rawContribution / currentScore) * 100 : 0;
    return {
      name: ind.name.split(' ')[0],
      fullName: ind.name,
      score: ind.score,
      contribution: Math.round(percentOfTotal),
      key: ind.key,
      color:
        ind.score >= 80
          ? '#EF4444'
          : ind.score >= 65
          ? '#F59E0B'
          : ind.score >= 45
          ? '#38BDF8'
          : '#22C55E',
    };
  });

  return (
    <div className="flex-1 flex flex-col h-full bg-[#080D16] overflow-y-auto p-4 md:p-6 space-y-6 select-none font-sans">
      {/* Page Header & Selector Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#263447]">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase font-mono tracking-wider text-sky-400 bg-sky-950/80 px-2 py-0.5 rounded border border-sky-800">
              Module 02
            </span>
            <h1 className="text-lg md:text-xl font-bold text-slate-100 font-mono tracking-tight">
              Explainable Environmental Risk Screening
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl">
            Sector-weighted environmental risk screening evaluating cumulative impact across aquifer stress, ambient air loading, thermal microclimates, and biodiversity zones.
          </p>
        </div>

        {/* Facility Selector */}
        <div className="flex items-center gap-3 shrink-0">
          <label className="text-xs text-slate-400 font-mono">Select Facility:</label>
          <select
            value={selectedFacility.id}
            onChange={(e) => handleFacilityChange(e.target.value)}
            className="bg-[#111827] border border-[#263447] text-slate-100 rounded-sm px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-sky-500 max-w-xs"
          >
            {DEMO_FACILITIES.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} ({f.state} - {f.type.replace('_', ' ')})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Statutory Clearance & Legal Integrity Disclaimer */}
      <div className="p-3 bg-amber-950/30 border border-amber-600/40 rounded-sm flex items-start gap-3 text-xs text-amber-300">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
        <div className="space-y-0.5">
          <span className="font-semibold uppercase tracking-wider font-mono">
            Planning & Pre-Feasibility Screening Notice
          </span>
          <p className="text-amber-200/80 leading-relaxed text-[11px]">
            This score is an automated geospatial screening index calibrated for early-stage spatial planning. It does not constitute a formal statutory Environmental Impact Assessment (EIA) or MoEFCC clearance determination under the Environment (Protection) Act, 1986.
          </p>
        </div>
      </div>

      {/* Primary Scorecard & Sector Weighting Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Overall Screening Scorecard */}
        <Card
          className="lg:col-span-1 flex flex-col justify-between"
          title="Compound Screening Score"
          subtitle={`${selectedFacility.name}`}
          icon={<Activity className="w-4 h-4 text-sky-400" />}
        >
          <div className="flex flex-col items-center justify-center py-4 space-y-3">
            <div className="relative flex items-center justify-center">
              <div
                className={`w-32 h-32 rounded-full border-4 flex flex-col items-center justify-center shadow-2xl ${
                  currentScore >= 80
                    ? 'border-rose-500 bg-rose-950/30 text-rose-400 shadow-rose-500/20'
                    : currentScore >= 65
                    ? 'border-amber-500 bg-amber-950/30 text-amber-400 shadow-amber-500/20'
                    : currentScore >= 45
                    ? 'border-sky-500 bg-sky-950/30 text-sky-400 shadow-sky-500/20'
                    : 'border-emerald-500 bg-emerald-950/30 text-emerald-400 shadow-emerald-500/20'
                }`}
              >
                <span className="text-4xl font-extrabold font-mono tracking-tighter">
                  {currentScore}
                </span>
                <span className="text-[10px] uppercase font-mono tracking-widest text-slate-400">
                  out of 100
                </span>
              </div>
            </div>

            <RiskBadge level={currentRiskLevel} score={currentScore} />

            <div className="text-center space-y-1 font-mono text-xs">
              <span className="text-slate-400 text-[11px] block">
                Infrastructure Category: <strong className="text-slate-200 uppercase">{selectedFacility.type.replace('_', ' ')}</strong>
              </span>
              <span className="text-slate-500 text-[10px] block">
                Model: Sector-Specific Linear Multi-Criteria Analysis (MCA)
              </span>
            </div>
          </div>

          <div className="pt-3 border-t border-[#263447] flex items-center justify-between text-xs font-mono">
            <Button
              variant="outline"
              size="xs"
              icon={<Sliders className="w-3.5 h-3.5" />}
              onClick={() => setIsCustomizingWeights(!isCustomizingWeights)}
            >
              {isCustomizingWeights ? 'Close Weight Tuner' : 'Configure Sector Weights'}
            </Button>
            {isCustomizingWeights && (
              <button
                type="button"
                onClick={handleResetWeights}
                className="text-[11px] text-amber-400 hover:underline flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                Reset Defaults
              </button>
            )}
          </div>
        </Card>

        {/* Risk Contribution Chart */}
        <Card
          className="lg:col-span-2"
          title="Indicator Risk Contribution Breakdown"
          subtitle="Relative percentage contribution of each vector to the compound screening score"
          icon={<TrendingUp className="w-4 h-4 text-emerald-400" />}
        >
          <div className="h-60 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={contributionData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <XAxis
                  dataKey="name"
                  stroke="#64748B"
                  tick={{ fill: '#94A3B8', fontSize: 10, fontFamily: 'monospace' }}
                  angle={-15}
                  textAnchor="end"
                />
                <YAxis
                  stroke="#64748B"
                  tick={{ fill: '#94A3B8', fontSize: 10 }}
                  unit="%"
                />
                <RechartsTooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-[#111827] border border-[#263447] p-2.5 rounded shadow-xl text-xs font-mono">
                          <p className="font-bold text-slate-100">{data.fullName}</p>
                          <p className="text-slate-400">Score: <strong className="text-slate-200">{data.score}/100</strong></p>
                          <p className="text-sky-400">Contribution: <strong>{data.contribution}%</strong></p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="contribution" radius={[4, 4, 0, 0]}>
                  {contributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Interactive Weight Adjustment Sliders (When Opened) */}
      {isCustomizingWeights && (
        <Card
          title="Custom Transparent Weight Configuration"
          subtitle="Adjust weights according to local environmental priorities; scores recalculate in real-time"
          icon={<Sliders className="w-4 h-4 text-amber-400" />}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-2 text-xs font-mono">
            {Object.keys(weights).map((key) => {
              const k = key as keyof SectorWeights;
              const weightVal = weights[k];
              const pct = Math.round((weightVal / sumWeights) * 100);
              return (
                <div key={k} className="bg-[#172131] p-3 rounded border border-[#263447] space-y-1.5">
                  <div className="flex justify-between items-center text-slate-300">
                    <span className="capitalize">{k.replace(/([A-Z])/g, ' $1')}</span>
                    <span className="text-sky-400 font-bold">{pct}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="0.5"
                    step="0.01"
                    value={weightVal}
                    onChange={(e) =>
                      setCustomWeights((prev) => ({
                        ...(prev || defaultWeights),
                        [k]: parseFloat(e.target.value),
                      }))
                    }
                    className="w-full accent-sky-400 h-1.5 bg-[#263447] rounded cursor-pointer"
                  />
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* 8 Detailed Indicator Cards with Explanations & Provenance */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-200 font-mono uppercase tracking-wider flex items-center gap-2">
            <Info className="w-4 h-4 text-sky-400" />
            <span>Detailed Indicator Dossiers & Verification Protocol</span>
          </h2>
          <span className="text-xs text-slate-400 font-mono">8 Statutory Vectors</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {indicators.map((indicator) => (
            <div
              key={indicator.key}
              className="bg-[#111827] border border-[#263447] rounded-sm p-4 space-y-3 hover:border-slate-600 transition-colors"
            >
              <div className="flex items-start justify-between gap-2 border-b border-[#263447]/80 pb-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-100">{indicator.name}</h3>
                  <p className="text-xs font-mono text-slate-400 mt-0.5">
                    {indicator.valueDescription}
                  </p>
                </div>
                <RiskBadge level={indicator.status} score={indicator.score} />
              </div>

              {/* Technical Rationale */}
              <div className="space-y-1 text-xs text-slate-300">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 block">
                  Assessment Rationale
                </span>
                <p className="leading-relaxed text-[11px] text-slate-300">
                  {indicator.explanation}
                </p>
              </div>

              {/* Recommended Verification Steps */}
              <div className="bg-[#172131]/70 p-2.5 rounded border border-[#263447] space-y-1">
                <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Recommended Verification Action</span>
                </span>
                <p className="text-[11px] text-slate-300 leading-relaxed font-sans">
                  {indicator.mitigationPrompt}
                </p>
              </div>

              {/* Dataset Provenance */}
              <div className="pt-2 border-t border-[#263447]/60">
                <DataConfidenceTag provenance={indicator.provenance} showDetails={true} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
