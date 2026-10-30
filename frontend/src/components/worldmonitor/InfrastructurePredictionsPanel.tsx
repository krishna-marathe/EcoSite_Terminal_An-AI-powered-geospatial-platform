import React, { useState } from 'react';
import { Filter } from 'lucide-react';
import { DashboardPanel } from '../data-centre-dashboard';

export interface InfrastructurePrediction {
  id: string;
  category: 'WATER' | 'POWER_GRID' | 'ENVIRONMENTAL';
  region: string;
  stateCode: 'IN-MH' | 'IN-TG' | 'IN-KA' | 'IN-TN';
  title: string;
  targetDate: string;
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
        return 'border-eco-critical500/40 bg-eco-critical/10500/15 text-eco-critical';
      case 'ALERT':
        return 'border-eco-warning500/40 bg-eco-warning/10500/15 text-eco-warning';
      case 'MODERATE':
        return 'border-eco-warning500/40 bg-eco-warning/10500/15 text-eco-warning400';
      case 'ON TRACK':
        return 'border-eco-primary500/40 bg-eco-primary/10500/15 text-eco-primary';
    }
  };

  return (
    <DashboardPanel
      title="Infrastructure & risk predictions"
      eyebrow="Illustrative screening scenarios"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-eco-border/40 pb-2">
        <div className="flex items-center gap-1.5 font-mono text-micro">
          <span className="rounded border border-eco-warning/40 bg-eco-warning/10 px-1.5 py-0.5 text-eco-warning">
            ILLUSTRATIVE — NOT A LIVE FORECAST
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
                    ? 'bg-eco-primary/10400 font-bold text-black shadow-sm'
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
            <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-eco-border/30 font-mono text-meta">
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
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-micro text-eco-muted">
              <span>Horizon: <strong className="text-eco-text font-medium">{item.targetDate}</strong></span>
            </div>

            {/* Dual Probability Bar (World Monitor Polymarket-style) */}
            <div className="mt-2.5 space-y-1">
              <div className="flex items-center justify-between font-mono text-meta font-bold">
                <span className={item.probability >= 50 ? 'text-eco-critical' : 'text-eco-warning'}>
                  {item.riskLabel}
                </span>
                <span className="text-eco-primary">
                  {item.safeLabel}
                </span>
              </div>

              {/* Progress track */}
              <div className="flex h-2 w-full overflow-hidden rounded-full bg-eco-bg border border-eco-border/60">
                <div
                  className={`transition-all duration-500 ${
                    item.probability >= 65
                      ? 'bg-eco-critical/10500'
                      : item.probability >= 45
                        ? 'bg-eco-warning/10500'
                        : 'bg-eco-warning/10500'
                  }`}
                  style={{ width: `${item.probability}%` }}
                />
                <div
                  className="bg-eco-primary/10500 transition-all duration-500"
                  style={{ width: `${100 - item.probability}%` }}
                />
              </div>
            </div>

            {/* Source Provenance */}
            <div className="mt-2 border-t border-eco-border/20 pt-1 font-mono text-micro text-eco-muted">
              <span className="truncate">Scenario basis: {item.metricSource}</span>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-3 text-micro text-eco-muted">
        These scenarios are illustrative examples of the screening questions the platform is designed to ask. They are
        not live forecasts, are not computed from the current provider feeds, and are never legal guarantees.
      </p>
    </DashboardPanel>
  );
};

