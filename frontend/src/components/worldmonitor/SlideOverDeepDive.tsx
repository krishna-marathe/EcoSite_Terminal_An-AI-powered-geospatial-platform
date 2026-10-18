import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X,
  Activity,
  AlertTriangle,
  TrendingUp,
  FileText,
  ArrowRight,
  Users,
  Wrench,
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
import {
  DATA_STATUS_LABELS,
  FACILITY_TYPE_COLORS,
  FACILITY_TYPE_LABELS,
  eco,
  scoreColor,
} from '../../theme/tokens';

export const SlideOverDeepDive: React.FC = () => {
  const {
    selectedFacility,
    setSelectedFacilityId,
    isRightPanelOpen,
    scenario,
  } = useDashboardStore();

  const navigate = useNavigate();

  useEffect(() => {
    if (!isRightPanelOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedFacilityId(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isRightPanelOpen, setSelectedFacilityId]);

  if (!isRightPanelOpen || !selectedFacility) return null;

  const facility = selectedFacility;
  const displayedScore = scenarioAdjustedScore(facility, scenario);

  const riskLevel =
    displayedScore >= 80
      ? 'critical'
      : displayedScore >= 65
        ? 'high'
        : displayedScore >= 45
          ? 'moderate'
          : 'low';

  const radarData = [
    { subject: 'Water stress', value: facility.indicators.waterStress },
    { subject: 'Grid pressure', value: facility.indicators.gridPressure },
    { subject: 'Air pollution', value: facility.indicators.airPollution },
    { subject: 'Heat exposure', value: facility.indicators.heatExposure },
    { subject: 'Flood hazard', value: facility.indicators.floodHazard },
    { subject: 'Biodiversity', value: facility.indicators.biodiversityConstraint },
  ];

  const trend = facility.historicalTrends ?? [];
  const trendYears = trend.length > 0 ? `${trend[0].year}–${trend[trend.length - 1].year}` : '';

  return (
    <div
      role="dialog"
      aria-label={`Facility dossier: ${facility.name}`}
      className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-eco-border bg-eco-bg/95 text-eco-text shadow-2xl backdrop-blur-xl select-none sm:w-105 md:w-115"
    >
      {/* Header */}
      <header className="flex items-start justify-between gap-3 border-b border-eco-border bg-eco-surface p-3.5">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="rounded border px-1.5 py-0.5 font-mono text-micro uppercase tracking-wide"
              style={{
                backgroundColor: `${FACILITY_TYPE_COLORS[facility.type]}1a`,
                borderColor: `${FACILITY_TYPE_COLORS[facility.type]}55`,
                color: FACILITY_TYPE_COLORS[facility.type],
              }}
            >
              {FACILITY_TYPE_LABELS[facility.type]}
            </span>
            <RiskBadge level={riskLevel} score={displayedScore} />
            <span className="font-mono text-micro text-eco-muted">ID {facility.id}</span>
          </div>
          <h2 className="text-body font-semibold leading-snug text-eco-text">{facility.name}</h2>
          <p className="text-meta text-eco-muted">
            {facility.district}, {facility.state} · [{facility.coordinates[1].toFixed(4)}°N,{' '}
            {facility.coordinates[0].toFixed(4)}°E]
          </p>
        </div>

        <button
          type="button"
          onClick={() => setSelectedFacilityId(null)}
          aria-label="Close facility dossier"
          className="rounded-md p-1 text-eco-muted transition-colors hover:bg-eco-surface-secondary hover:text-eco-text"
        >
          <X className="w-5 h-5" />
        </button>
      </header>

      {/* Scrollable body */}
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {/* Facility record */}
        <section className="grid grid-cols-2 gap-3 rounded-md border border-eco-border bg-eco-surface p-3">
          <div>
            <span className="block text-micro uppercase text-eco-muted">Capacity</span>
            <span className="font-mono text-body font-semibold text-eco-primary">
              {facility.capacityMw ? `${facility.capacityMw.toLocaleString()} MW` : 'Unavailable'}
            </span>
          </div>
          <div className="min-w-0">
            <span className="block text-micro uppercase text-eco-muted">Operator / developer</span>
            <span className="block truncate text-meta font-semibold text-eco-text">
              {facility.operator || 'Not recorded'}
            </span>
          </div>
          <div>
            <span className="block text-micro uppercase text-eco-muted">Commissioned year</span>
            <span className="text-meta text-eco-text">{facility.yearCommissioned || 'Unavailable'}</span>
          </div>
          <div>
            <span className="block text-micro uppercase text-eco-muted">Data status</span>
            <span className="text-meta font-semibold text-eco-primary">
              {DATA_STATUS_LABELS[facility.provenance.dataStatus]}
            </span>
          </div>
        </section>

        {/* Environmental stress radar */}
        <section className="rounded-md border border-eco-border bg-eco-surface p-3">
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-meta font-semibold uppercase tracking-wide text-eco-text">
              <Activity className="w-3.5 h-3.5 text-eco-primary" />
              <span>Environmental stress profile</span>
            </span>
            <span className="font-mono text-micro" style={{ color: scoreColor(displayedScore) }}>
              Score {displayedScore}/100
            </span>
          </div>
          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData} margin={{ top: 10, right: 15, bottom: 10, left: 15 }}>
                <PolarGrid stroke={eco.border} />
                <PolarAngleAxis dataKey="subject" tick={{ fill: eco.muted, fontSize: 11 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} stroke={eco.border} tick={false} />
                <Radar
                  name="Environmental stress"
                  dataKey="value"
                  stroke={eco.primary}
                  fill={eco.primary}
                  fillOpacity={0.35}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <p className="pt-1 text-micro text-eco-muted">
            Composite environmental stress index (0–100) from facility indicators.
          </p>
        </section>

        {/* Key risk drivers */}
        <section className="space-y-2 rounded-md border border-eco-border bg-eco-surface p-3">
          <div className="flex items-center gap-1.5 text-meta font-semibold uppercase tracking-wide text-eco-warning">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Key risk drivers</span>
          </div>
          <ul className="space-y-1.5 text-eco-text">
            {facility.keyRiskFactors.map((factor, i) => (
              <li key={i} className="flex items-start gap-1.5 text-meta leading-relaxed">
                <span className="mt-0.5 text-eco-warning">•</span>
                <span>{factor}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Population exposure */}
        <section className="space-y-2 rounded-md border border-eco-border bg-eco-surface p-3">
          <div className="flex items-center gap-1.5 text-meta font-semibold uppercase tracking-wide text-eco-text">
            <Users className="w-3.5 h-3.5 text-eco-critical" />
            <span>Nearby population exposure</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5 text-center font-mono">
            <div className="rounded-md border border-eco-border bg-eco-surface-secondary p-2">
              <span className="block text-micro text-eco-muted">&lt; 5 km</span>
              <span className="text-body font-semibold text-eco-text">
                {(facility.nearbyPopulation.radius5km / 1000).toFixed(0)}k
              </span>
            </div>
            <div className="rounded-md border border-eco-border bg-eco-surface-secondary p-2">
              <span className="block text-micro text-eco-muted">&lt; 15 km</span>
              <span className="text-body font-semibold text-eco-text">
                {(facility.nearbyPopulation.radius15km / 1000).toFixed(0)}k
              </span>
            </div>
            <div className="rounded-md border border-eco-border bg-eco-surface-secondary p-2">
              <span className="block text-micro text-eco-muted">&lt; 25 km</span>
              <span className="text-body font-semibold text-eco-text">
                {(facility.nearbyPopulation.radius25km / 1000000).toFixed(1)}M
              </span>
            </div>
          </div>
        </section>

        {/* Water demand trend */}
        {trend.length > 0 && (
          <section className="rounded-md border border-eco-border bg-eco-surface p-3">
            <div className="flex items-center justify-between gap-2 text-meta font-semibold uppercase tracking-wide text-eco-text">
              <span className="flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-eco-primary" />
                <span>Water demand trend (kLD)</span>
              </span>
              <span className="font-mono text-micro text-eco-muted">{trendYears}</span>
            </div>
            <div className="h-24 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend}>
                  <defs>
                    <linearGradient id="slideOverWaterGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={eco.primary} stopOpacity={0.4} />
                      <stop offset="95%" stopColor={eco.primary} stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="year"
                    stroke={eco.muted}
                    tick={{ fontSize: 11, fill: eco.muted }}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: eco.surface,
                      borderColor: eco.border,
                      fontSize: '12px',
                      color: eco.text,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="waterDemandKld"
                    stroke={eco.primary}
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#slideOverWaterGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}

        {/* Data provenance */}
        <section className="space-y-1.5 rounded-md border border-eco-border bg-eco-surface p-3">
          <span className="block text-micro font-semibold uppercase tracking-wide text-eco-muted">
            Data provenance
          </span>
          <DataConfidenceTag provenance={facility.provenance} showDetails={true} />
          {scenario && (
            <div className="mt-2 rounded border border-eco-primary/25 bg-eco-primary/10 px-2 py-1.5 text-micro text-eco-secondary">
              Scenario-adjusted score {displayedScore}/100 · {scenario.severity}% stress applied
            </div>
          )}
        </section>

        {/* Actions */}
        <div className="space-y-2 border-t border-eco-border pt-2">
          <Button
            variant="secondary"
            size="sm"
            className="w-full justify-between"
            icon={<Activity className="w-3.5 h-3.5 text-eco-primary" />}
            onClick={() => navigate(`/risk-analysis?facility=${facility.id}`)}
          >
            <span>Risk assessment</span>
            <ArrowRight className="w-3.5 h-3.5 text-eco-muted" />
          </Button>

          <Button
            variant="secondary"
            size="sm"
            className="w-full justify-between"
            icon={<TrendingUp className="w-3.5 h-3.5 text-eco-primary" />}
            onClick={() => navigate(`/forecast?facility=${facility.id}`)}
          >
            <span>Future projections</span>
            <ArrowRight className="w-3.5 h-3.5 text-eco-muted" />
          </Button>

          <Button
            variant="secondary"
            size="sm"
            className="w-full justify-between"
            icon={<Wrench className="w-3.5 h-3.5 text-eco-primary" />}
            onClick={() => navigate(`/mitigation?facility=${facility.id}`)}
          >
            <span>Mitigation action plan</span>
            <ArrowRight className="w-3.5 h-3.5 text-eco-muted" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="w-full justify-between"
            icon={<FileText className="w-3.5 h-3.5 text-eco-muted" />}
            onClick={() => navigate(`/reports?facility=${facility.id}`)}
          >
            <span>Executive report</span>
            <ArrowRight className="w-3.5 h-3.5 text-eco-muted" />
          </Button>
        </div>
      </div>
    </div>
  );
};
