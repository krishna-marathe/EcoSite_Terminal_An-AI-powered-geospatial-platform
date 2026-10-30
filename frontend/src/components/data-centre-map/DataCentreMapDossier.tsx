import React, { useState, useEffect } from 'react';
import { Building2, ExternalLink, MapPin, ShieldCheck, Users, X } from 'lucide-react';
import type { EnvironmentalCurrentResponse } from '../../types/environmentalMonitoring';
import type { CapacityType, PublicFacility } from '../../types/publicFacilities';
import { Badge } from '../ui/Badge';
import { Button, IconButton } from '../ui/Button';
import { Card } from '../ui/Card';
import { DataCentreAiInsightsCard } from '../facilities/DataCentreAiInsightsCard';
import { apiClient } from '../../services/api';
import { mlService } from '@/services/mlService';

const CAPACITY_LABELS: Record<CapacityType, string> = {
  it_load: 'IT load',
  total_power: 'Total power',
  power_capacity: 'Power capacity',
  power_capacity_unspecified: 'Power capacity (boundary unspecified)',
};

const VERIFICATION_LABELS: Record<PublicFacility['verification']['status'], string> = {
  government_verified: 'Government verified',
  public_operator_confirmed: 'Operator confirmed',
  credible_public_report: 'Credible public report',
};

const formatDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(date);
};

export interface DataCentreMapDossierProps {
  facility: PublicFacility | null;
  environmentalCurrent?: EnvironmentalCurrentResponse | null;
  environmentalError?: string | null;
  onClose?: () => void;
  onOpenProfile?: (facility: PublicFacility) => void;
  className?: string;
}

