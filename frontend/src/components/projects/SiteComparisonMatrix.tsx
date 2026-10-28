import React, { useState } from 'react';
import type { CandidateSite } from '../../services/projects';
import type { ProjectPhase } from '../../services/phases';
import type { Assertion } from '../../types/evidence';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

interface SiteComparisonMatrixProps {
  sites: CandidateSite[];
  phases: ProjectPhase[];
  assertions: Assertion[];
  onGeneratePassport?: (selectedSiteId: string) => void;
}

export function SiteComparisonMatrix({
  sites,
  phases,
  assertions,
  onGeneratePassport,
}: SiteComparisonMatrixProps) {
  const [selectedSiteId, setSelectedSiteId] = useState<string>(sites[0]?.id || '');

  if (sites.length === 0) {
    return (
      <Card title="3-Site Pre-Investment Comparison Matrix">
        <p className="text-xs text-eco-muted py-2">
          No candidate sites saved for this project. Draw or import up to 3 candidate polygons above to compare site readiness.
        </p>
      </Card>
    );
  }

  // Active full campus phase load
  const latestPhase = phases
    .filter((p) => p.status === 'active')
    .sort((a, b) => b.sequence - a.sequence)[0];

  const fullLoadMW = latestPhase?.cumulative_facility_peak_mw || 80;
  const fullWaterKLD = latestPhase?.peak_summer_water_kld || 2800;

  // Compute evaluation per site
  const siteEvaluations = sites.map((site) => {
    const siteAssertions = assertions.filter((a) => !a.site_id || a.site_id === site.id);

    // Dimension 1: Resource Readiness
    const sanctionedMW = siteAssertions
      .filter((a) => a.field_key === 'sanctioned_grid_mw' && a.status === 'VERIFIED_WITHIN_SCOPE')
      .reduce((max, a) => Math.max(max, Number(a.value) || 0), 0);
    const powerCoveragePct = Math.min(100, Math.round((sanctionedMW / fullLoadMW) * 100));

    const allocatedWaterKLD = siteAssertions
      .filter((a) => a.field_key === 'water_allocation_kld' && a.status === 'VERIFIED_WITHIN_SCOPE')
      .reduce((max, a) => Math.max(max, Number(a.value) || 0), 0);
    const waterCoveragePct = Math.min(100, Math.round((allocatedWaterKLD / fullWaterKLD) * 100));

    // Dimension 2: Environmental Exposure (Deterministic rules from state & boundary)
    const isInsideBoundary = site.boundary_screening?.status === 'inside_screening_boundary';
    const envStatus = isInsideBoundary ? 'SCREENED_SUITABLE' : 'BOUNDARY_REVIEW_REQUIRED';

    // Dimension 3: Regulatory Readiness (Derived from State Data Centre Policy)
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

    // Dimension 4: Evidence Completeness
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
              onClick={() => onGeneratePassport(selectedSiteId || sites[0]?.id)}
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
                      checked={selectedSiteId === site.id}
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
