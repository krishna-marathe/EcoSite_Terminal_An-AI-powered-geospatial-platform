import React, { useState, useEffect } from 'react';
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
  Cpu,
  Send,
  Loader2,
  Building2,
  Scale,
  Printer,
  ShieldCheck,
  Flame,
} from 'lucide-react';
import type { PublicFacility } from '../../types/publicFacilities';
import type { EnvironmentalCurrentResponse } from '../../types/environmentalMonitoring';
import { generateDataCentreInsights, type FacilityIntervention } from '../../utils/dataCentreInsights';
import {
  fetchFacilityAiAssist,
  fetchAiServiceStatus,
  type FacilityAiAssistResponse,
  type AiServiceStatus,
  type InspectionMode,
} from '../../services/aiAssist';

export interface DataCentreAiInsightsCardProps {
  facility: PublicFacility;
  environmentalCurrent?: EnvironmentalCurrentResponse | null;
  compact?: boolean;
}

const CATEGORY_ICONS: Record<FacilityIntervention['category'], React.ReactNode> = {
  WATER_CONSERVATION: <Droplets className="h-3 w-3 text-cyan-400" />,
  POWER_GRID: <Zap className="h-3 w-3 text-amber-400" />,
  ENERGY_EFFICIENCY: <Leaf className="h-3 w-3 text-emerald-400" />,
  TERRAIN_CIVIL: <ShieldAlert className="h-3 w-3 text-purple-400" />,
  STATUTORY_COMPLIANCE: <FileCheck2 className="h-3 w-3 text-sky-400" />,
};

const CATEGORY_NAMES: Record<FacilityIntervention['category'], string> = {
  WATER_CONSERVATION: 'Water Conservation',
  POWER_GRID: 'Power Grid',
  ENERGY_EFFICIENCY: 'Energy Efficiency',
  TERRAIN_CIVIL: 'Terrain & Civil',
  STATUTORY_COMPLIANCE: 'Statutory Compliance',
};

const INSPECTION_MODES: {
  id: InspectionMode;
  label: string;
  icon: React.ReactNode;
  subtitle: string;
}[] = [
  {
    id: 'MEITY_OVERSIGHT',
    label: 'MeitY & State IT',
    icon: <Building2 className="h-3 w-3 text-sky-400" />,
    subtitle: 'National infrastructure resilience & holistic operational continuity',
  },
  {
    id: 'SPCB_ENVIRONMENTAL',
    label: 'MoEFCC & SPCB',
    icon: <Leaf className="h-3 w-3 text-emerald-400" />,
    subtitle: 'Air/Water Acts, DG stack height criteria & emissions audit',
  },
  {
    id: 'CGWA_WATER',
    label: 'CGWA Water Board',
    icon: <Droplets className="h-3 w-3 text-cyan-400" />,
    subtitle: 'Aquifer stress classification, cooling towers & RWH recharge pits',
  },
  {
    id: 'CEA_GRID',
    label: 'CEA Grid Security',
    icon: <Zap className="h-3 w-3 text-amber-400" />,
    subtitle: '220kV EHV substation dual feeds, GIS switchgear & power quality',
  },
  {
    id: 'URBAN_RECEPTOR',
    label: 'Urban HSE / Receptor',
    icon: <ShieldAlert className="h-3 w-3 text-rose-400" />,
    subtitle: 'WorldPop human buffer, boundary noise attenuation & fuel safety',
  },
];