export const DataCentreMapDossier: React.FC<DataCentreMapDossierProps> = ({
  facility,
  environmentalCurrent,
  environmentalError,
  onClose,
  onOpenProfile,
  className,
}) => {
  if (!facility) return null;

  const [aiInsights, setAiInsights] = useState<any>(null);
  const [insightsError, setInsightsError] = useState<string | null>(null);
  const [mlPredictions, setMlPredictions] = useState<any>(null);
  const [mlLoading, setMlLoading] = useState(false);
  const [mlError, setMlError] = useState<string | null>(null);

  useEffect(() => {
    if (!facility) return;
    let cancelled = false;

    // Fetch AI insights
    apiClient
      .get<{ infrastructureTelemetry: { population: any } }>(
        `/public-facilities/${facility.id}/ai-assist`
      )
      .then((res) => {
        if (!cancelled) setAiInsights(res.data);
      })
      .catch((err) => {
        if (!cancelled) setInsightsError(err.message);
      });

    // Fetch ML predictions for 6, 9, 12 months
    const primaryCapacity = facility.capacityDisclosures?.[0]?.value ?? 40;
    const estimatedPowerMw = primaryCapacity * 1.35;
    const estimatedWaterKld = primaryCapacity * 1.6 * 24;

    setMlLoading(true);
    mlService
      .getMultiMonthPredictions({
        capacity_mw: primaryCapacity,
        water_demand_kl_day: estimatedWaterKld,
        power_demand_mw: estimatedPowerMw,
        location: facility.stateCode ?? "IN-MH",
        model_version: "ML-F2.1",
      })
      .then((res) => {
        if (!cancelled) setMlPredictions(res);
      })
      .catch((err) => {
        if (!cancelled) setMlError(err.message);
      });

    return () => {
      cancelled = true;
    };
  }, [facility?.id]);

  const source = facility.verification.source;
  const environmentalMetrics = environmentalCurrent?.facilityId === facility.id
    ? environmentalCurrent.metrics
    : [];

  const popTelemetry = aiInsights?.infrastructureTelemetry?.population;
  const pop1km = popTelemetry?.population1km ?? 0;
  const pop5km = popTelemetry?.population5km ?? 0;
  const density = popTelemetry?.densityPerKm2 ?? 0;
  const band = popTelemetry?.densityBand ?? 'LOW';
  const bufferAlert = popTelemetry?.bufferAlert ?? '';
  const dataSource = popTelemetry?.dataSource ?? 'Data unavailable';

  // Helper to format prediction
  const formatPrediction = (
    pred: any
  ): {
    power: string;
    water: string;
    capacity: string;
    confidence: string;
    horizon: string;
  } => ({
    power: `${pred.power_demand_mw_pred?.toFixed(1) || 0} MW`,
    water: `${pred.water_demand_kl_day_pred?.toFixed(1) || 0} kL/day`,
    capacity: `${pred.capacity_mw_pred?.toFixed(1) || 0} MW`,
    confidence: `${(pred.confidence_score ?? 0.85) * 100}%`,
    horizon: `${pred.prediction_horizon_months} months`,
  });

  return (
    <Card
      className={className}
      title={facility.name}
      subtitle={`${facility.operator} · ${facility.facilityType.replaceAll('_', ' ')}`}
      icon={<Building2 size={15} aria-hidden="true" />}
      status="Operating"
      statusTone="neutral"
      actions={onClose ? <IconButton label="Close data-centre dossier" icon={<X size={15} />} onClick={onClose} /> : undefined}
      footer={
        <span>
          Public registry location is generalised to {facility.locationPrecision} level; exact coordinates are not displayed.
        </span>
      }
      scroll
      bodyClassName="space-y-4 p-4"
    >
      <section aria-labelledby="dc-location-heading">
        <h4 id="dc-location-heading" className="mb-2 flex items-center gap-1.5 text-meta font-semibold uppercase tracking-wide text-eco-muted">
          <MapPin size={13} aria-hidden="true" /> Public identity
        </h4>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-body">
          <dt className="text-eco-muted">Operator</dt><dd>{facility.operator}</dd>
          <dt className="text-eco-muted">Location</dt><dd>{facility.locality}, {facility.city}, {facility.state}</dd>
          <dt className="text-eco-muted">Precision</dt><dd className="capitalize">{facility.locationPrecision} level</dd>
          <dt className="text-eco-muted">Ownership</dt><dd className="capitalize">{facility.ownershipCategory}</dd>
          {facility.operationalSince && <><dt className="text-eco-muted">Operating since</dt><dd>{facility.operationalSince}</dd></>}
        </dl>
      </section>

      <section aria-labelledby="dc-capacity-heading">
        <h4 id="dc-capacity-heading" className="mb-2 text-meta font-semibold uppercase tracking-wide text-eco-muted">Disclosed capacity</h4>
        {facility.capacityDisclosures.length > 0 ? (
          <ul className="space-y-2">
            {facility.capacityDisclosures.map((capacity, index) => (
              <li key={`${capacity.capacityType}-${capacity.scope}-${index}`} className="rounded-sm border border-eco-border bg-eco-surface-secondary/50 p-2">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-meta text-eco-muted">{CAPACITY_LABELS[capacity.capacityType]}</span>
                  <strong className="font-mono text-body">{capacity.value} {capacity.unit}</strong>
                </div>
                <p className="mt-1 text-meta text-eco-muted">Scope: {capacity.scope}</p>
              </li>
            ))}
          </ul>
        ) : <p className="text-body text-eco-muted">No public capacity disclosure.</p>}
        {facility.capacityDisclosures.length > 1 && (
          <p className="mt-2 text-meta text-eco-muted">Capacity types are shown separately because their measurement boundaries may differ.</p>
        )}
      </section>

      <section aria-labelledby="dc-population-heading">
        <h4 id="dc-population-heading" className="mb-2 flex items-center justify-between text-meta font-semibold uppercase tracking-wide text-eco-muted">
          <Users size={13} aria-hidden="true" /> Surrounding Population
          {insightsError && <span className="font-mono text-meta text-eco-critical font-normal">Load failed</span>}
          {!insightsError && !aiInsights && <span className="font-mono text-meta text-eco-muted">Loading…</span>}
          {aiInsights && <span className="font-mono text-meta text-eco-primary font-normal">{dataSource}</span>}
        </h4>
        {aiInsights && (
          <div className="grid grid-cols-2 gap-2 font-micro">
            <div className="rounded-sm border border-eco-border bg-eco-surface-secondary/50 p-2">
              <span className="text-meta text-eco-muted uppercase block">1 km Immediate</span>
              <strong className="text-body text-eco-text">{pop1km.toLocaleString()}</strong> <span className="text-meta text-eco-muted">people</span>
            </div>
            <div className="rounded-sm border border-eco-border bg-eco-surface-secondary/50 p-2">
              <span className="text-meta text-eco-muted uppercase block">5 km Catchment</span>
              <strong className="text-body text-eco-text">{pop5km.toLocaleString()}</strong> <span className="text-meta text-eco-muted">people</span>
            </div>
          </div>
        )}
        {aiInsights && (
          <div className="mt-2 text-meta text-eco-muted">
            Density: <strong className="text-eco-text">{density.toFixed(1)}</strong> /km² ({band}) · {bufferAlert}
          </div>
        )}
      </section>

      <section aria-labelledby="dc-verification-heading">
        <h4 id="dc-verification-heading" className="mb-2 flex items-center gap-1.5 text-meta font-semibold uppercase tracking-wide text-eco-muted">
          <ShieldCheck size={13} aria-hidden="true" /> Verification
        </h4>
        <Badge variant="primary" size="xs">{VERIFICATION_LABELS[facility.verification.status]}</Badge>
        <p className="mt-2 text-meta text-eco-muted">
          Verified {formatDate(facility.verification.verifiedAt)} · Review by {formatDate(facility.verification.expiresAt)}
        </p>
        <a className="mt-2 inline-flex items-center gap-1 text-body text-eco-primary hover:underline" href={source.url} target="_blank" rel="noreferrer">
          {source.title} · {source.publisher}<ExternalLink size={12} aria-hidden="true" />
        </a>
      </section>

      <section aria-labelledby="dc-verification-heading">
        <h4 className="mb-2 text-meta font-semibold uppercase tracking-wide text-eco-muted">
          <ShieldCheck size={13} aria-hidden="true" /> ML Forecast
        </h4>
        {mlLoading && <p className="text-meta text-eco-muted">Loading ML forecast…</p>}
        {mlError && <p className="text-meta text-eco-critical">{mlError}</p>}
        {!mlLoading && !mlError && mlPredictions && (
          <div className="grid grid-cols-3 gap-4">
            {[6, 9, 12].map((months) => {
              const pred = mlPredictions[`month_${months}`];
              if (!pred) return null;

              const formatted = formatPrediction(pred);

              return (
                <div key={months} className="p-4 rounded bg-eco-surface/95 border border-eco-border text-center">
                  <div className="text-2xl font-bold text-eco-primary">{formatted.power}</div>
                  <p className="text-meta text-eco-muted">Power Forecast</p>
                  <hr className="my-2 border border-eco-border/50" />
                  <p className="text-sm text-eco-muted">{formatted.water}</p>
                  <hr className="my-2 border border-eco-border/50" />
                  <div className="mt-3">
                    <p className="text-meta text-eco-muted">Confidence: {formatted.confidence}</p>
                    <p className="text-micro text-eco-muted">Forecast horizon: {formatted.horizon}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {environmentalMetrics.length > 0 && (
        <section aria-labelledby="dc-environment-heading">
          <h4 id="dc-environment-heading" className="mb-2 text-meta font-semibold uppercase tracking-wide text-eco-muted">Current environmental context</h4>
          <ul className="space-y-2">
            {environmentalMetrics.map((metric) => (
              <li key={metric.metric} className="rounded-sm border border-eco-border p-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-body">{metric.displayName}</span>
                  <span className="font-mono text-body">
                    {metric.value === null ? metric.availability.replaceAll('_', ' ') : `${metric.value} ${metric.unit}`}
                  </span>
                </div>
                <p className="mt-1 text-meta text-eco-muted">
                  {metric.station
                    ? `${metric.station.name} · ${metric.station.provider} · ${metric.station.distanceKm} km contextual distance`
                    : metric.contextNotice}
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-meta text-eco-muted">Environmental observations describe nearby public monitoring context, not facility telemetry.</p>
        </section>
      )}

      {environmentalError && environmentalMetrics.length === 0 && (
        <section aria-label="Environmental context unavailable" className="rounded-sm border border-eco-warning/40 bg-eco-warning/10 p-3 text-body text-eco-warning">
          Environmental context could not be loaded. Registry information remains available.
        </section>
      )}

      <DataCentreAiInsightsCard
        facility={facility}
        environmentalCurrent={environmentalCurrent}
        compact
      />

      {onOpenProfile && (
        <Button variant="primary" className="w-full" onClick={() => onOpenProfile(facility)}>
          Open data-centre profile
        </Button>
      )}
    </Card>
  );
};