import React, { useState } from 'react';
import type { CandidateSite } from '../../services/projects';
import type { ProjectPhase } from '../../services/phases';
import type { Assertion } from '../../types/evidence';
import type {
  SiteComparisonResponse,
  DimensionStatus,
} from '../../types/readiness';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

interface SiteComparisonMatrixProps {
  sites?: CandidateSite[];
  phases?: ProjectPhase[];
  assertions?: Assertion[];
  comparisonData?: SiteComparisonResponse | null;
  loading?: boolean;
  error?: string | null;
  onGeneratePassport?: (selectedSiteId: string) => void;
}

function renderDimensionStatusBadge(status: DimensionStatus) {
  switch (status) {
    case 'READY':
      return (
        <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-mono font-bold text-emerald-400 border border-emerald-500/30">
          READY
        </span>
      );
    case 'ATTENTION_REQUIRED':
      return (
        <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-mono font-bold text-amber-400 border border-amber-500/30">
          ATTENTION REQUIRED
        </span>
      );
    case 'HIGH_RISK':
      return (
        <span className="rounded bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-mono font-bold text-rose-400 border border-rose-500/30">
          HIGH RISK
        </span>
      );
    case 'UNKNOWN':
      return (
        <span className="rounded bg-slate-500/10 px-1.5 py-0.5 text-[10px] font-mono font-bold text-slate-400 border border-slate-500/30">
          UNKNOWN
        </span>
      );
    default:
      return (
        <span className="rounded bg-slate-700 px-1.5 py-0.5 text-[10px] font-mono font-bold text-slate-300">
          {status}
        </span>
      );
  }
}