export const DataCentreAiInsightsCard: React.FC<DataCentreAiInsightsCardProps> = ({
  facility,
  environmentalCurrent,
  compact = false,
}) => {
  // Deterministic baseline is available synchronously with 0ms latency
  const baselineInsights = generateDataCentreInsights(facility, environmentalCurrent);

  const [aiData, setAiData] = useState<FacilityAiAssistResponse | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiServiceStatus, setAiServiceStatus] = useState<AiServiceStatus | null>(null);
  const [isExpanded, setIsExpanded] = useState(!compact);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [activeInspectionMode, setActiveInspectionMode] = useState<InspectionMode>('MEITY_OVERSIGHT');
  const [showPromptInput, setShowPromptInput] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');

  // The active view data: merges live AI response with deterministic baseline
  const activeInsights = aiData
    ? {
        criticalityTier: aiData.criticalityTier,
        criticalityLabel: aiData.criticalityLabel,
        vulnerabilityOverview: aiData.vulnerabilityOverview,
        stateRegulatoryBody: aiData.stateRegulatoryBody,
        stateDiscom: aiData.stateDiscom,
        interventions: aiData.interventions,
        complianceChecklist: aiData.complianceChecklist,
        infrastructureTelemetry: aiData.infrastructureTelemetry,
        ministryAssessment: aiData.ministryAssessment,
        disclaimer: aiData.disclaimer,
      }
    : {
        ...baselineInsights,
        ministryAssessment: {
          departmentPerspective: 'Ministry of Electronics and Information Technology (MeitY) & MoEFCC',
          statutoryRiskScore: baselineInsights.criticalityTier === 'TIER_1_ELEVATED' ? 68 : 45,
          complianceStatus: baselineInsights.criticalityTier === 'TIER_1_ELEVATED' ? ('ACTION_REQUIRED_MODERATE' as const) : ('COMPLIANT_NOMINAL' as const),
          officialDirective: `Review groundwater recharge telemetry logs and verify DG stack height formula (H = h + 0.2*sqrt(kVA)) during next ${baselineInsights.stateRegulatoryBody} CTO renewal.`,
          statutoryGaps: [
            'Groundwater recharge log telemetry verification pending with CGWA/state water board.',
            'Standby DG acoustic enclosure insertion loss test certification required.',
            'Dual-path EHV redundancy scheme verification with state transmission utility.',
          ],
          keyRegulatoryActs: [
            'Water (Prevention and Control of Pollution) Act 1974',
            'Air (Prevention and Control of Pollution) Act 1981',
            'Central Ground Water Authority (CGWA) Guidelines 2020/2023',
            'Central Electricity Authority (Technical Standards for Connectivity) Regulations',
          ],
        },
      };

  useEffect(() => {
    fetchAiServiceStatus().then(setAiServiceStatus).catch(() => {});
  }, []);

  const handleRunAiAssist = async (mode?: InspectionMode, queryPrompt?: string) => {
    setIsAiLoading(true);
    const targetMode = mode || activeInspectionMode;

    try {
      const response = await fetchFacilityAiAssist(
        facility.id,
        {
          inspection_mode: targetMode,
          custom_prompt: queryPrompt || (customPrompt.trim() ? customPrompt : undefined),
        },
        facility,
        environmentalCurrent,
      );
      setAiData(response);
    } catch (e) {
      console.warn('AI Assist error:', e);
    } finally {
      setIsAiLoading(false);
    }
  };

  const filteredInterventions =
    selectedCategory === 'ALL'
      ? activeInsights.interventions
      : activeInsights.interventions.filter((i) => i.category === selectedCategory);

  const getTierBadge = () => {
    switch (activeInsights.criticalityTier) {
      case 'TIER_1_ELEVATED':
        return (
          <span className="flex items-center gap-1 rounded bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 font-mono text-[10px] font-bold text-rose-400">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
            {activeInsights.criticalityLabel}
          </span>
        );
      case 'TIER_2_MODERATE':
        return (
          <span className="flex items-center gap-1 rounded bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-400">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            {activeInsights.criticalityLabel}
          </span>
        );
      case 'TIER_3_NOMINAL':
        return (
          <span className="flex items-center gap-1 rounded bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {activeInsights.criticalityLabel}
          </span>
        );
    }
  };

  const getComplianceStatusBadge = (status?: string) => {
    if (status === 'URGENT_INTERVENTION_CRITICAL') {
      return (
        <span className="flex items-center gap-1 rounded bg-rose-500/20 border border-rose-500/40 px-2 py-0.5 font-mono text-[10px] font-bold text-rose-400">
          <Flame className="h-3 w-3" /> URGENT INTERVENTION REQUIRED
        </span>
      );
    }
    if (status === 'ACTION_REQUIRED_MODERATE') {
      return (
        <span className="flex items-center gap-1 rounded bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-400">
          <AlertCircle className="h-3 w-3" /> ACTION REQUIRED · MODERATE ATTENTION
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1 rounded bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-400">
        <ShieldCheck className="h-3 w-3" /> NOMINAL POSTURE · STATUTORY ADHERENCE
      </span>
    );
  };

  return (
    <div className="rounded-lg border border-eco-border/80 bg-eco-surface/90 shadow-xl backdrop-blur-md overflow-hidden select-text">
      {/* Card Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-eco-border/60 bg-eco-surface-secondary/40 px-4 py-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
            <Sparkles className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-body font-bold text-eco-text tracking-tight truncate">
                AI Situational Briefing & Advisory
              </h3>
              <span className="hidden sm:inline-block rounded border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.2 font-mono text-[9px] font-bold text-emerald-400 uppercase">
                GROUNDED INSIGHTS
              </span>
              {aiData && (
                <span className="inline-flex items-center gap-1 rounded border border-sky-500/40 bg-sky-500/10 px-1.5 py-0.2 font-mono text-[9px] font-bold text-sky-400 uppercase">
                  <Cpu className="h-2.5 w-2.5" />
                  {aiData.status === 'live_ai' ? 'Gemini 3.8 Flash' : 'Baseline Engine'}
                </span>
              )}
            </div>
            <p className="text-micro text-eco-muted truncate">
              Official governmental condition briefing · {activeInsights.stateRegulatoryBody}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {getTierBadge()}
          <button
            type="button"
            onClick={() => handleRunAiAssist()}
            disabled={isAiLoading}
            className="flex items-center gap-1.5 rounded border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 font-mono text-[11px] font-semibold text-emerald-400 hover:bg-emerald-500/20 active:scale-95 transition-all cursor-pointer disabled:opacity-60"
            title="Generate live official assessment using Gemini 3.8 Flash"
          >
            {isAiLoading ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin text-emerald-400" />
                <span>Auditing...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-3 w-3 text-emerald-400" />
                <span>Ask Gemini 3.8 Flash</span>
              </>
            )}
          </button>
          {!compact && (
            <button
              type="button"
              onClick={() => window.print()}
              className="p-1 rounded text-eco-muted hover:text-eco-text hover:bg-eco-surface transition-colors cursor-pointer"
              title="Print / Export Official Dossier"
            >
              <Printer className="h-3.5 w-3.5" />
            </button>
          )}
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
          {/* Official Ministry & Regulator Perspective Toolbar */}
          <div className="rounded-md border border-eco-border/70 bg-eco-surface-secondary/30 p-2.5 space-y-2">
            <div className="flex items-center justify-between text-micro text-eco-muted uppercase tracking-wider font-mono">
              <span className="flex items-center gap-1 text-eco-primary font-bold">
                <Scale className="h-3.5 w-3.5 text-sky-400" />
                <span>Official Inspection Authority & Mandate:</span>
              </span>
              <span className="text-[10px] text-eco-muted">Click perspective to re-prompt AI</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 font-mono text-[10px]">
              {INSPECTION_MODES.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => {
                    setActiveInspectionMode(mode.id);
                    handleRunAiAssist(mode.id);
                  }}
                  className={`flex items-center justify-center gap-1.5 px-2 py-1.5 rounded cursor-pointer transition-all text-center ${
                    activeInspectionMode === mode.id
                      ? 'bg-emerald-400 text-black font-bold shadow-xs scale-[1.02]'
                      : 'border border-eco-border/60 bg-eco-surface text-eco-muted hover:text-eco-text hover:border-eco-primary/40'
                  }`}
                  title={mode.subtitle}
                >
                  {mode.icon}
                  <span className="truncate">{mode.label}</span>
                </button>
              ))}
            </div>

            {/* Custom Query Drawer */}
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-eco-border/30 text-[10px] font-mono">
              <button
                type="button"
                onClick={() => setShowPromptInput(!showPromptInput)}
                className={`flex items-center gap-1 px-2 py-0.5 rounded border border-eco-border/60 transition-colors cursor-pointer ${
                  showPromptInput ? 'bg-sky-500/20 text-sky-400 border-sky-500/40 font-bold' : 'text-eco-muted hover:text-eco-text'
                }`}
              >
                <Send className="h-2.5 w-2.5" />
                <span>Specific Official Directive / Custom Query...</span>
              </button>

              <span className="text-eco-muted truncate">
                Active Prompt Engine: <strong className="text-emerald-400">{aiData?.modelUsed || aiServiceStatus?.primaryModel || 'gemini-3.8-flash'}</strong>
              </span>
            </div>

            {showPromptInput && (
              <div className="flex items-center gap-2 pt-1 border-t border-eco-border/30">
                <input
                  type="text"
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleRunAiAssist(activeInspectionMode, customPrompt);
                    }
                  }}
                  placeholder="Official inquiry (e.g., Does this 40MW campus meet CGWA ZLD blowdown mandates in semi-critical blocks?)..."
                  className="flex-1 rounded border border-eco-border/80 bg-eco-bg px-2.5 py-1 text-meta text-eco-text placeholder:text-eco-muted/70 focus:outline-none focus:border-emerald-400/80 font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={() => handleRunAiAssist(activeInspectionMode, customPrompt)}
                  disabled={isAiLoading}
                  className="flex items-center gap-1 rounded bg-emerald-500/20 border border-emerald-500/40 px-2.5 py-1 text-xs font-mono font-bold text-emerald-400 hover:bg-emerald-500/30 transition-colors cursor-pointer"
                >
                  <Send className="h-3 w-3" />
                  <span>Execute</span>
                </button>
              </div>
            )}
          </div>

          {/* Official Departmental Directive & Risk Assessment Panel */}
          {activeInsights.ministryAssessment && (
            <div className="rounded-md border border-sky-500/40 bg-sky-950/20 p-3 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-sky-500/20">
                <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-sky-400 uppercase">
                  <Building2 className="h-3.5 w-3.5" />
                  <span>{activeInsights.ministryAssessment.departmentPerspective}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-eco-muted">
                    Statutory Risk Score: <strong className="text-amber-400">{activeInsights.ministryAssessment.statutoryRiskScore}/100</strong>
                  </span>
                  {getComplianceStatusBadge(activeInsights.ministryAssessment.complianceStatus)}
                </div>
              </div>

              {/* Official Directive */}
              <div>
                <p className="font-mono text-[10px] uppercase tracking-wider text-eco-muted font-bold">
                  Recommended Departmental Action / Order:
                </p>
                <p className="mt-1 text-body font-semibold text-sky-200 border-l-2 border-sky-400 pl-2.5 leading-snug">
                  {activeInsights.ministryAssessment.officialDirective}
                </p>
              </div>

              {/* Statutory Gaps / Watchlist */}
              {activeInsights.ministryAssessment.statutoryGaps.length > 0 && (
                <div className="space-y-1 pt-1">
                  <p className="font-mono text-[10px] uppercase tracking-wider text-eco-muted font-bold">
                    Regulatory Scrutiny Points & Potential Vulnerabilities:
                  </p>
                  <ul className="grid gap-1 sm:grid-cols-2 text-meta text-eco-text font-mono text-xs">
                    {activeInsights.ministryAssessment.statutoryGaps.map((gap, idx) => (
                      <li key={idx} className="flex items-start gap-1.5 rounded bg-eco-bg/60 p-1.5 border border-eco-border/40">
                        <span className="text-amber-400 font-bold shrink-0">!</span>
                        <span className="leading-tight">{gap}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Statutory Acts */}
              {activeInsights.ministryAssessment.keyRegulatoryActs.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-sky-500/20 font-mono text-[9px]">
                  <span className="text-eco-muted uppercase font-bold">Applicable Acts:</span>
                  {activeInsights.ministryAssessment.keyRegulatoryActs.map((act, idx) => (
                    <span key={idx} className="rounded bg-sky-500/10 border border-sky-500/30 px-1.5 py-0.2 text-sky-300">
                      {act}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Executive Vulnerability & Resource Posture Synthesis */}
          <div className="rounded-md border border-eco-border/70 bg-eco-bg/70 p-3">
            <h4 className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-eco-primary">
              <AlertCircle className="h-3.5 w-3.5 text-emerald-400" />
              <span>Campus Vulnerability & Resource Posture</span>
            </h4>
            <p className="mt-1.5 text-meta text-eco-text leading-relaxed">
              {activeInsights.vulnerabilityOverview}
            </p>
            <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 pt-2 border-t border-eco-border/30 font-mono text-micro text-eco-muted">
              <span>Discom Grid: <strong className="text-eco-text">{activeInsights.stateDiscom}</strong></span>
              <span>•</span>
              <span>Regulatory Overseer: <strong className="text-eco-text">{activeInsights.stateRegulatoryBody}</strong></span>
              {aiData && (
                <>
                  <span>•</span>
                  <span>Evaluated At: <strong className="text-eco-text">{new Date(aiData.generatedAt).toLocaleTimeString()}</strong></span>
                </>
              )}
            </div>
          </div>

          {/* Substation & Population Telemetry Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-[11px]">
            {/* Electrical Substation Proximity */}
            <div className="rounded border border-eco-border/80 bg-eco-surface-secondary/40 p-2.5 space-y-1">
              <div className="flex items-center justify-between text-micro text-eco-muted uppercase tracking-wider">
                <span className="flex items-center gap-1 text-amber-400 font-bold">
                  <Zap className="h-3 w-3" /> EHV Grid Substation
                </span>
                <span className="rounded bg-emerald-500/10 border border-emerald-500/30 px-1 py-0.2 text-[9px] text-emerald-400 font-bold">
                  {activeInsights.infrastructureTelemetry.substation.status}
                </span>
              </div>
              <div className="text-body font-bold text-eco-text truncate">
                {activeInsights.infrastructureTelemetry.substation.name}
              </div>
              <div className="flex items-center justify-between text-meta text-eco-muted pt-0.5">
                <span>Distance: <strong className="text-eco-text">{activeInsights.infrastructureTelemetry.substation.distanceKm} km</strong></span>
                <span>Rating: <strong className="text-amber-400">{activeInsights.infrastructureTelemetry.substation.voltageKv} kV</strong></span>
              </div>
            </div>

            {/* Human Receptor & Population Density */}
            <div className="rounded border border-eco-border/80 bg-eco-surface-secondary/40 p-2.5 space-y-1">
              <div className="flex items-center justify-between text-micro text-eco-muted uppercase tracking-wider">
                <span className="flex items-center gap-1 text-cyan-400 font-bold">
                  <Leaf className="h-3 w-3" /> Population Context
                </span>
                <span className="rounded bg-sky-500/10 border border-sky-500/30 px-1 py-0.2 text-[9px] text-sky-400 font-bold">
                  {activeInsights.infrastructureTelemetry.population.densityBand.replace('_', ' ')}
                </span>
              </div>
              <div className="text-body font-bold text-eco-text">
                {activeInsights.infrastructureTelemetry.population.densityPerKm2.toLocaleString()} persons/km²
              </div>
              <div className="text-micro text-eco-muted line-clamp-1 pt-0.5" title={activeInsights.infrastructureTelemetry.population.bufferAlert}>
                {activeInsights.infrastructureTelemetry.population.bufferAlert}
              </div>
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
                {activeInsights.complianceChecklist.map((chk, idx) => (
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
            <strong>Advisory Notice:</strong> {activeInsights.disclaimer}
          </p>
        </div>
      )}
    </div>
  );
};
