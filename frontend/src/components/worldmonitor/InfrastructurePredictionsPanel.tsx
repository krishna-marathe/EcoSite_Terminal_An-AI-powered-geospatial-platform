import React, { useState } from 'react';
import { TrendingUp, AlertTriangle, CheckCircle2, ShieldAlert, Sparkles, Filter } from 'lucide-react';
import { DashboardPanel } from '../data-centre-dashboard';

export interface InfrastructurePrediction {
  id: string;
  category: 'WATER' | 'POWER_GRID' | 'ENVIRONMENTAL';
  region: string;
  stateCode: 'IN-MH' | 'IN-TG' | 'IN-KA' | 'IN-TN';
  title: string;
  targetDate: string;
  volume: string;
  lean: 'CRITICAL' | 'ALERT' | 'MODERATE' | 'ON TRACK';
  probability: number; // 0 to 100 (% probability of risk / event occurring)
  riskLabel: string;
  safeLabel: string;
  metricSource: string;
}

const PREDICTIONS: InfrastructurePrediction[] = [
  {
    id: 'pune-chakan-groundwater',
    category: 'WATER',
    region: 'Pune Chakan Industrial Hub',
    stateCode: 'IN-MH',
    title: 'Chakan Taluka Groundwater Over-Extraction (>100% stage) Breached by Q4 2026?',
    targetDate: 'Dec 31, 2026',
    volume: '19 Facilities Screened',
    lean: 'CRITICAL',
    probability: 74,
    riskLabel: 'HIGH RISK 74%',
    safeLabel: 'NOMINAL 26%',
    metricSource: 'CGWB 2024 Dynamic GW Assessment & JRC GSW',
  },
  {
    id: 'chennai-sriperumbudur-grid',
    category: 'POWER_GRID',
    region: 'Sriperumbudur Hyperscaler Corridor',
    stateCode: 'IN-TN',
    title: 'Peak Summer 230kV Substation N-1 Transmission Curtailment Probability?',
    targetDate: 'May 31, 2027',
    volume: '4.2 GW Peak Load',
    lean: 'ALERT',
    probability: 64,
    riskLabel: 'CURTAILMENT RISK 64%',
    safeLabel: 'GRID STABLE 36%',
    metricSource: 'TANGEDCO Peak Load Bulletin & CEA Transmission Study',
  },
  {
    id: 'hyderabad-genome-valley-water',
    category: 'WATER',
    region: 'Hyderabad Genome Valley & Financial Dist',
    stateCode: 'IN-TG',
    title: 'Summer Bulk Water Industrial Quota Allocation Reduced by >15%?',
    targetDate: 'Apr 30, 2027',
    volume: '14 Campuses Monitored',
    lean: 'MODERATE',
    probability: 52,
    riskLabel: 'DEFICIT 52%',
    safeLabel: 'SECURE 48%',
    metricSource: 'HMWSSB Reservoir Depletion Curve & CPCB Discharge Baselines',
  },
  {
    id: 'bengaluru-whitefield-substation',
    category: 'POWER_GRID',
    region: 'Bengaluru Devanahalli Corridor',
    stateCode: 'IN-KA',
    title: 'KPTCL 220/66kV Substation Feeder Commissioning Achieves Scheduled COD?',
    targetDate: 'Mar 31, 2027',
    volume: '3.1 GW Planned',
    lean: 'ON TRACK',
    probability: 22, // 22% risk of delay = 78% on track
    riskLabel: 'DELAY RISK 22%',
    safeLabel: 'ON TRACK 78%',
    metricSource: 'KPTCL Transmission Expansion Registry & BESCOM Filings',
  },
];