export function SiteComparisonMatrix({
  sites = [],
  phases = [],
  assertions = [],
  comparisonData,
  loading = false,
  error = null,
  onGeneratePassport,
}: SiteComparisonMatrixProps) {
  const initialSiteId = comparisonData?.sites[0]?.site_id || sites[0]?.id || '';
  const [selectedSiteId, setSelectedSiteId] = useState<string>(initialSiteId);

  // Sync selectedSiteId if empty
  const activeSelection = selectedSiteId || comparisonData?.sites[0]?.site_id || sites[0]?.id || '';

  if (loading) {
    return (
      <Card title="3-Site Pre-Investment Comparison Matrix">
        <p className="text-xs text-eco-muted py-4 animate-pulse">
          Evaluating candidate polygon dimensions from genuine evidence records…
        </p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card title="3-Site Pre-Investment Comparison Matrix">
        <div className="rounded border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300" role="alert">
          <p className="font-semibold">Unable to load candidate site comparisons</p>
          <p className="mt-1">{error}</p>
        </div>
      </Card>
    );
  }

  // Real backend comparisons mode
  if (comparisonData) {
    const backendSites = comparisonData.sites;

    if (backendSites.length === 0) {
      return (
        <Card title="3-Site Pre-Investment Comparison Matrix">
          <p className="text-xs text-eco-muted py-2">
            No candidate sites saved for this project. Draw or import up to 3 candidate polygons above to compare site readiness.
          </p>
        </Card>
      );
    }

    return (
      <Card title="3-Site Pre-Investment Comparison Matrix">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-eco-border pb-3 mb-4">
          <div>
            <p className="text-xs text-eco-muted">
              Independent four-dimensional pre-investment screening across up to 3 candidate polygons. Does not generate an arbitrary composite score.
            </p>
            <p className="text-[11px] text-amber-400 font-mono mt-1">
              ⚠️ {comparisonData.epistemic_disclaimer}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {onGeneratePassport && (
              <Button
                type="button"
                onClick={() => onGeneratePassport(activeSelection)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs whitespace-nowrap"
              >
                📄 Export Site Readiness Passport
              </Button>
            )}
          </div>
        </div>

        {backendSites.length === 1 && (
          <div className="rounded border border-eco-border bg-eco-surface-2/40 p-2.5 mb-3 text-xs text-eco-muted">
            ℹ️ Single candidate polygon evaluated. Draw or import up to 3 candidate polygons to compare alternatives side-by-side.
          </div>
        )}

        <div className="overflow-x-auto rounded border border-eco-border">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-eco-surface-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-eco-border">
              <tr>
                <th className="p-3 w-52">Dimension / Criteria</th>
                {backendSites.map((site) => (
                  <th key={site.site_id} className="p-3 min-w-[220px]">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-bold text-slate-100 text-xs">{site.site_name}</p>
                        <p className="text-[10px] text-eco-muted font-mono">
                          {site.state_code} · {site.area_ha.toFixed(2)} ha
                          {site.district ? ` · ${site.district}` : ''}
                        </p>
                      </div>
                      <input
                        type="radio"
                        name="selected_passport_site"
                        checked={activeSelection === site.site_id}
                        onChange={() => setSelectedSiteId(site.site_id)}
                        className="text-eco-primary focus:ring-eco-primary ml-2"
                        title="Select for Passport generation"
                      />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-eco-border/60">
              {/* Dimension 1: Resource Readiness */}
              <tr className="bg-eco-surface-2/30 font-semibold text-slate-200">
                <td colSpan={backendSites.length + 1} className="py-2 px-3 text-[11px] uppercase tracking-wider text-eco-primary flex items-center gap-1.5">
                  <span>⚡ Dimension 1: Resource Readiness</span>
                </td>
              </tr>
              <tr>
                <td className="p-3 font-medium text-slate-300">
                  <p>Grid Deliverability</p>
                  <span className="text-[10px] text-eco-muted">Firm MW & Delivery Gap</span>
                </td>
                {backendSites.map((site) => {
                  const m = site.resource_readiness.metrics;
                  const firmMW = typeof m.firm_power_mw === 'number' ? m.firm_power_mw : 0;
                  const powerGap = typeof m.power_gap_mw === 'number' ? m.power_gap_mw : null;
                  const powerStatus = String(m.power_status || 'UNKNOWN');
                  return (
                    <td key={site.site_id} className="p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono text-slate-100 font-bold">{firmMW} MW Firm</span>
                        {renderDimensionStatusBadge(site.resource_readiness.status)}
                      </div>
                      <p className="text-[11px] font-mono">
                        {powerGap !== null && powerGap > 0 ? (
                          <span className="text-rose-400 font-medium">Gap: -{powerGap} MW</span>
                        ) : powerGap === 0 ? (
                          <span className="text-emerald-400 font-medium">Fully Backed</span>
                        ) : (
                          <span className="text-slate-400 font-medium">Unassessed</span>
                        )}
                        <span className="text-[10px] text-eco-muted ml-1.5 font-sans">({powerStatus})</span>
                      </p>
                      {site.resource_readiness.notes.length > 0 && (
                        <p className="text-[10px] text-eco-muted mt-1 italic">
                          {site.resource_readiness.notes.join(' ')}
                        </p>
                      )}
                    </td>
                  );
                })}
              </tr>
              <tr>
                <td className="p-3 font-medium text-slate-300">
                  <p>Peak Summer Water Balance</p>
                  <span className="text-[10px] text-eco-muted">Allocated vs Summer Gap</span>
                </td>
                {backendSites.map((site) => {
                  const m = site.resource_readiness.metrics;
                  const firmWater = typeof m.firm_water_kld === 'number' ? m.firm_water_kld : 0;
                  const waterGap = typeof m.water_gap_kld === 'number' ? m.water_gap_kld : null;
                  const waterStatus = String(m.water_status || 'UNKNOWN');
                  return (
                    <td key={site.site_id} className="p-3">
                      <p className="font-mono text-slate-100 font-bold">{firmWater} KLD Firm</p>
                      <p className="text-[11px] font-mono mt-0.5">
                        {waterGap !== null && waterGap > 0 ? (
                          <span className="text-amber-400 font-medium">Gap: -{waterGap} KLD</span>
                        ) : waterGap === 0 ? (
                          <span className="text-emerald-400 font-medium">Fully Backed</span>
                        ) : (
                          <span className="text-slate-400 font-medium">Unassessed</span>
                        )}
                        <span className="text-[10px] text-eco-muted ml-1.5 font-sans">({waterStatus})</span>
                      </p>
                    </td>
                  );
                })}
              </tr>

              {/* Dimension 2: Environmental Exposure */}
              <tr className="bg-eco-surface-2/30 font-semibold text-slate-200">
                <td colSpan={backendSites.length + 1} className="py-2 px-3 text-[11px] uppercase tracking-wider text-eco-primary flex items-center gap-1.5">
                  <span>🌱 Dimension 2: Environmental & Spatial Screening</span>
                </td>
              </tr>
              <tr>
                <td className="p-3 font-medium text-slate-300">
                  <p>Territorial & Boundary Screening</p>
                  <span className="text-[10px] text-eco-muted">State ADM1 Boundary</span>
                </td>
                {backendSites.map((site) => {
                  const m = site.environmental_exposure.metrics;
                  const screening = String(m.boundary_screening || site.boundary_screening_status);
                  const isInside = screening === 'inside_screening_boundary';
                  const bSource = String(m.boundary_source || 'geoBoundaries IND ADM1');
                  return (
                    <td key={site.site_id} className="p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className={isInside ? 'text-emerald-400 font-medium text-[11px]' : 'text-amber-400 font-medium text-[11px]'}>
                          {isInside ? '✓ Inside Screening Boundary' : '⚠️ Boundary Review Required'}
                        </span>
                        {renderDimensionStatusBadge(site.environmental_exposure.status)}
                      </div>
                      <p className="text-[10px] text-eco-muted font-mono">{bSource}</p>
                      {site.environmental_exposure.notes.length > 0 && (
                        <p className="text-[10px] text-amber-400/90 mt-1">
                          {site.environmental_exposure.notes.join(' ')}
                        </p>
                      )}
                    </td>
                  );
                })}
              </tr>

              {/* Dimension 3: Regulatory Readiness */}
              <tr className="bg-eco-surface-2/30 font-semibold text-slate-200">
                <td colSpan={backendSites.length + 1} className="py-2 px-3 text-[11px] uppercase tracking-wider text-eco-primary flex items-center gap-1.5">
                  <span>🏛️ Dimension 3: Regulatory & State Policy Coverage</span>
                </td>
              </tr>
              <tr>
                <td className="p-3 font-medium text-slate-300">
                  <p>State Policy Framework</p>
                  <span className="text-[10px] text-eco-muted">Applicable DC Policy</span>
                </td>
                {backendSites.map((site) => {
                  const m = site.regulatory_readiness.metrics;
                  const framework = String(m.policy_framework || 'State policy framework unverified.');
                  return (
                    <td key={site.site_id} className="p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] text-slate-200 font-medium leading-snug">{framework}</span>
                        {renderDimensionStatusBadge(site.regulatory_readiness.status)}
                      </div>
                      {site.regulatory_readiness.notes.length > 0 && (
                        <p className="text-[10px] text-eco-muted mt-1 italic">
                          {site.regulatory_readiness.notes.join(' ')}
                        </p>
                      )}
                    </td>
                  );
                })}
              </tr>

              {/* Dimension 4: Evidence Completeness */}
              <tr className="bg-eco-surface-2/30 font-semibold text-slate-200">
                <td colSpan={backendSites.length + 1} className="py-2 px-3 text-[11px] uppercase tracking-wider text-eco-primary flex items-center gap-1.5">
                  <span>📊 Dimension 4: Evidence Completeness & Integrity</span>
                </td>
              </tr>
              <tr>
                <td className="p-3 font-medium text-slate-300">
                  <p>Evidence Ledger Integrity</p>
                  <span className="text-[10px] text-eco-muted">Verified Claims vs Contradictions</span>
                </td>
                {backendSites.map((site) => {
                  const m = site.evidence_completeness.metrics;
                  const verifiedCount = Number(m.verified_assertions || 0);
                  const conflictingCount = Number(m.conflicting_assertions || 0);
                  const documentedCount = Number(m.documented_assertions || 0);
                  const totalArtifacts = Number(m.total_artifacts || 0);
                  return (
                    <td key={site.site_id} className="p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono text-emerald-400 font-bold text-xs">{verifiedCount} Verified Claims</span>
                        {renderDimensionStatusBadge(site.evidence_completeness.status)}
                      </div>
                      <p className="text-[11px] text-slate-400 font-mono">
                        {documentedCount} Documented · {totalArtifacts} Artifacts
                      </p>
                      {conflictingCount > 0 && (
                        <p className="text-[10px] text-rose-400 mt-1 font-semibold">
                          ⚠️ {conflictingCount} Unresolved Contradictions
                        </p>
                      )}
                      {site.evidence_completeness.notes.length > 0 && (
                        <p className="text-[10px] text-eco-muted mt-1 italic">
                          {site.evidence_completeness.notes.join(' ')}
                        </p>
                      )}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    );
  }

  // Fallback to legacy frontend calculation when comparisonData is not provided
  if (sites.length === 0) {
    return (
      <Card title="3-Site Pre-Investment Comparison Matrix">
        <p className="text-xs text-eco-muted py-2">
          No candidate sites saved for this project. Draw or import up to 3 candidate polygons above to compare site readiness.
        </p>
      </Card>
    );
  }

  const latestPhase = phases
    .filter((p) => p.status === 'active')
    .sort((a, b) => b.sequence - a.sequence)[0];

  const fullLoadMW = latestPhase?.cumulative_facility_peak_mw || 80;
  const fullWaterKLD = latestPhase?.peak_summer_water_kld || 2800;

  const siteEvaluations = sites.map((site) => {
    const siteAssertions = assertions.filter((a) => !a.site_id || a.site_id === site.id);

    const sanctionedMW = siteAssertions
      .filter((a) => a.field_key === 'sanctioned_grid_mw' && a.status === 'VERIFIED_WITHIN_SCOPE')
      .reduce((max, a) => Math.max(max, Number(a.value) || 0), 0);
    const powerCoveragePct = Math.min(100, Math.round((sanctionedMW / fullLoadMW) * 100));

    const allocatedWaterKLD = siteAssertions
      .filter((a) => a.field_key === 'water_allocation_kld' && a.status === 'VERIFIED_WITHIN_SCOPE')
      .reduce((max, a) => Math.max(max, Number(a.value) || 0), 0);
    const waterCoveragePct = Math.min(100, Math.round((allocatedWaterKLD / fullWaterKLD) * 100));

    const isInsideBoundary = site.boundary_screening?.status === 'inside_screening_boundary';
    const envStatus = isInsideBoundary ? 'SCREENED_SUITABLE' : 'BOUNDARY_REVIEW_REQUIRED';

    let policyName = 'State Policy Framework';
    let powerTariffSubsidy = false;
    let stampDutyExemption = false;

    if (site.state_code === 'IN-MH') {
      policyName = 'Maharashtra IT/ITeS Policy 2023';
      powerTariffSubsidy = true;
      stampDutyExemption = true;
    } else if (site.state_code === 'IN-TG') {
      policyName = 'Telangana Data Centres Policy';
      powerTariffSubsidy = true;
      stampDutyExemption = true;
    } else if (site.state_code === 'IN-KA') {
      policyName = 'Karnataka Data Centre Policy 2022-2027';
      powerTariffSubsidy = true;
      stampDutyExemption = true;
    } else if (site.state_code === 'IN-TN') {
      policyName = 'Tamil Nadu Policy (2021 Expired - Requires Review)';
      powerTariffSubsidy = false;
      stampDutyExemption = false;
    }

    const verifiedCount = siteAssertions.filter((a) => a.status === 'VERIFIED_WITHIN_SCOPE').length;
    const conflictingCount = siteAssertions.filter((a) => a.status === 'CONFLICTING').length;
    const totalAssertions = Math.max(siteAssertions.length, 1);
    const evidenceCompletenessPct = Math.round((verifiedCount / totalAssertions) * 100);

    return {
      site,
      sanctionedMW,
      powerCoveragePct,
      allocatedWaterKLD,
      waterCoveragePct,
      envStatus,
      policyName,
      powerTariffSubsidy,
      stampDutyExemption,
      verifiedCount,
      conflictingCount,
      evidenceCompletenessPct,
    };
  });

  return (
    <Card title="3-Site Pre-Investment Comparison Matrix">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-eco-border pb-3 mb-4">
        <div>
          <p className="text-xs text-eco-muted">
            Independent four-dimensional pre-investment screening across up to 3 candidate polygons. Does not generate an arbitrary composite score.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onGeneratePassport && (
            <Button
              type="button"
              onClick={() => onGeneratePassport(activeSelection)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs whitespace-nowrap"
            >
              📄 Export Site Readiness Passport
            </Button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded border border-eco-border">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-eco-surface-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-eco-border">
            <tr>
              <th className="p-3 w-48">Dimension / Criteria</th>
              {siteEvaluations.map(({ site }) => (
                <th key={site.id} className="p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-slate-100 text-xs">{site.name}</p>
                      <p className="text-[10px] text-eco-muted font-mono">{site.state_code} · {site.area_ha.toFixed(2)} ha</p>
                    </div>
                    <input
                      type="radio"
                      name="selected_passport_site"
                      checked={activeSelection === site.id}
                      onChange={() => setSelectedSiteId(site.id)}
                      className="text-eco-primary focus:ring-eco-primary ml-2"
                      title="Select for Passport generation"
                    />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-eco-border/60">
            {/* Dimension 1: Resource Readiness */}
            <tr className="bg-eco-surface-2/30 font-semibold text-slate-200">
              <td colSpan={siteEvaluations.length + 1} className="py-2 px-3 text-[11px] uppercase tracking-wider text-eco-primary flex items-center gap-1.5">
                <span>⚡ Dimension 1: Resource Readiness</span>
              </td>
            </tr>
            <tr>
              <td className="p-3 font-medium text-slate-300">Grid Deliverability</td>
              {siteEvaluations.map(({ site, sanctionedMW, powerCoveragePct }) => (
                <td key={site.id} className="p-3">
                  <p className="font-mono text-slate-100 font-bold">{sanctionedMW} MW / {fullLoadMW} MW</p>
                  <div className="w-full bg-slate-800 rounded-full h-1.5 mt-1.5 overflow-hidden">
                    <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${powerCoveragePct}%` }} />
                  </div>
                  <span className="text-[10px] text-eco-muted mt-1 block">{powerCoveragePct}% Campus Capacity Supported</span>
                </td>
              ))}
            </tr>
            <tr>
              <td className="p-3 font-medium text-slate-300">Peak Summer Water Balance</td>
              {siteEvaluations.map(({ site, allocatedWaterKLD, waterCoveragePct }) => (
                <td key={site.id} className="p-3">
                  <p className="font-mono text-slate-100 font-bold">{allocatedWaterKLD} KLD / {fullWaterKLD} KLD</p>
                  <div className="w-full bg-slate-800 rounded-full h-1.5 mt-1.5 overflow-hidden">
                    <div className="bg-sky-500 h-1.5 rounded-full" style={{ width: `${waterCoveragePct}%` }} />
                  </div>
                  <span className="text-[10px] text-eco-muted mt-1 block">{waterCoveragePct}% Peak Demand Evidenced</span>
                </td>
              ))}
            </tr>

            {/* Dimension 2: Environmental Exposure */}
            <tr className="bg-eco-surface-2/30 font-semibold text-slate-200">
              <td colSpan={siteEvaluations.length + 1} className="py-2 px-3 text-[11px] uppercase tracking-wider text-eco-primary flex items-center gap-1.5">
                <span>🌱 Dimension 2: Environmental & Spatial Screening</span>
              </td>
            </tr>
            <tr>
              <td className="p-3 font-medium text-slate-300">Territorial Screening</td>
              {siteEvaluations.map(({ site, envStatus }) => (
                <td key={site.id} className="p-3">
                  {envStatus === 'SCREENED_SUITABLE' ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400">
                      ✓ Inside Focus State ADM1
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-400">
                      ⚠️ Boundary Review Required
                    </span>
                  )}
                  <p className="text-[10px] text-eco-muted mt-0.5">geoBoundaries gbOpen IND ADM1</p>
                </td>
              ))}
            </tr>

            {/* Dimension 3: Regulatory Readiness */}
            <tr className="bg-eco-surface-2/30 font-semibold text-slate-200">
              <td colSpan={siteEvaluations.length + 1} className="py-2 px-3 text-[11px] uppercase tracking-wider text-eco-primary flex items-center gap-1.5">
                <span>🏛️ Dimension 3: Regulatory & State Policy Coverage</span>
              </td>
            </tr>
            <tr>
              <td className="p-3 font-medium text-slate-300">State Data Centre Policy</td>
              {siteEvaluations.map(({ site, policyName, powerTariffSubsidy, stampDutyExemption }) => (
                <td key={site.id} className="p-3">
                  <p className="text-slate-200 font-medium">{policyName}</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {powerTariffSubsidy && <span className="rounded bg-slate-800 px-1 py-0.5 text-[9px] text-emerald-300">Power Subsidy</span>}
                    {stampDutyExemption && <span className="rounded bg-slate-800 px-1 py-0.5 text-[9px] text-sky-300">Stamp Duty Exemption</span>}
                    {!powerTariffSubsidy && <span className="rounded bg-amber-500/10 px-1 py-0.5 text-[9px] text-amber-400">Recheck Eligibility</span>}
                  </div>
                </td>
              ))}
            </tr>

            {/* Dimension 4: Evidence Completeness */}
            <tr className="bg-eco-surface-2/30 font-semibold text-slate-200">
              <td colSpan={siteEvaluations.length + 1} className="py-2 px-3 text-[11px] uppercase tracking-wider text-eco-primary flex items-center gap-1.5">
                <span>📊 Dimension 4: Evidence Completeness & Integrity</span>
              </td>
            </tr>
            <tr>
              <td className="p-3 font-medium text-slate-300">Verified Evidence Ratio</td>
              {siteEvaluations.map(({ site, verifiedCount, conflictingCount, evidenceCompletenessPct }) => (
                <td key={site.id} className="p-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-slate-100 font-bold">{evidenceCompletenessPct}%</span>
                    <span className="text-[10px] text-eco-muted">({verifiedCount} Verified Claims)</span>
                  </div>
                  {conflictingCount > 0 && (
                    <p className="text-[10px] text-rose-400 mt-1 font-medium">⚠️ {conflictingCount} Unresolved Contradictions</p>
                  )}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  );
}
