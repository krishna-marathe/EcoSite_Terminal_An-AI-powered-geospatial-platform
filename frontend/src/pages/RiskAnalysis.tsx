import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Activity, CheckCircle2, RotateCcw, Sliders, TrendingUp } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
} from 'recharts';
import { useDashboardStore } from '../stores/dashboardStore';
import type { Facility } from '../types';
import {
  DEFAULT_SECTOR_WEIGHTS,
  calculateWeightedRiskScore,
  getExplainableIndicators,
  getRiskLevel,
  type SectorWeights,
} from '../services/risk';
import { RiskBadge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { DataConfidenceTag } from '../components/ui/DataConfidenceTag';
import { Field, Select } from '../components/ui/Field';
import { PageHeader, PageShell } from '../components/ui/PageHeader';
import { EmptyState, ErrorState, InlineAlert, LoadingSkeleton } from '../components/ui/StateViews';
import { FACILITY_TYPE_LABELS, chartColors, riskColor } from '../theme/tokens';

const PAGE_PURPOSE =
  'Sector-weighted screening of one facility across eight environmental indicators, with transparent weights.';

export const RiskAnalysis: React.FC = () => {
  const { facilities, cityId, dataMode, facilitiesStatus, facilitiesError, setDataMode } = useDashboardStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedFacility = facilities.find(f => f.id === searchParams.get('facility')) ?? facilities[0];

  const header = (
    <PageHeader
      eyebrow="Analysis"
      title="Explainable environmental risk screening"
      purpose={PAGE_PURPOSE}
    />
  );

  if (facilitiesStatus === 'loading') {
    return (
      <PageShell>
        {header}
        <Card title="Loading facilities" status={dataMode === 'demo' ? 'Synthetic demo' : 'Backend API'}>
          <LoadingSkeleton rows={4} />
        </Card>
      </PageShell>
    );
  }

  if (facilitiesStatus === 'error') {
    return (
      <PageShell>
        {header}
        <Card title="Facility screening">
          <ErrorState
            title="Facility data could not be loaded"
            cause={facilitiesError ?? 'The facility request failed before any records were returned.'}
            onDemo={() => setDataMode('demo')}
          />
        </Card>
      </PageShell>
    );
  }

  if (!selectedFacility) {
    return (
      <PageShell>
        {header}
        <Card title="Facility screening">
          <EmptyState
            title="No facilities available in this city and data mode."
            body="Switch city or data mode to screen another pilot area."
          />
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell>
      {header}

      <div className="flex flex-wrap items-end gap-3">
        <Field label="Facility" htmlFor="risk-facility" className="w-full max-w-md">
          <Select
            id="risk-facility"
            value={selectedFacility.id}
            onChange={(event) => setSearchParams({ facility: event.target.value })}
          >
            {facilities.map((facility) => (
              <option key={facility.id} value={facility.id}>
                {facility.name} · {FACILITY_TYPE_LABELS[facility.type]}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <FacilityRisk key={`${cityId}-${dataMode}-${selectedFacility.id}`} selectedFacility={selectedFacility} />
    </PageShell>
  );
};

const FacilityRisk = ({ selectedFacility }: { selectedFacility: Facility }) => {
  const defaultWeights =
    DEFAULT_SECTOR_WEIGHTS[selectedFacility.type] || DEFAULT_SECTOR_WEIGHTS.data_centre;
  const [customWeights, setCustomWeights] = useState<SectorWeights | null>(null);
  const weights = customWeights || defaultWeights;

  const [isCustomizingWeights, setIsCustomizingWeights] = useState(false);

  const handleResetWeights = () => {
    setCustomWeights(null);
  };

  const currentScore = calculateWeightedRiskScore(selectedFacility.indicators, weights);
  const currentRiskLevel = getRiskLevel(currentScore);
  const ringColor = riskColor(currentRiskLevel);
  const indicators = getExplainableIndicators(selectedFacility, weights);

  // Prepare contribution chart data.
  const sumWeights = Object.values(weights).reduce((a, b) => a + b, 0);
  const contributionData = indicators.map((ind) => {
    const rawContribution = (ind.score * (sumWeights > 0 ? weights[ind.key as keyof SectorWeights] / sumWeights : 1 / 8));
    const percentOfTotal = currentScore > 0 ? (rawContribution / currentScore) * 100 : 0;
    return {
      name: ind.name.split(' ')[0],
      fullName: ind.name,
      score: ind.score,
      contribution: Math.round(percentOfTotal),
      key: ind.key,
    };
  });

  return (
    <>
      <InlineAlert tone="warning" title="Planning and pre-feasibility screening notice">
        This score is an automated geospatial screening index for early-stage spatial planning. It is
        not a statutory environmental impact assessment or clearance determination under the
        Environment (Protection) Act, 1986.
      </InlineAlert>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card
          title="Compound screening score"
          subtitle={selectedFacility.name}
          icon={<Activity className="h-4 w-4" />}
          bodyClassName="flex flex-col justify-between gap-3 p-4"
        >
          <div className="flex flex-col items-center gap-3 py-4">
            <div
              className="flex h-32 w-32 flex-col items-center justify-center rounded-full border-4 bg-eco-surface-secondary"
              style={{ borderColor: ringColor, color: ringColor }}
            >
              <span className="font-mono text-data-lg font-medium tabular-nums">{currentScore}</span>
              <span className="text-meta text-eco-muted">/100 out of 100</span>
            </div>

            <RiskBadge level={currentRiskLevel} score={currentScore} />

            <div className="space-y-1 text-center">
              <p className="text-meta text-eco-muted">
                Infrastructure category:{' '}
                <span className="text-eco-text">{FACILITY_TYPE_LABELS[selectedFacility.type]}</span>
              </p>
              <p className="text-meta text-eco-muted">
                Model: sector-specific linear multi-criteria analysis (MCA)
              </p>
            </div>
          </div>

          <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-eco-border pt-3">
            <Button
              variant="outline"
              size="sm"
              icon={<Sliders className="h-3.5 w-3.5" />}
              onClick={() => setIsCustomizingWeights(!isCustomizingWeights)}
            >
              {isCustomizingWeights ? 'Close weight tuner' : 'Configure sector weights'}
            </Button>
            {isCustomizingWeights && (
              <button
                type="button"
                onClick={handleResetWeights}
                className="flex items-center gap-1 text-meta text-eco-warning hover:underline"
              >
                <RotateCcw className="h-3 w-3" />
                Reset defaults
              </button>
            )}
          </div>
        </Card>

        <Card
          className="lg:col-span-2"
          title="Indicator risk contribution"
          subtitle="Share of the compound score contributed by each screening vector"
          icon={<TrendingUp className="h-4 w-4" />}
        >
          <div className="h-60 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={contributionData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid stroke={chartColors.grid} vertical={false} />
                <XAxis
                  dataKey="name"
                  stroke={chartColors.grid}
                  tick={{ fill: chartColors.muted, fontSize: 12 }}
                  angle={-15}
                  textAnchor="end"
                />
                <YAxis
                  stroke={chartColors.grid}
                  tick={{ fill: chartColors.muted, fontSize: 12 }}
                  unit="%"
                />
                <RechartsTooltip
                  cursor={{ fill: chartColors.grid, fillOpacity: 0.25 }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="rounded-sm border border-eco-border bg-eco-surface p-2.5 text-meta">
                          <p className="font-medium text-eco-text">{data.fullName}</p>
                          <p className="text-eco-muted">
                            Score:{' '}
                            <span className="font-mono text-eco-text tabular-nums">{data.score}/100</span>
                          </p>
                          <p className="text-eco-muted">
                            Contribution:{' '}
                            <span className="font-mono text-eco-primary tabular-nums">
                              {data.contribution}%
                            </span>
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="contribution" fill={chartColors.primary} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="pt-2 text-meta text-eco-muted">
            Contribution = indicator score × weight share ÷ compound score. Values are percentages of
            the compound score, not physical measurements.
          </p>
        </Card>
      </div>

      {isCustomizingWeights && (
        <Card
          title="Transparent weight configuration"
          subtitle="Adjust weights to local priorities; the compound score recalculates in real time"
          icon={<Sliders className="h-4 w-4" />}
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {Object.keys(weights).map((key) => {
              const k = key as keyof SectorWeights;
              const weightVal = weights[k];
              const pct = Math.round((weightVal / sumWeights) * 100);
              const inputId = `risk-weight-${k}`;
              return (
                <div key={k} className="space-y-1.5 rounded-sm border border-eco-border bg-eco-surface-secondary p-3">
                  <div className="flex items-center justify-between gap-2">
                    <label htmlFor={inputId} className="text-meta capitalize text-eco-text">
                      {k.replace(/([A-Z])/g, ' $1')}
                    </label>
                    <span className="font-mono text-data text-eco-primary tabular-nums">{pct}%</span>
                  </div>
                  <input
                    id={inputId}
                    type="range"
                    min="0"
                    max="0.5"
                    step="0.01"
                    value={weightVal}
                    onChange={(event) =>
                      setCustomWeights((prev) => ({
                        ...(prev || defaultWeights),
                        [k]: parseFloat(event.target.value),
                      }))
                    }
                    className="w-full accent-eco-primary"
                  />
                  <p className="text-meta text-eco-muted">Weight {weightVal.toFixed(2)}</p>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Card
        title="Indicator dossiers"
        subtitle="Assessment rationale, verification steps and source status for each screening vector"
        status={`${indicators.length} indicators`}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {indicators.map((indicator) => (
            <Card
              key={indicator.key}
              title={indicator.name}
              subtitle={indicator.valueDescription}
              actions={<RiskBadge level={indicator.status} score={indicator.score} />}
            >
              <div className="space-y-3">
                <div className="space-y-1">
                  <p className="text-meta font-medium text-eco-muted">Assessment rationale</p>
                  <p className="text-body text-eco-text">{indicator.explanation}</p>
                </div>

                <div className="space-y-1 rounded-sm border border-eco-border bg-eco-surface-secondary/70 p-2.5">
                  <p className="flex items-center gap-1.5 text-meta font-medium text-eco-primary">
                    <CheckCircle2 className="h-3 w-3" />
                    Recommended verification action
                  </p>
                  <p className="text-body text-eco-text">{indicator.mitigationPrompt}</p>
                </div>

                <div className="border-t border-eco-border pt-2">
                  <DataConfidenceTag provenance={indicator.provenance} showDetails />
                </div>
              </div>
            </Card>
          ))}
        </div>
      </Card>
    </>
  );
};
