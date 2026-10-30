import React from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Droplets,
  HelpCircle,
  Info,
  ShieldAlert,
  Zap,
} from 'lucide-react';
import { Badge, type BadgeVariant } from '../ui/Badge';
import { Card } from '../ui/Card';
import type {
  ResourceOutlookResponse,
  ResourceStatus,
} from '../../types/resourceOutlook';

const STATUS_TONE: Record<ResourceStatus, BadgeVariant> = {
  SUPPORTED_BY_EVIDENCE: 'primary',
  ATTENTION_REQUIRED: 'warning',
  UNKNOWN: 'outline',
  SOURCE_UNAVAILABLE: 'outline',
};

const STATUS_LABEL: Record<ResourceStatus, string> = {
  SUPPORTED_BY_EVIDENCE: 'Supported by Evidence',
  ATTENTION_REQUIRED: 'Attention Required',
  UNKNOWN: 'Unknown / Incomplete',
  SOURCE_UNAVAILABLE: 'Source Unavailable',
};

const NUMBER = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });

export interface ResourceOutlookPanelProps {
  data?: ResourceOutlookResponse | null;
  loading?: boolean;
  error?: string;
}

export function ResourceOutlookPanel({
  data,
  loading = false,
  error,
}: ResourceOutlookPanelProps) {
  if (loading) {
    return (
      <Card
        title="Resource Stress Outlook"
        subtitle="Evaluating regional electricity demand, reservoir storage and facility commitments"
        icon={<Activity className="h-4 w-4" />}
      >
        <p className="text-body text-eco-muted">
          Evaluating deterministic facility resource stress&hellip;
        </p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card
        title="Resource Stress Outlook"
        subtitle="Facility requirements & regional resource outlook"
        icon={<Activity className="h-4 w-4" />}
      >
        <p className="flex items-start gap-2 text-body text-eco-critical">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </p>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card
        title="Resource Stress Outlook"
        subtitle="Facility requirements & regional resource outlook"
        icon={<Activity className="h-4 w-4" />}
      >
        <p className="text-body text-eco-muted">
          No resource stress outlook has been evaluated for this facility.
        </p>
      </Card>
    );
  }

  const {
    power_findings,
    water_findings,
    regional_electricity,
    regional_reservoir,
    uncertainty_and_missing_evidence,
    recommended_review_actions,
    overall_status,
  } = data;

  return (
    <Card
      title="Resource Stress Outlook"
      subtitle="Facility requirements, documented commitments & empirical regional backtests"
      icon={<Activity className="h-4 w-4" />}
      status={STATUS_LABEL[overall_status]}
      statusTone={overall_status === 'ATTENTION_REQUIRED' ? 'warning' : 'neutral'}
      footer={
        <div className="flex flex-col gap-1 text-xs text-eco-muted">
          <div className="flex items-center gap-2">
            <span className="font-medium text-eco-text">Model Version:</span>
            <span>{data.model_version}</span>
            <span>·</span>
            <span className="font-medium text-eco-text">Period:</span>
            <span>{data.source_period}</span>
          </div>
          <p>
            EcoSite India screening signal. Does not grant approvals, establish
            legal compliance, or predict verified utility capacity.
          </p>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Prominent Epistemic Banners */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-eco-border bg-eco-surface-secondary px-3 py-2 text-xs">
          <div className="flex items-center gap-2">
            <Badge size="xs" variant="primary">
              <Clock className="mr-1 h-3 w-3 inline" />
              HISTORICAL BACKTEST
            </Badge>
            <span className="text-eco-muted">
              Evaluated on 2023–2024 historical observations.
            </span>
          </div>
          <Badge size="xs" variant="outline">
            CURRENT FORECAST UNAVAILABLE
          </Badge>
        </div>

        {/* 2x2 Grid of Resource Dimensions */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* 1. Electricity & Sanctions */}
          <div className="rounded-md border border-eco-border bg-eco-surface p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-medium text-eco-text">
                <Zap className="h-4 w-4 text-amber-500" />
                <span>Facility Power Requirements</span>
              </div>
              <Badge size="xs" variant={STATUS_TONE[power_findings.status]}>
                {STATUS_LABEL[power_findings.status]}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded bg-eco-surface-secondary p-2">
                <span className="text-eco-muted block">Peak Power Demand</span>
                <span className="text-sm font-semibold text-eco-text">
                  {power_findings.facility_power_demand_mw !== null
                    ? `${NUMBER.format(power_findings.facility_power_demand_mw)} MW`
                    : 'Unknown'}
                </span>
                <span className="text-[10px] text-eco-muted block mt-0.5">
                  IT: {power_findings.it_capacity_mw ?? '—'} MW @ {power_findings.pue ?? '—'} PUE
                </span>
              </div>
              <div className="rounded bg-eco-surface-secondary p-2">
                <span className="text-eco-muted block">Qualifying Firm Power</span>
                <span className="text-sm font-semibold text-eco-text">
                  {NUMBER.format(power_findings.qualifying_firm_capacity_mw)} MW
                </span>
                <span className="text-[10px] text-eco-muted block mt-0.5">
                  Coverage: {power_findings.contracted_coverage_pct ?? 0}%
                </span>
              </div>
            </div>

            {/* Gap or Trust Level notes */}
            {power_findings.power_gap_mw && power_findings.power_gap_mw > 0 ? (
              <div className="flex items-start gap-1.5 rounded bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-400">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  Uncontracted Power Gap: <strong>{NUMBER.format(power_findings.power_gap_mw)} MW</strong>
                </span>
              </div>
            ) : (
              <div className="flex items-start gap-1.5 rounded bg-emerald-500/10 p-2 text-xs text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>Documented commitments meet facility peak power demand.</span>
              </div>
            )}

            <div className="text-[11px] text-eco-muted space-y-1">
              <div>
                <strong>Commitment Trust:</strong> Documented: {power_findings.documented_power_mw} MW · Verified:{' '}
                {power_findings.verified_power_mw} MW · Unverified: {power_findings.unverified_power_mw} MW
              </div>
              <div>
                <strong>Residual Grid Requirement:</strong>{' '}
                {power_findings.residual_grid_requirement_mw !== null
                  ? `${NUMBER.format(power_findings.residual_grid_requirement_mw)} MW`
                  : '—'}{' '}
                (Annual PPA: {power_findings.annual_ppa_matching_pct ?? 'None'}%)
              </div>
            </div>
          </div>

          {/* 2. Water Requirements & Allocations */}
          <div className="rounded-md border border-eco-border bg-eco-surface p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-medium text-eco-text">
                <Droplets className="h-4 w-4 text-sky-500" />
                <span>Facility Water Balance</span>
              </div>
              <Badge size="xs" variant={STATUS_TONE[water_findings.status]}>
                {STATUS_LABEL[water_findings.status]}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded bg-eco-surface-secondary p-2">
                <span className="text-eco-muted block">Daily Water Demand</span>
                <span className="text-sm font-semibold text-eco-text">
                  {water_findings.daily_water_demand_kld !== null
                    ? `${NUMBER.format(water_findings.daily_water_demand_kld)} kL/d`
                    : 'Unpublished'}
                </span>
                <span className="text-[10px] text-eco-muted block mt-0.5">
                  WUE: {water_findings.wue_l_per_kwh ?? 'Unpublished (Zero fabrication)'} L/kWh
                </span>
              </div>
              <div className="rounded bg-eco-surface-secondary p-2">
                <span className="text-eco-muted block">Qualifying Allocation</span>
                <span className="text-sm font-semibold text-eco-text">
                  {NUMBER.format(water_findings.qualifying_firm_allocated_kld)} kL/d
                </span>
                <span className="text-[10px] text-eco-muted block mt-0.5">
                  Source: {water_findings.water_source_type}
                </span>
              </div>
            </div>

            {/* Gap status */}
            {water_findings.water_gap_kld && water_findings.water_gap_kld > 0 ? (
              <div className="flex items-start gap-1.5 rounded bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-400">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  Allocation Gap: <strong>{NUMBER.format(water_findings.water_gap_kld)} kL/day</strong> (
                  {NUMBER.format(water_findings.water_gap_mcm ?? 0)} MCM/yr)
                </span>
              </div>
            ) : water_findings.daily_water_demand_kld === null ? (
              <div className="flex items-start gap-1.5 rounded bg-slate-500/10 p-2 text-xs text-slate-700 dark:text-slate-300">
                <HelpCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>WUE is not publicly disclosed. EcoSite refuses to fabricate water volume estimates.</span>
              </div>
            ) : (
              <div className="flex items-start gap-1.5 rounded bg-emerald-500/10 p-2 text-xs text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>Water allocations cover estimated cooling demand.</span>
              </div>
            )}

            <div className="text-[11px] text-eco-muted space-y-1">
              <div>
                <strong>Dry-Season Requirement (26-wk):</strong>{' '}
                {water_findings.dry_season_water_demand_mcm !== null
                  ? `${NUMBER.format(water_findings.dry_season_water_demand_mcm)} MCM`
                  : '—'}{' '}
                · <strong>Annual:</strong>{' '}
                {water_findings.annual_water_demand_mcm !== null
                  ? `${NUMBER.format(water_findings.annual_water_demand_mcm)} MCM/yr`
                  : '—'}
              </div>
            </div>
          </div>

          {/* 3. Regional Electricity Grid Outlook */}
          <div className="rounded-md border border-eco-border bg-eco-surface p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-medium text-eco-text">
                <Activity className="h-4 w-4 text-emerald-500" />
                <span>Regional Grid Outlook (Maharashtra)</span>
              </div>
              <Badge size="xs" variant="primary">
                Backtest
              </Badge>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-eco-muted">
                <span>Selected Baseline:</span>
                <span className="font-medium text-eco-text">{regional_electricity.selected_model}</span>
              </div>
              <div className="flex justify-between text-eco-muted">
                <span>Historical Backtest MAE:</span>
                <span className="font-medium text-eco-text">
                  {NUMBER.format(regional_electricity.model_mae_mw)} MW ({regional_electricity.model_mape_pct}%)
                </span>
              </div>
              <div className="flex justify-between text-eco-muted">
                <span>Observed State Peak Demand Met:</span>
                <span className="font-medium text-eco-text">
                  ~{NUMBER.format(regional_electricity.regional_peak_met_mw)} MW
                </span>
              </div>
              {regional_electricity.facility_share_of_grid_peak_pct !== null && (
                <div className="flex justify-between text-eco-muted">
                  <span>Facility Share of Peak:</span>
                  <span className="font-medium text-eco-text">
                    {regional_electricity.facility_share_of_grid_peak_pct}%
                  </span>
                </div>
              )}
              <div className="flex justify-between text-eco-muted">
                <span>80% Calibrated Bounds:</span>
                <span className="font-medium text-eco-text">
                  [{NUMBER.format(regional_electricity.calibrated_80pct_interval_mw[0])} MW,{' '}
                  {NUMBER.format(regional_electricity.calibrated_80pct_interval_mw[1])} MW]
                </span>
              </div>
            </div>

            <p className="rounded bg-eco-surface-secondary p-2 text-[11px] text-eco-muted">
              <Info className="mr-1 inline h-3 w-3 text-eco-primary" />
              Statewide peak loading reflects macro grid dispatch conditions. High regional load does not imply
              facility causes transmission failure or blackouts.
            </p>
          </div>

          {/* 4. Regional Reservoir Storage Outlook */}
          <div className="rounded-md border border-eco-border bg-eco-surface p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-medium text-eco-text">
                <Droplets className="h-4 w-4 text-blue-500" />
                <span>Regional Reservoir Outlook</span>
              </div>
              <Badge size="xs" variant={regional_reservoir.service_area_match ? 'primary' : 'outline'}>
                {regional_reservoir.service_area_match ? 'Basin Matched' : 'Basin Mismatch'}
              </Badge>
            </div>

            {regional_reservoir.service_area_match ? (
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-eco-muted">
                  <span>Supply Basin / Reservoir:</span>
                  <span className="font-medium text-eco-text">{regional_reservoir.target_reservoir}</span>
                </div>
                <div className="flex justify-between text-eco-muted">
                  <span>Gross Live Capacity:</span>
                  <span className="font-medium text-eco-text">
                    {NUMBER.format(regional_reservoir.reservoir_capacity_mcm)} MCM
                  </span>
                </div>
                <div className="flex justify-between text-eco-muted">
                  <span>Dry Season 26-Wk Drawdown:</span>
                  <span className="font-medium text-eco-text">
                    ~{NUMBER.format(regional_reservoir.dry_season_drawdown_mcm)} MCM
                  </span>
                </div>
                {regional_reservoir.facility_share_of_dry_season_drawdown_pct !== null && (
                  <div className="flex justify-between text-eco-muted">
                    <span>Dry Season Drawdown Share:</span>
                    <span className="font-medium text-eco-text">
                      {regional_reservoir.facility_share_of_dry_season_drawdown_pct}%
                    </span>
                  </div>
                )}
                {regional_reservoir.facility_share_of_daily_municipal_throughput_pct !== null && (
                  <div className="flex justify-between text-eco-muted">
                    <span>Municipal Throughput Share:</span>
                    <span className="font-medium text-eco-text">
                      {regional_reservoir.facility_share_of_daily_municipal_throughput_pct}% (~2,400 MLD)
                    </span>
                  </div>
                )}
                <p className="rounded bg-eco-surface-secondary p-2 text-[11px] text-eco-muted">
                  <Info className="mr-1 inline h-3 w-3 text-eco-primary" />
                  Reservoir drawdown provides hydrologic context; water supply is governed by municipal off-take
                  agreements, not direct dam extraction.
                </p>
              </div>
            ) : (
              <div className="space-y-2 rounded bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
                <div className="flex items-center gap-1.5 font-medium">
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  <span>Basin Service Area Mismatch</span>
                </div>
                <p>{regional_reservoir.service_basin_diagnostics}</p>
                <p className="text-[11px] text-eco-muted">
                  Bhatsa reservoir drawdown cannot be used for this facility. Local basin monitoring is{' '}
                  <span className="font-semibold">CURRENTLY UNAVAILABLE</span>.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Uncertainty and Missing Evidence Warnings */}
        {(uncertainty_and_missing_evidence.missing_critical_data.length > 0 ||
          uncertainty_and_missing_evidence.operator_assumptions.length > 0 ||
          uncertainty_and_missing_evidence.synthetic_parameters.length > 0) && (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-4 space-y-2 text-xs">
            <div className="flex items-center gap-2 font-medium text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>Uncertainty & Evidence Gaps</span>
            </div>
            <ul className="list-disc pl-5 space-y-1 text-eco-text">
              {uncertainty_and_missing_evidence.missing_critical_data.map((m, i) => (
                <li key={`m-${i}`}>{m}</li>
              ))}
              {uncertainty_and_missing_evidence.operator_assumptions.map((a, i) => (
                <li key={`a-${i}`}>{a}</li>
              ))}
              {uncertainty_and_missing_evidence.synthetic_parameters.map((s, i) => (
                <li key={`s-${i}`}>{s}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Recommended Review Actions */}
        {recommended_review_actions.length > 0 && (
          <div className="rounded-md border border-eco-border bg-eco-surface-secondary p-4 space-y-2 text-xs">
            <span className="font-medium text-eco-text block">Recommended Screening & Review Actions:</span>
            <ul className="space-y-1.5">
              {recommended_review_actions.map((act, idx) => (
                <li key={idx} className="flex items-start gap-2 text-eco-muted">
                  <span className="font-semibold text-eco-primary shrink-0">#{idx + 1}</span>
                  <span>{act}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
}
