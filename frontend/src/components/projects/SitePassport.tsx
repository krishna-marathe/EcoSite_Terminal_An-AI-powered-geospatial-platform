import React, { useRef } from 'react';
import type { Project, CandidateSite } from '../../services/projects';
import type { ProjectPhase } from '../../services/phases';
import type { Assertion, EvidenceArtifact } from '../../types/evidence';
import type { SiteReadinessPassport } from '../../types/readiness';
import type { Observation } from '../../services/observations';
import { Button } from '../ui/Button';

interface SitePassportProps {
  project: Project;
  site: CandidateSite;
  phases?: ProjectPhase[];
  assertions?: Assertion[];
  artifacts?: EvidenceArtifact[];
  observations?: Observation[];
  passportData?: SiteReadinessPassport | null;
  loading?: boolean;
  error?: string | null;
  onClose?: () => void;
}

export function SitePassport({
  project,
  site,
  phases = [],
  assertions = [],
  artifacts = [],
  observations = [],
  passportData,
  loading = false,
  error = null,
  onClose,
}: SitePassportProps) {
  const passportRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm p-4 sm:p-6 flex justify-center items-center">
        <div className="bg-eco-surface border border-eco-border rounded-lg p-6 max-w-md w-full text-center space-y-3">
          <p className="text-sm font-semibold text-slate-100 animate-pulse">
            Generating immutable pre-investment Site Readiness Passport snapshot…
          </p>
          <p className="text-xs text-eco-muted">
            Aggregating evidence artifacts, firm deliverability balance, and statutory checklist.
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm p-4 sm:p-6 flex justify-center items-center">
        <div className="bg-eco-surface border border-rose-500/30 rounded-lg p-6 max-w-md w-full text-center space-y-3" role="alert">
          <p className="text-sm font-bold text-rose-400">Failed to load Site Readiness Passport</p>
          <p className="text-xs text-slate-300">{error}</p>
          {onClose && (
            <Button type="button" onClick={onClose} className="mt-3 bg-eco-surface-2 text-xs">
              Close
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Real backend passport data rendering
  if (passportData) {
    const secSpatial = passportData.sections.find((s) => s.section_id === 'sec_spatial');
    const secPhases = passportData.sections.find((s) => s.section_id === 'sec_phases');
    const secGaps = passportData.sections.find((s) => s.section_id === 'sec_resource_gaps');

    const campusSummary = (secGaps?.data?.campus_summary || {}) as Record<string, unknown>;
    const reportPhases = ((secPhases?.data?.phases as Array<Record<string, unknown>>) || []);

    const totalFacilityMw = typeof campusSummary.total_cumulative_facility_peak_mw === 'number'
      ? campusSummary.total_cumulative_facility_peak_mw
      : 0;
    const totalItMw = typeof campusSummary.total_cumulative_it_mw === 'number'
      ? campusSummary.total_cumulative_it_mw
      : 0;
    const verifiedPowerMw = typeof campusSummary.total_qualifying_firm_power_mw === 'number'
      ? campusSummary.total_qualifying_firm_power_mw
      : 0;
    const powerDeficitMw = typeof campusSummary.overall_power_gap_mw === 'number'
      ? campusSummary.overall_power_gap_mw
      : 0;

    const totalWaterKld = typeof campusSummary.total_peak_summer_water_kld === 'number'
      ? campusSummary.total_peak_summer_water_kld
      : 0;
    const verifiedWaterKld = typeof campusSummary.total_qualifying_firm_water_kld === 'number'
      ? campusSummary.total_qualifying_firm_water_kld
      : 0;
    const waterDeficitKld = typeof campusSummary.overall_water_gap_kld === 'number'
      ? campusSummary.overall_water_gap_kld
      : 0;

    const verifiedCount = assertions.filter((a) => a.status === 'VERIFIED_WITHIN_SCOPE').length;
    const conflictingCount = assertions.filter((a) => a.status === 'CONFLICTING').length;
    const documentedCount = assertions.filter((a) => a.status === 'DOCUMENTED').length;

    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm p-4 sm:p-6 flex justify-center print:p-0 print:bg-white print:static">
        <div
          ref={passportRef}
          className="w-full max-w-4xl bg-eco-surface border border-eco-border rounded-lg shadow-2xl p-6 sm:p-8 space-y-6 print:border-none print:shadow-none print:text-black print:bg-white"
        >
          {/* Header Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-eco-border pb-4 print:border-black">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-eco-primary/10 px-2 py-0.5 text-xs font-mono text-eco-primary border border-eco-primary/30 uppercase print:border-black print:text-black">
                  Official Pre-Investment Dossier
                </span>
                <span className="text-xs text-eco-muted font-mono print:text-gray-600">
                  Passport ID: {passportData.passport_id}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-100 tracking-tight mt-1 print:text-black">
                Site Readiness Passport: {passportData.site_name}
              </h1>
              <p className="text-xs text-eco-muted mt-0.5 print:text-gray-600">
                Project: <strong className="text-slate-300 print:text-black">{passportData.project_name}</strong> ({passportData.archetype.toUpperCase()}) · State: {passportData.state_code}
                {passportData.district ? ` · District: ${passportData.district}` : ''}
              </p>
            </div>

            <div className="flex items-center gap-2 print:hidden">
              <Button type="button" onClick={handlePrint} className="bg-eco-primary text-black font-semibold hover:bg-eco-primary/90">
                🖨️ Print / Export PDF
              </Button>
              {onClose && (
                <Button type="button" onClick={onClose} className="border-eco-border hover:bg-eco-surface-2">
                  Close
                </Button>
              )}
            </div>
          </div>

          {/* Epistemic Honesty Banner from Backend */}
          <div className="rounded border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200 print:border-gray-400 print:text-gray-800 print:bg-gray-100">
            <p className="font-semibold uppercase tracking-wider text-[11px] text-amber-400 print:text-black">
              Pre-Investment Screening & Honesty Disclaimer
            </p>
            <p className="mt-1 leading-relaxed">
              {passportData.epistemic_disclaimer}
            </p>
          </div>

          {/* 1. Parcel & Spatial Screening */}
          <div className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300 border-b border-eco-border pb-1 print:text-black print:border-black">
              1. {secSpatial?.title || 'Spatial & Boundary Screening'}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-2.5 rounded bg-eco-surface-2/60 border border-eco-border print:border-gray-300">
                <span className="text-eco-muted block text-[11px] print:text-gray-600">Total Parcel Area</span>
                <strong className="text-sm font-mono text-slate-200 print:text-black">{passportData.parcel_area_ha.toFixed(2)} ha</strong>
                <span className="text-[10px] text-eco-muted block">({(passportData.parcel_area_ha * 2.471).toFixed(1)} acres)</span>
              </div>
              <div className="p-2.5 rounded bg-eco-surface-2/60 border border-eco-border print:border-gray-300">
                <span className="text-eco-muted block text-[11px] print:text-gray-600">Jurisdiction</span>
                <strong className="text-sm text-slate-200 print:text-black">{passportData.state_code}</strong>
                <span className="text-[10px] text-eco-muted block">{passportData.district || 'Unspecified district'}</span>
              </div>
              <div className="p-2.5 rounded bg-eco-surface-2/60 border border-eco-border print:border-gray-300">
                <span className="text-eco-muted block text-[11px] print:text-gray-600">Boundary Screening</span>
                <span className="font-medium text-emerald-400 print:text-black">
                  {passportData.boundary_screening_status === 'inside_screening_boundary'
                    ? 'Inside Screening Boundary'
                    : 'Review Required'}
                </span>
                <span className="text-[10px] text-eco-muted block font-mono">Source: {passportData.boundary_source}</span>
              </div>
              <div className="p-2.5 rounded bg-eco-surface-2/60 border border-eco-border print:border-gray-300">
                <span className="text-eco-muted block text-[11px] print:text-gray-600">Dossier Revision</span>
                <strong className="text-sm font-mono text-slate-200 print:text-black">Status: {secSpatial?.status || 'VALID'}</strong>
                <span className="text-[10px] text-eco-muted block">Immutable Snapshot</span>
              </div>
            </div>
          </div>

          {/* 2. Campus Phasing & Cumulative Resource Demand */}
          <div className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300 border-b border-eco-border pb-1 print:text-black print:border-black">
              2. {secPhases?.title || 'Campus Lifecycle & Phasing Progression'}
            </h2>
            {reportPhases.length === 0 ? (
              <p className="text-xs text-eco-muted italic">No phases defined for this campus.</p>
            ) : (
              <div className="overflow-x-auto rounded border border-eco-border print:border-gray-300">
                <table className="w-full text-left text-xs">
                  <thead className="bg-eco-surface-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-eco-border print:bg-gray-100 print:text-black">
                    <tr>
                      <th className="p-2">Phase</th>
                      <th className="p-2">Target Date</th>
                      <th className="p-2 text-right">IT Load</th>
                      <th className="p-2 text-right">Facility Peak</th>
                      <th className="p-2 text-right">Design PUE</th>
                      <th className="p-2 text-right">Water Demand</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-eco-border/60 print:divide-gray-300">
                    {reportPhases.map((phase, idx) => {
                      const pName = String(phase.phase_name || `Phase ${idx + 1}`);
                      const pDate = String(phase.commissioning_date || 'TBD');
                      const pIT = typeof phase.cumulative_it_mw === 'number' ? phase.cumulative_it_mw : 0;
                      const pPeak = typeof phase.cumulative_facility_peak_mw === 'number'
                        ? phase.cumulative_facility_peak_mw
                        : typeof (phase.power as Record<string, unknown>)?.demand_mw === 'number'
                        ? ((phase.power as Record<string, unknown>).demand_mw as number)
                        : 0;
                      const pPUE = typeof phase.design_pue === 'number' ? phase.design_pue : 1.4;
                      const pWater = typeof phase.peak_summer_water_kld === 'number'
                        ? phase.peak_summer_water_kld
                        : typeof (phase.water as Record<string, unknown>)?.peak_summer_demand_kld === 'number'
                        ? ((phase.water as Record<string, unknown>).peak_summer_demand_kld as number)
                        : 0;

                      return (
                        <tr key={idx} className="text-slate-300 print:text-black">
                          <td className="p-2 font-medium">{pName}</td>
                          <td className="p-2 font-mono text-eco-muted print:text-gray-600">{pDate}</td>
                          <td className="p-2 text-right font-mono">{pIT.toFixed(1)} MW</td>
                          <td className="p-2 text-right font-mono font-medium">{pPeak.toFixed(1)} MW</td>
                          <td className="p-2 text-right font-mono">{pPUE.toFixed(2)}</td>
                          <td className="p-2 text-right font-mono">{pWater.toFixed(0)} KLD</td>
                        </tr>
                      );
                    })}
                    <tr className="bg-eco-surface-2/40 font-semibold border-t border-eco-border print:bg-gray-50 print:text-black">
                      <td className="p-2">Full Buildout Total</td>
                      <td className="p-2">—</td>
                      <td className="p-2 text-right font-mono text-eco-primary print:text-black">{totalItMw.toFixed(1)} MW</td>
                      <td className="p-2 text-right font-mono text-eco-primary print:text-black">{totalFacilityMw.toFixed(1)} MW</td>
                      <td className="p-2 text-right font-mono text-eco-muted print:text-black">
                        {totalItMw > 0 ? (totalFacilityMw / totalItMw).toFixed(2) : '1.40'} (avg)
                      </td>
                      <td className="p-2 text-right font-mono text-sky-400 print:text-black">{totalWaterKld.toFixed(0)} KLD</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 3. Resource Gap Analysis */}
          <div className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300 border-b border-eco-border pb-1 print:text-black print:border-black">
              3. {secGaps?.title || 'Resource Delivery & Commitment Deficit Audit'}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="rounded border border-eco-border p-3 space-y-2 print:border-gray-300">
                <h3 className="font-semibold text-slate-200 flex justify-between items-center print:text-black">
                  <span>⚡ Power Deliverability Balance</span>
                  <span className={powerDeficitMw > 0 ? 'text-amber-400' : 'text-emerald-400'}>
                    {powerDeficitMw > 0 ? `${powerDeficitMw.toFixed(1)} MW Gap` : 'Fully Substantiated'}
                  </span>
                </h3>
                <div className="space-y-1 font-mono text-[11px] text-eco-muted print:text-gray-700">
                  <div className="flex justify-between">
                    <span>Campus Full Buildout Demand:</span>
                    <span className="text-slate-200 print:text-black">{totalFacilityMw.toFixed(1)} MW</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Verified Substation Feasibility:</span>
                    <span className="text-emerald-400 print:text-black">{verifiedPowerMw.toFixed(1)} MW</span>
                  </div>
                  <div className="flex justify-between border-t border-eco-border/40 pt-1 font-semibold">
                    <span>Unbacked / At-Risk Capacity:</span>
                    <span className={powerDeficitMw > 0 ? 'text-amber-400' : 'text-slate-400'}>
                      {powerDeficitMw.toFixed(1)} MW ({totalFacilityMw > 0 ? Math.round((powerDeficitMw / totalFacilityMw) * 100) : 0}%)
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded border border-eco-border p-3 space-y-2 print:border-gray-300">
                <h3 className="font-semibold text-slate-200 flex justify-between items-center print:text-black">
                  <span>💧 Industrial Water Supply Balance</span>
                  <span className={waterDeficitKld > 0 ? 'text-amber-400' : 'text-emerald-400'}>
                    {waterDeficitKld > 0 ? `${waterDeficitKld.toFixed(0)} KLD Gap` : 'Fully Substantiated'}
                  </span>
                </h3>
                <div className="space-y-1 font-mono text-[11px] text-eco-muted print:text-gray-700">
                  <div className="flex justify-between">
                    <span>Peak Summer Daily Demand:</span>
                    <span className="text-slate-200 print:text-black">{totalWaterKld.toFixed(0)} KLD</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Verified Municipal/MIDC Allocation:</span>
                    <span className="text-sky-400 print:text-black">{verifiedWaterKld.toFixed(0)} KLD</span>
                  </div>
                  <div className="flex justify-between border-t border-eco-border/40 pt-1 font-semibold">
                    <span>Unbacked / At-Risk Water:</span>
                    <span className={waterDeficitKld > 0 ? 'text-amber-400' : 'text-slate-400'}>
                      {waterDeficitKld.toFixed(0)} KLD ({totalWaterKld > 0 ? Math.round((waterDeficitKld / totalWaterKld) * 100) : 0}%)
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Findings list from passport */}
            {secGaps?.findings && secGaps.findings.length > 0 && (
              <div className="rounded border border-eco-border/80 bg-eco-surface-2/40 p-2.5 space-y-1 text-xs">
                <p className="font-semibold text-slate-300 text-[11px] uppercase tracking-wider">Identified Epistemic Deficits:</p>
                {secGaps.findings.map((f, i) => (
                  <p key={i} className="text-amber-300/90 text-[11px]">
                    • [{f.severity}] {f.message}
                  </p>
                ))}
              </div>
            )}
          </div>

          {/* 4. Evidence Integrity & Document Ledger */}
          <div className="space-y-2">
            <div className="flex justify-between items-center border-b border-eco-border pb-1 print:border-black">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300 print:text-black">
                4. Evidence Vault & Document Ledger ({artifacts.length} Artifacts)
              </h2>
              <div className="flex gap-2 text-[11px] font-mono">
                <span className="text-emerald-400 print:text-black">{verifiedCount} Verified</span>
                <span className="text-sky-400 print:text-black">{documentedCount} Documented</span>
                {conflictingCount > 0 && <span className="text-rose-400 font-semibold print:text-red-700">{conflictingCount} Conflicting</span>}
              </div>
            </div>

            {artifacts.length === 0 ? (
              <p className="text-xs text-eco-muted italic">No evidence artifacts uploaded.</p>
            ) : (
              <div className="space-y-1.5">
                {artifacts.map((a) => (
                  <div
                    key={a.id}
                    className="p-2 rounded border border-eco-border bg-eco-surface-2/40 flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-1 print:border-gray-300 print:bg-white"
                  >
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-eco-primary/10 px-1.5 py-0.5 text-[10px] font-mono text-eco-primary uppercase print:border print:border-black print:text-black">
                        {a.document_type.replace(/_/g, ' ')}
                      </span>
                      <strong className="text-slate-200 print:text-black">{a.filename}</strong>
                      {a.synthetic_demo && (
                        <span className="text-[10px] text-amber-400 border border-amber-500/30 px-1 rounded print:text-black">
                          SYNTHETIC
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-eco-muted font-mono flex items-center gap-3 print:text-gray-600">
                      {a.issuer && <span>Issuer: {a.issuer}</span>}
                      {a.issued_on && <span>Date: {a.issued_on}</span>}
                      <span title={a.sha256}>SHA: {a.sha256.substring(0, 10)}…</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 5. Statutory Approvals Checklist from Backend */}
          <div className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300 border-b border-eco-border pb-1 print:text-black print:border-black">
              5. Mandatory Statutory Approvals Checklist
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {passportData.statutory_checklist.map((item, idx) => (
                <div key={idx} className="p-2 rounded border border-eco-border bg-eco-surface-2/30 flex items-start gap-2 print:border-gray-300">
                  <span className="font-mono text-xs">
                    {item.status === 'VERIFIED' ? (
                      <span className="text-emerald-400 font-bold">[✓]</span>
                    ) : item.status === 'ATTENTION_REQUIRED' ? (
                      <span className="text-amber-400 font-bold">[!]</span>
                    ) : (
                      <span className="text-slate-500">[ ]</span>
                    )}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <strong className="text-slate-200 block print:text-black">{item.name}</strong>
                      <span className={
                        item.status === 'VERIFIED'
                          ? 'text-[10px] font-mono text-emerald-400'
                          : item.status === 'ATTENTION_REQUIRED'
                          ? 'text-[10px] font-mono text-amber-400'
                          : 'text-[10px] font-mono text-eco-muted'
                      }>
                        {item.status}
                      </span>
                    </div>
                    <span className="text-[11px] text-eco-muted print:text-gray-600">{item.mandate}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>


          {/* 6. Environmental Observations & Geospatial Screening */}
          <div className="space-y-2">
            <div className="flex justify-between items-center border-b border-eco-border pb-1 print:border-black">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300 print:text-black">
                6. Environmental Intelligence & Geospatial Screening ({observations.length} Observations)
              </h2>
              {observations.length > 0 && (
                <span className="text-[11px] font-mono text-emerald-400 print:text-black">
                  Public Geospatial / Reanalysis Grounding
                </span>
              )}
            </div>

            {observations.length === 0 ? (
              <div className="rounded border border-eco-border/60 bg-eco-surface-2/20 p-3 text-xs text-eco-muted print:border-gray-300">
                <p className="font-semibold text-slate-300 print:text-black">No local environmental observations run yet</p>
                <p className="mt-1">
                  Run local environmental analysis (JRC Global Surface Water, Copernicus Sentinel-2 STAC, NASA POWER) from the candidate site view to populate surface water occurrence and climate observations in this Passport.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="overflow-x-auto rounded border border-eco-border print:border-gray-300">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-eco-surface-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-eco-border print:bg-gray-100 print:text-black">
                      <tr>
                        <th className="p-2">Source</th>
                        <th className="p-2">Indicator</th>
                        <th className="p-2 text-right">Value</th>
                        <th className="p-2">Unit</th>
                        <th className="p-2">Status</th>
                        <th className="p-2">Evidence Class</th>
                        <th className="p-2">Period / Observed</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-eco-border/60 print:divide-gray-300">
                      {observations.map((obs) => (
                        <tr key={obs.id} className="text-slate-300 print:text-black">
                          <td className="p-2 font-medium">{obs.source_id}</td>
                          <td className="p-2">{obs.indicator.replace(/_/g, ' ')}</td>
                          <td className="p-2 text-right font-mono font-medium">
                            {obs.value === null ? (
                              <span className="text-eco-muted italic">Unavailable</span>
                            ) : (
                              obs.value.toLocaleString(undefined, { maximumFractionDigits: 3 })
                            )}
                          </td>
                          <td className="p-2 text-eco-muted print:text-gray-600">{obs.unit}</td>
                          <td className="p-2">
                            <span className={obs.status === 'AVAILABLE' ? 'text-emerald-400 font-mono text-[10px]' : 'text-amber-400 font-mono text-[10px]'}>
                              {obs.status}
                            </span>
                          </td>
                          <td className="p-2 font-mono text-[10px] text-eco-muted print:text-gray-600">{obs.evidence_class}</td>
                          <td className="p-2 text-eco-muted font-mono text-[10px] print:text-gray-600">
                            {obs.period_start || obs.observed_at || (obs.retrieved_at ? obs.retrieved_at.split('T')[0] : '—')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-[10px] text-eco-muted italic print:text-gray-600">
                  Environmental observations provide preliminary screening data only. They do not constitute official Survey of India boundary certificates, statutory EIA clearances, or verified on-site geotechnical bore logs.
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-eco-border pt-4 text-[10px] text-eco-muted flex flex-col sm:flex-row justify-between items-center gap-2 print:border-black print:text-gray-600">
            <p>EcoSite India Platform · One Earth Hackathon 2026 · Evaluated by Antigravity OS</p>
            <p className="font-mono">Passport Digest: {passportData.passport_id}</p>
          </div>
        </div>
      </div>
    );
  }

  // Fallback to legacy calculation when passportData is not passed
  const totalItMw = phases.reduce((acc, p) => acc + (p.cumulative_it_mw || 0), 0);
  const totalFacilityMw = phases.reduce((acc, p) => acc + (p.cumulative_facility_peak_mw || 0), 0);
  const totalWaterKld = phases.reduce((acc, p) => acc + (p.peak_summer_water_kld || 0), 0);

  const verifiedPowerAssertion = assertions.find(
    (a) => (a.field_key === 'sanctioned_grid_mw' || a.field_key === 'power_sanctioned_mw') && a.status === 'VERIFIED_WITHIN_SCOPE'
  );
  const verifiedWaterAssertion = assertions.find(
    (a) => a.field_key === 'water_allocation_kld' && a.status === 'VERIFIED_WITHIN_SCOPE'
  );

  const verifiedPowerMw = verifiedPowerAssertion ? Number(verifiedPowerAssertion.value) : 0;
  const verifiedWaterKld = verifiedWaterAssertion ? Number(verifiedWaterAssertion.value) : 0;

  const powerDeficitMw = Math.max(0, totalFacilityMw - verifiedPowerMw);
  const waterDeficitKld = Math.max(0, totalWaterKld - verifiedWaterKld);

  const verifiedCount = assertions.filter((a) => a.status === 'VERIFIED_WITHIN_SCOPE').length;
  const conflictingCount = assertions.filter((a) => a.status === 'CONFLICTING').length;
  const documentedCount = assertions.filter((a) => a.status === 'DOCUMENTED').length;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm p-4 sm:p-6 flex justify-center print:p-0 print:bg-white print:static">
      <div
        ref={passportRef}
        className="w-full max-w-4xl bg-eco-surface border border-eco-border rounded-lg shadow-2xl p-6 sm:p-8 space-y-6 print:border-none print:shadow-none print:text-black print:bg-white"
      >
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-eco-border pb-4 print:border-black">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-eco-primary/10 px-2 py-0.5 text-xs font-mono text-eco-primary border border-eco-primary/30 uppercase print:border-black print:text-black">
                Official Pre-Investment Dossier
              </span>
              <span className="text-xs text-eco-muted font-mono print:text-gray-600">
                Generated: {new Date().toISOString().split('T')[0]}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-100 tracking-tight mt-1 print:text-black">
              Site Readiness Passport: {site.name}
            </h1>
            <p className="text-xs text-eco-muted mt-0.5 print:text-gray-600">
              Project: <strong className="text-slate-300 print:text-black">{project.name}</strong> ({project.archetype.toUpperCase()}) · Organization: {project.organization_label}
            </p>
          </div>

          <div className="flex items-center gap-2 print:hidden">
            <Button type="button" onClick={handlePrint} className="bg-eco-primary text-black font-semibold hover:bg-eco-primary/90">
              🖨️ Print / Export PDF
            </Button>
            {onClose && (
              <Button type="button" onClick={onClose} className="border-eco-border hover:bg-eco-surface-2">
                Close
              </Button>
            )}
          </div>
        </div>

        {/* Epistemic Honesty Banner */}
        <div className="rounded border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200 print:border-gray-400 print:text-gray-800 print:bg-gray-100">
          <p className="font-semibold uppercase tracking-wider text-[11px] text-amber-400 print:text-black">
            Pre-Investment Screening & Honesty Disclaimer
          </p>
          <p className="mt-1 leading-relaxed">
            This passport is an automated evidence compilation for preliminary site screening only. It does <strong>not</strong> constitute an official governmental clearance, legal title guarantee, or verified utility capacity reservation. Grid deliverability is subject to formal DISCOM/STU feasibility studies.
          </p>
        </div>

        {/* 1. Parcel & Spatial Screening */}
        <div className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300 border-b border-eco-border pb-1 print:text-black print:border-black">
            1. Candidate Polygon & Screening Status
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-2.5 rounded bg-eco-surface-2/60 border border-eco-border print:border-gray-300">
              <span className="text-eco-muted block text-[11px] print:text-gray-600">Total Parcel Area</span>
              <strong className="text-sm font-mono text-slate-200 print:text-black">{site.area_ha.toFixed(2)} ha</strong>
              <span className="text-[10px] text-eco-muted block">({(site.area_ha * 2.471).toFixed(1)} acres)</span>
            </div>
            <div className="p-2.5 rounded bg-eco-surface-2/60 border border-eco-border print:border-gray-300">
              <span className="text-eco-muted block text-[11px] print:text-gray-600">Location</span>
              <strong className="text-sm text-slate-200 print:text-black">{site.state_code}</strong>
              <span className="text-[10px] text-eco-muted block">{site.district || 'Unspecified district'}</span>
            </div>
            <div className="p-2.5 rounded bg-eco-surface-2/60 border border-eco-border print:border-gray-300">
              <span className="text-eco-muted block text-[11px] print:text-gray-600">Boundary Screening</span>
              <span className="font-medium text-emerald-400 print:text-black">
                {site.boundary_screening?.status === 'inside_screening_boundary'
                  ? 'Inside Screening Boundary'
                  : 'Review Required'}
              </span>
              <span className="text-[10px] text-eco-muted block font-mono">Source: {site.boundary_source}</span>
            </div>
            <div className="p-2.5 rounded bg-eco-surface-2/60 border border-eco-border print:border-gray-300">
              <span className="text-eco-muted block text-[11px] print:text-gray-600">Revision Tracking</span>
              <strong className="text-sm font-mono text-slate-200 print:text-black">Rev {site.revision}</strong>
              <span className="text-[10px] text-eco-muted block">Polygon valid</span>
            </div>
          </div>
        </div>

        {/* 2. Campus Phasing & Cumulative Resource Demand */}
        <div className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300 border-b border-eco-border pb-1 print:text-black print:border-black">
            2. Campus Development Phases & Resource Demands
          </h2>
          {phases.length === 0 ? (
            <p className="text-xs text-eco-muted italic">No phases defined for this campus.</p>
          ) : (
            <div className="overflow-x-auto rounded border border-eco-border print:border-gray-300">
              <table className="w-full text-left text-xs">
                <thead className="bg-eco-surface-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-eco-border print:bg-gray-100 print:text-black">
                  <tr>
                    <th className="p-2">Phase</th>
                    <th className="p-2">Target Date</th>
                    <th className="p-2 text-right">IT Load</th>
                    <th className="p-2 text-right">Facility Peak</th>
                    <th className="p-2 text-right">Design PUE</th>
                    <th className="p-2 text-right">Water Demand</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-eco-border/60 print:divide-gray-300">
                  {phases.map((phase) => (
                    <tr key={phase.id} className="text-slate-300 print:text-black">
                      <td className="p-2 font-medium">{phase.name}</td>
                      <td className="p-2 font-mono text-eco-muted print:text-gray-600">{phase.commissioning_date || 'TBD'}</td>
                      <td className="p-2 text-right font-mono">{phase.cumulative_it_mw?.toFixed(1) || '0.0'} MW</td>
                      <td className="p-2 text-right font-mono font-medium">{phase.cumulative_facility_peak_mw?.toFixed(1) || '0.0'} MW</td>
                      <td className="p-2 text-right font-mono">{phase.design_pue?.toFixed(2) || '1.40'}</td>
                      <td className="p-2 text-right font-mono">{phase.peak_summer_water_kld?.toFixed(0) || '0'} KLD</td>
                    </tr>
                  ))}
                  <tr className="bg-eco-surface-2/40 font-semibold border-t border-eco-border print:bg-gray-50 print:text-black">
                    <td className="p-2">Full Buildout Total</td>
                    <td className="p-2">—</td>
                    <td className="p-2 text-right font-mono text-eco-primary print:text-black">{totalItMw.toFixed(1)} MW</td>
                    <td className="p-2 text-right font-mono text-eco-primary print:text-black">{totalFacilityMw.toFixed(1)} MW</td>
                    <td className="p-2 text-right font-mono text-eco-muted print:text-black">
                      {totalItMw > 0 ? (totalFacilityMw / totalItMw).toFixed(2) : '1.40'} (avg)
                    </td>
                    <td className="p-2 text-right font-mono text-sky-400 print:text-black">{totalWaterKld.toFixed(0)} KLD</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 3. Resource Gap Analysis */}
        <div className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300 border-b border-eco-border pb-1 print:text-black print:border-black">
            3. Resource Delivery & Commitment Deficit Audit
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="rounded border border-eco-border p-3 space-y-2 print:border-gray-300">
              <h3 className="font-semibold text-slate-200 flex justify-between items-center print:text-black">
                <span>⚡ Power Deliverability Balance</span>
                <span className={powerDeficitMw > 0 ? "text-amber-400" : "text-emerald-400"}>
                  {powerDeficitMw > 0 ? `${powerDeficitMw.toFixed(1)} MW Gap` : 'Fully Substantiated'}
                </span>
              </h3>
              <div className="space-y-1 font-mono text-[11px] text-eco-muted print:text-gray-700">
                <div className="flex justify-between">
                  <span>Campus Full Buildout Demand:</span>
                  <span className="text-slate-200 print:text-black">{totalFacilityMw.toFixed(1)} MW</span>
                </div>
                <div className="flex justify-between">
                  <span>Verified Substation Feasibility:</span>
                  <span className="text-emerald-400 print:text-black">{verifiedPowerMw.toFixed(1)} MW</span>
                </div>
                <div className="flex justify-between border-t border-eco-border/40 pt-1 font-semibold">
                  <span>Unbacked / At-Risk Capacity:</span>
                  <span className={powerDeficitMw > 0 ? "text-amber-400" : "text-slate-400"}>
                    {powerDeficitMw.toFixed(1)} MW ({totalFacilityMw > 0 ? Math.round((powerDeficitMw / totalFacilityMw) * 100) : 0}%)
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded border border-eco-border p-3 space-y-2 print:border-gray-300">
              <h3 className="font-semibold text-slate-200 flex justify-between items-center print:text-black">
                <span>💧 Industrial Water Supply Balance</span>
                <span className={waterDeficitKld > 0 ? "text-amber-400" : "text-emerald-400"}>
                  {waterDeficitKld > 0 ? `${waterDeficitKld.toFixed(0)} KLD Gap` : 'Fully Substantiated'}
                </span>
              </h3>
              <div className="space-y-1 font-mono text-[11px] text-eco-muted print:text-gray-700">
                <div className="flex justify-between">
                  <span>Peak Summer Daily Demand:</span>
                  <span className="text-slate-200 print:text-black">{totalWaterKld.toFixed(0)} KLD</span>
                </div>
                <div className="flex justify-between">
                  <span>Verified Municipal/MIDC Allocation:</span>
                  <span className="text-sky-400 print:text-black">{verifiedWaterKld.toFixed(0)} KLD</span>
                </div>
                <div className="flex justify-between border-t border-eco-border/40 pt-1 font-semibold">
                  <span>Unbacked / At-Risk Water:</span>
                  <span className={waterDeficitKld > 0 ? "text-amber-400" : "text-slate-400"}>
                    {waterDeficitKld.toFixed(0)} KLD ({totalWaterKld > 0 ? Math.round((waterDeficitKld / totalWaterKld) * 100) : 0}%)
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 4. Evidence Integrity & Document Ledger */}
        <div className="space-y-2">
          <div className="flex justify-between items-center border-b border-eco-border pb-1 print:border-black">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300 print:text-black">
              4. Evidence Vault & Document Ledger ({artifacts.length} Artifacts)
            </h2>
            <div className="flex gap-2 text-[11px] font-mono">
              <span className="text-emerald-400 print:text-black">{verifiedCount} Verified</span>
              <span className="text-sky-400 print:text-black">{documentedCount} Documented</span>
              {conflictingCount > 0 && <span className="text-rose-400 font-semibold print:text-red-700">{conflictingCount} Conflicting</span>}
            </div>
          </div>

          {artifacts.length === 0 ? (
            <p className="text-xs text-eco-muted italic">No evidence artifacts uploaded.</p>
          ) : (
            <div className="space-y-1.5">
              {artifacts.map((a) => (
                <div
                  key={a.id}
                  className="p-2 rounded border border-eco-border bg-eco-surface-2/40 flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-1 print:border-gray-300 print:bg-white"
                >
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-eco-primary/10 px-1.5 py-0.5 text-[10px] font-mono text-eco-primary uppercase print:border print:border-black print:text-black">
                      {a.document_type.replace(/_/g, ' ')}
                    </span>
                    <strong className="text-slate-200 print:text-black">{a.filename}</strong>
                    {a.synthetic_demo && (
                      <span className="text-[10px] text-amber-400 border border-amber-500/30 px-1 rounded print:text-black">
                        SYNTHETIC
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-eco-muted font-mono flex items-center gap-3 print:text-gray-600">
                    {a.issuer && <span>Issuer: {a.issuer}</span>}
                    {a.issued_on && <span>Date: {a.issued_on}</span>}
                    <span title={a.sha256}>SHA: {a.sha256.substring(0, 10)}…</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 5. Pre-Investment Approval Checklist */}
        <div className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300 border-b border-eco-border pb-1 print:text-black print:border-black">
            5. Mandatory Statutory Approvals Checklist
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className="p-2 rounded border border-eco-border bg-eco-surface-2/30 flex items-start gap-2 print:border-gray-300">
              <span className="text-slate-500 font-mono">[ ]</span>
              <div>
                <strong className="text-slate-200 block print:text-black">State Environmental Clearance (SEIAA / MoEFCC)</strong>
                <span className="text-[11px] text-eco-muted print:text-gray-600">EIA Notification 2006 for built-up area &gt; 20,000 sq.m</span>
              </div>
            </div>
            <div className="p-2 rounded border border-eco-border bg-eco-surface-2/30 flex items-start gap-2 print:border-gray-300">
              <span className="text-slate-500 font-mono">[ ]</span>
              <div>
                <strong className="text-slate-200 block print:text-black">Consent to Establish (CTE / CTP)</strong>
                <span className="text-[11px] text-eco-muted print:text-gray-600">State Pollution Control Board (DG set emissions & sewage)</span>
              </div>
            </div>
            <div className="p-2 rounded border border-eco-border bg-eco-surface-2/30 flex items-start gap-2 print:border-gray-300">
              <span className="text-slate-500 font-mono">[ ]</span>
              <div>
                <strong className="text-slate-200 block print:text-black">Grid Connectivity Feasibility (STU/DISCOM)</strong>
                <span className="text-[11px] text-eco-muted print:text-gray-600">Dedicated 220kV/110kV feeder allocation and bay availability</span>
              </div>
            </div>
            <div className="p-2 rounded border border-eco-border bg-eco-surface-2/30 flex items-start gap-2 print:border-gray-300">
              <span className="text-slate-500 font-mono">[ ]</span>
              <div>
                <strong className="text-slate-200 block print:text-black">PESO Explosives Licence</strong>
                <span className="text-[11px] text-eco-muted print:text-gray-600">Bulk High-Speed Diesel (HSD) fuel storage for standby generators</span>
              </div>
            </div>
          </div>
        </div>


          {/* 6. Environmental Observations & Geospatial Screening */}
          <div className="space-y-2">
            <div className="flex justify-between items-center border-b border-eco-border pb-1 print:border-black">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300 print:text-black">
                6. Environmental Intelligence & Geospatial Screening ({observations.length} Observations)
              </h2>
              {observations.length > 0 && (
                <span className="text-[11px] font-mono text-emerald-400 print:text-black">
                  Public Geospatial / Reanalysis Grounding
                </span>
              )}
            </div>

            {observations.length === 0 ? (
              <div className="rounded border border-eco-border/60 bg-eco-surface-2/20 p-3 text-xs text-eco-muted print:border-gray-300">
                <p className="font-semibold text-slate-300 print:text-black">No local environmental observations run yet</p>
                <p className="mt-1">
                  Run local environmental analysis (JRC Global Surface Water, Copernicus Sentinel-2 STAC, NASA POWER) from the candidate site view to populate surface water occurrence and climate observations in this Passport.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="overflow-x-auto rounded border border-eco-border print:border-gray-300">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-eco-surface-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-eco-border print:bg-gray-100 print:text-black">
                      <tr>
                        <th className="p-2">Source</th>
                        <th className="p-2">Indicator</th>
                        <th className="p-2 text-right">Value</th>
                        <th className="p-2">Unit</th>
                        <th className="p-2">Status</th>
                        <th className="p-2">Evidence Class</th>
                        <th className="p-2">Period / Observed</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-eco-border/60 print:divide-gray-300">
                      {observations.map((obs) => (
                        <tr key={obs.id} className="text-slate-300 print:text-black">
                          <td className="p-2 font-medium">{obs.source_id}</td>
                          <td className="p-2">{obs.indicator.replace(/_/g, ' ')}</td>
                          <td className="p-2 text-right font-mono font-medium">
                            {obs.value === null ? (
                              <span className="text-eco-muted italic">Unavailable</span>
                            ) : (
                              obs.value.toLocaleString(undefined, { maximumFractionDigits: 3 })
                            )}
                          </td>
                          <td className="p-2 text-eco-muted print:text-gray-600">{obs.unit}</td>
                          <td className="p-2">
                            <span className={obs.status === 'AVAILABLE' ? 'text-emerald-400 font-mono text-[10px]' : 'text-amber-400 font-mono text-[10px]'}>
                              {obs.status}
                            </span>
                          </td>
                          <td className="p-2 font-mono text-[10px] text-eco-muted print:text-gray-600">{obs.evidence_class}</td>
                          <td className="p-2 text-eco-muted font-mono text-[10px] print:text-gray-600">
                            {obs.period_start || obs.observed_at || (obs.retrieved_at ? obs.retrieved_at.split('T')[0] : '—')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-[10px] text-eco-muted italic print:text-gray-600">
                  Environmental observations provide preliminary screening data only. They do not constitute official Survey of India boundary certificates, statutory EIA clearances, or verified on-site geotechnical bore logs.
                </p>
              </div>
            )}
          </div>

        {/* Footer */}
        <div className="border-t border-eco-border pt-4 text-[10px] text-eco-muted flex flex-col sm:flex-row justify-between items-center gap-2 print:border-black print:text-gray-600">
          <p>EcoSite India Platform · One Earth Hackathon 2026 · Evaluated by Antigravity OS</p>
          <p className="font-mono">Passport Digest: {site.id.substring(0, 8)}-{project.id.substring(0, 8)}</p>
        </div>
      </div>
    </div>
  );
}