export const InfrastructurePredictionsPanel: React.FC = () => {
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'WATER' | 'POWER_GRID'>('ALL');

  const filtered = selectedFilter === 'ALL'
    ? PREDICTIONS
    : PREDICTIONS.filter((p) => p.category === selectedFilter);

  const getLeanBadge = (lean: InfrastructurePrediction['lean']) => {
    switch (lean) {
      case 'CRITICAL':
        return 'border-rose-500/40 bg-rose-500/15 text-rose-400';
      case 'ALERT':
        return 'border-amber-500/40 bg-amber-500/15 text-amber-400';
      case 'MODERATE':
        return 'border-yellow-500/40 bg-yellow-500/15 text-yellow-400';
      case 'ON TRACK':
        return 'border-emerald-500/40 bg-emerald-500/15 text-emerald-400';
    }
  };

  return (
    <DashboardPanel
      title="Infrastructure & risk predictions"
      eyebrow="Tactical situational forecast"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-eco-border/40">
        <div className="flex items-center gap-1.5 font-mono text-[10px]">
          <span className="flex items-center gap-1 text-emerald-400 font-bold">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            FRESH 1m
          </span>
          <span className="text-eco-border">•</span>
          <span className="rounded border border-eco-border/80 bg-eco-bg px-1.5 py-0.5 text-eco-muted">
            ANALYTIC GAUGES
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-meta text-eco-muted">
          <Filter className="h-3 w-3" />
          <span>Category filter:</span>
          <div className="flex items-center gap-1 font-mono text-micro ml-1">
            {(['ALL', 'WATER', 'POWER_GRID'] as const).map((filterKey) => (
              <button
                key={filterKey}
                type="button"
                onClick={() => setSelectedFilter(filterKey)}
                className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                  selectedFilter === filterKey
                    ? 'bg-emerald-400 font-bold text-black shadow-sm'
                    : 'text-eco-muted hover:text-eco-text border border-eco-border/60 bg-eco-surface'
                }`}
              >
                {filterKey}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-3 mt-3">
        {filtered.map((item) => (
          <div
            key={item.id}
            className="group rounded-md border border-eco-border/80 bg-eco-surface/70 p-3 shadow-sm backdrop-blur-sm transition-all hover:border-eco-primary/50 hover:bg-eco-surface-secondary/40"
          >
            {/* Header / Meta Row */}
            <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-eco-border/30 font-mono text-[10px]">
              <div className="flex items-center gap-1.5">
                <span className="rounded bg-eco-primary/10 border border-eco-primary/30 px-1.5 py-0.2 font-bold text-eco-primary uppercase">
                  {item.stateCode}
                </span>
                <span className="text-eco-muted truncate max-w-[140px] sm:max-w-none">
                  {item.region}
                </span>
              </div>
              <span className={`rounded border px-1.5 py-0.2 font-bold uppercase tracking-wider ${getLeanBadge(item.lean)}`}>
                LEAN {item.lean}
              </span>
            </div>

            {/* Question / Title */}
            <h4 className="mt-2 text-body font-semibold text-eco-text leading-snug group-hover:text-eco-primary transition-colors">
              {item.title}
            </h4>

            {/* Sub-metrics */}
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] text-eco-muted">
              <span>Scope: <strong className="text-eco-text font-medium">{item.volume}</strong></span>
              <span>•</span>
              <span>Horizon: <strong className="text-eco-text font-medium">{item.targetDate}</strong></span>
            </div>

            {/* Dual Probability Bar (World Monitor Polymarket-style) */}
            <div className="mt-2.5 space-y-1">
              <div className="flex items-center justify-between font-mono text-[10px] font-bold">
                <span className={item.probability >= 50 ? 'text-rose-400' : 'text-amber-400'}>
                  {item.riskLabel}
                </span>
                <span className="text-emerald-400">
                  {item.safeLabel}
                </span>
              </div>

              {/* Progress track */}
              <div className="flex h-2 w-full overflow-hidden rounded-full bg-eco-bg border border-eco-border/60">
                <div
                  className={`transition-all duration-500 ${
                    item.probability >= 65
                      ? 'bg-rose-500'
                      : item.probability >= 45
                        ? 'bg-amber-500'
                        : 'bg-yellow-500'
                  }`}
                  style={{ width: `${item.probability}%` }}
                />
                <div
                  className="bg-emerald-500 transition-all duration-500"
                  style={{ width: `${100 - item.probability}%` }}
                />
              </div>
            </div>

            {/* Source Provenance */}
            <div className="mt-2 flex items-center justify-between pt-1 border-t border-eco-border/20 font-mono text-[9px] text-eco-muted">
              <span className="truncate">Source: {item.metricSource}</span>
              <span className="shrink-0 text-emerald-400/80">AUTOMATED SCREENING MODEL</span>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-3 text-micro text-eco-muted">
        Infrastructure prediction gauges are algorithmic probabilistic models combining CGWB groundwater stage,
        CEA grid transmission studies, and SRTM elevation contours. They are screening signals, never legal guarantees.
      </p>
    </DashboardPanel>
  );
};

