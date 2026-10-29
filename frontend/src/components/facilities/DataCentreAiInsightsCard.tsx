import React, { useState } from 'react';
import {
  Sparkles,
  ShieldAlert,
  Droplets,
  Zap,
  Leaf,
  FileCheck2,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import type { PublicFacility } from '../../types/publicFacilities';
import type { EnvironmentalCurrentResponse } from '../../types/environmentalMonitoring';
import { generateDataCentreInsights, type FacilityIntervention } from '../../utils/dataCentreInsights';

export interface DataCentreAiInsightsCardProps {
  facility: PublicFacility;
  environmentalCurrent?: EnvironmentalCurrentResponse | null;
  compact?: boolean;
}

const CATEGORY_ICONS: Record<FacilityIntervention['category'], React.ReactNode> = {
  WATER_CONSERVATION: <Droplets className="h-3.5 w-3.5 text-cyan-400" />,
  POWER_GRID: <Zap className="h-3.5 w-3.5 text-amber-400" />,
  ENERGY_EFFICIENCY: <Leaf className="h-3.5 w-3.5 text-emerald-400" />,
  TERRAIN_CIVIL: <ShieldAlert className="h-3.5 w-3.5 text-purple-400" />,
  STATUTORY_COMPLIANCE: <FileCheck2 className="h-3.5 w-3.5 text-sky-400" />,
};

const CATEGORY_NAMES: Record<FacilityIntervention['category'], string> = {
  WATER_CONSERVATION: 'Water Conservation',
  POWER_GRID: 'Power Grid',
  ENERGY_EFFICIENCY: 'Energy Efficiency',
  TERRAIN_CIVIL: 'Terrain & Civil',
  STATUTORY_COMPLIANCE: 'Statutory Compliance',
};

export const DataCentreAiInsightsCard: React.FC<DataCentreAiInsightsCardProps> = ({
  facility,
  environmentalCurrent,
  compact = false,
}) => {
  const insights = generateDataCentreInsights(facility, environmentalCurrent);
  const [isExpanded, setIsExpanded] = useState(!compact);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  const filteredInterventions =
    selectedCategory === 'ALL'
      ? insights.interventions
      : insights.interventions.filter((i) => i.category === selectedCategory);

  const getTierBadge = () => {
    switch (insights.criticalityTier) {
      case 'TIER_1_ELEVATED':
        return (
          <span className="flex items-center gap-1 rounded bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 font-mono text-[10px] font-bold text-rose-400">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
            {insights.criticalityLabel}
          </span>
        );
      case 'TIER_2_MODERATE':
        return (
          <span className="flex items-center gap-1 rounded bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-400">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            {insights.criticalityLabel}
          </span>
        );
      case 'TIER_3_NOMINAL':
        return (
          <span className="flex items-center gap-1 rounded bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {insights.criticalityLabel}
          </span>
        );
    }
  };

  return (
    <div className="rounded-lg border border-eco-border/80 bg-eco-surface/90 shadow-xl backdrop-blur-md overflow-hidden select-text">
      {/* Card Header */}
      <div className="flex items-center justify-between gap-3 border-b border-eco-border/60 bg-eco-surface-secondary/40 px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-body font-bold text-eco-text tracking-tight truncate">
                AI Situational Briefing & Advisory
              </h3>
              <span className="hidden sm:inline-block rounded border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.2 font-mono text-[9px] font-bold text-emerald-400 uppercase">
                GROUNDED INSIGHTS
              </span>
            </div>
            <p className="text-micro text-eco-muted truncate">
              Authoritative screening playbooks · {insights.stateRegulatoryBody}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {getTierBadge()}
          {compact && (
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 text-eco-muted hover:text-eco-text transition-colors"
              aria-label={isExpanded ? 'Collapse AI insights' : 'Expand AI insights'}
            >
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="p-4 space-y-4">
          {/* Executive Vulnerability Synthesis */}
          <div className="rounded-md border border-eco-border/70 bg-eco-bg/70 p-3">
            <h4 className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-eco-primary">
              <AlertCircle className="h-3.5 w-3.5 text-emerald-400" />
              <span>Campus Vulnerability & Resource Posture</span>
            </h4>
            <p className="mt-1.5 text-meta text-eco-text leading-relaxed">
              {insights.vulnerabilityOverview}
            </p>
            <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 pt-2 border-t border-eco-border/30 font-mono text-micro text-eco-muted">
              <span>Discom Grid: <strong className="text-eco-text">{insights.stateDiscom}</strong></span>
              <span>•</span>
              <span>Regulatory Overseer: <strong className="text-eco-text">{insights.stateRegulatoryBody}</strong></span>
            </div>
          </div>

          {/* Actionable Interventions Section */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-meta font-bold uppercase tracking-wider text-eco-text">
                Recommended Engineering Interventions ({filteredInterventions.length})
              </h4>
              <div className="flex items-center gap-1 font-mono text-[10px]">
                {['ALL', 'WATER_CONSERVATION', 'POWER_GRID', 'ENERGY_EFFICIENCY'].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                      selectedCategory === cat
                        ? 'bg-emerald-400 text-black font-bold shadow-sm'
                        : 'border border-eco-border/60 bg-eco-surface text-eco-muted hover:text-eco-text'
                    }`}
                  >
                    {cat === 'ALL' ? 'ALL' : cat === 'WATER_CONSERVATION' ? 'WATER' : cat === 'POWER_GRID' ? 'POWER' : 'ENERGY'}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2.5">
              {filteredInterventions.map((item) => (
                <div
                  key={item.id}
                  className="rounded-md border border-eco-border/80 bg-eco-surface-secondary/30 p-3 shadow-xs hover:border-eco-primary/40 transition-colors"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-eco-border/30">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {CATEGORY_ICONS[item.category]}
                      <span className="font-mono text-[10px] font-semibold text-eco-muted uppercase">
                        {CATEGORY_NAMES[item.category]}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 font-mono text-[10px]">
                      <span
                        className={`rounded px-1.5 py-0.2 font-bold uppercase tracking-wider ${
                          item.priority === 'HIGH'
                            ? 'bg-rose-500/15 border border-rose-500/30 text-rose-400'
                            : item.priority === 'MODERATE'
                              ? 'bg-amber-500/15 border border-amber-500/30 text-amber-400'
                              : 'bg-sky-500/15 border border-sky-500/30 text-sky-400'
                        }`}
                      >
                        {item.priority} PRIORITY
                      </span>
                      <span className="text-eco-muted">{item.timeframe}</span>
                    </div>
                  </div>

                  <h5 className="mt-2 text-body font-semibold text-eco-text leading-snug">
                    {item.title}
                  </h5>

                  <p className="mt-1 text-meta text-eco-muted leading-relaxed">
                    {item.rationale}
                  </p>

                  <div className="mt-2.5 rounded bg-emerald-500/5 border border-emerald-500/20 px-2.5 py-1.5 font-mono text-[11px] text-emerald-400">
                    <strong>Expected Benefit:</strong> {item.expectedBenefit}
                  </div>

                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-eco-border/20 font-mono text-[10px] text-eco-muted">
                    <span className="truncate">Basis: {item.statutoryBasis}</span>
                    <span className="shrink-0 text-eco-text font-medium">Owner: {item.responsibleStakeholder}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Statutory Compliance Checklist */}
          {!compact && (
            <div className="rounded-md border border-eco-border/70 bg-eco-bg/50 p-3 space-y-2">
              <h4 className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-eco-text">
                <FileCheck2 className="h-3.5 w-3.5 text-sky-400" />
                <span>Statutory Clearances & Permitting Checklist</span>
              </h4>
              <div className="grid gap-2 sm:grid-cols-2">
                {insights.complianceChecklist.map((chk, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2 rounded border border-eco-border/50 bg-eco-surface/50 p-2 text-xs"
                  >
                    <span className="mt-0.5 text-emerald-400 font-bold">✓</span>
                    <div>
                      <p className="font-semibold text-eco-text">{chk.item}</p>
                      <p className="text-[10px] font-mono text-eco-primary">{chk.authority}</p>
                      <p className="mt-0.5 text-micro text-eco-muted">{chk.notes}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Regulatory Disclaimer */}
          <p className="text-[10px] font-mono text-eco-muted/90 leading-normal border-t border-eco-border/40 pt-2.5">
            <strong>Advisory Notice:</strong> {insights.disclaimer}
          </p>
        </div>
      )}
    </div>
  );
};

