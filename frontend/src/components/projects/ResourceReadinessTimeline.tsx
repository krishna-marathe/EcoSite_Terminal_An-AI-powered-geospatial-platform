import React from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import type { ProjectPhase } from '../../services/phases';
import type { Assertion } from '../../types/evidence';
import type { ProjectReadinessReport, ReadinessStatus } from '../../types/readiness';
import { Card } from '../ui/Card';

interface ResourceReadinessTimelineProps {
  phases?: ProjectPhase[];
  assertions?: Assertion[];
  readinessReport?: ProjectReadinessReport | null;
  loading?: boolean;
  error?: string | null;
}

function renderStatusBadge(status?: ReadinessStatus) {
  if (!status) return null;
  switch (status) {
    case 'MET':
      return (
        <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-400 border border-emerald-500/30">
          MET
        </span>
      );
    case 'PARTIAL':
      return (
        <span className="rounded bg-amber-500/10 px-2 py-0.5 text-[10px] font-mono font-bold text-amber-400 border border-amber-500/30">
          PARTIAL
        </span>
      );
    case 'UNCOMMITTED':
      return (
        <span className="rounded bg-rose-500/10 px-2 py-0.5 text-[10px] font-mono font-bold text-rose-400 border border-rose-500/30">
          UNCOMMITTED
        </span>
      );
    case 'UNKNOWN':
      return (
        <span className="rounded bg-slate-500/10 px-2 py-0.5 text-[10px] font-mono font-bold text-slate-400 border border-slate-500/30">
          UNKNOWN
        </span>
      );
    case 'INSUFFICIENT_DATA':
      return (
        <span className="rounded bg-purple-500/10 px-2 py-0.5 text-[10px] font-mono font-bold text-purple-400 border border-purple-500/30">
          INSUFFICIENT DATA
        </span>
      );
    default:
      return (
        <span className="rounded bg-slate-700 px-2 py-0.5 text-[10px] font-mono font-bold text-slate-300">
          {status}
        </span>
      );
  }
}

export function ResourceReadinessTimeline({
  phases = [],
  assertions = [],
  readinessReport,
  loading = false,
  error = null,
}: ResourceReadinessTimelineProps) {
  if (loading) {
    return (
      <Card title="Resource Readiness & Capacity Gap Timeline">
        <p className="text-xs text-eco-muted py-4 animate-pulse">
          Calculating evidence-backed resource readiness curves…
        </p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card title="Resource Readiness & Capacity Gap Timeline">
        <div className="rounded border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300" role="alert">
          <p className="font-semibold">Unable to load resource readiness report</p>
          <p className="mt-1">{error}</p>
        </div>
      </Card>
    );
  }

  // If backend report is available, use genuine backend readiness calculations
  if (readinessReport) {
    const reportPhases = [...readinessReport.phases].sort((a, b) => a.phase_sequence - b.phase_sequence);

    if (reportPhases.length === 0) {
      return (
        <Card title="Resource Readiness & Capacity Gap Timeline">
          <p className="text-xs text-eco-muted py-2">
            No development phases defined. Add phases in the Development Phases editor to view capacity readiness curves.
          </p>
        </Card>
      );
    }

    const timelineData = reportPhases.map((phase) => {
      const demandMW = phase.power.demand_mw ?? 0;
      const deliverableMW = phase.power.qualifying_firm_capacity_mw;
      const deficitMW = phase.power.power_gap_mw ?? 0;
      const documentedMW = phase.power.documented_capacity_mw;
      const proposedMW = phase.power.proposed_capacity_mw;

      const demandWaterKLD = phase.water.peak_summer_demand_kld ?? 0;
      const deliverableWaterKLD = phase.water.qualifying_firm_allocated_kld;
      const deficitWaterKLD = phase.water.water_gap_kld ?? 0;
      const documentedWaterKLD = phase.water.documented_allocated_kld;
      const proposedWaterKLD = phase.water.proposed_kld;

      // PUE calculation & check
      const itLoadMW = phase.power.incremental_demand_mw ?? demandMW;
      const impliedPUE = itLoadMW > 0 ? Number((demandMW / itLoadMW).toFixed(2)) : 1.0;
      const pueDiscrepancy = Math.abs(impliedPUE - phase.design_pue) >= 0.05;

      return {
        phaseName: `P${phase.phase_sequence}: ${phase.phase_name}`,
        date: phase.commissioning_date,
        itLoadMW,
        facilityPeakMW: demandMW,
        deliverableMW,
        deficitMW,
        documentedMW,
        proposedMW,
        powerStatus: phase.power.status,
        peakSummerWaterKLD: demandWaterKLD,
        deliverableWaterKLD,
        deficitWaterKLD,
        documentedWaterKLD,
        proposedWaterKLD,
        waterStatus: phase.water.status,
        designPUE: phase.design_pue,
        impliedPUE,
        pueDiscrepancy,
      };
    });

    const campus = readinessReport.campus_summary;
    const fullBuildoutGapMW = campus.overall_power_gap_mw ?? 0;
    const fullBuildoutWaterGapKLD = campus.overall_water_gap_kld ?? 0;
    const maxVerifiedPowerMW = campus.total_qualifying_firm_power_mw;
    const maxVerifiedWaterKLD = campus.total_qualifying_firm_water_kld;

    return (
      <Card title="Resource Readiness & Capacity Gap Timeline">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-eco-border pb-3 mb-4">
          <div>
            <p className="text-xs text-eco-muted">
              Evaluates cumulative phase requirements against verified utility sanctions and water allocations. Unsupported capacity represents pre-investment risk.
            </p>
            <p className="text-[11px] text-amber-400/90 mt-1 font-mono">
              ⚠️ Note: Capacity gaps reflect evidenced commitment status, not confirmed physical utility deficits.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center gap-2 rounded bg-eco-surface-2 px-2.5 py-1 border border-eco-border">
              <span className="text-eco-muted">Full Buildout Power Deficit: </span>
              <span className={fullBuildoutGapMW > 0 ? 'font-mono font-bold text-rose-400' : 'font-mono font-bold text-emerald-400'}>
                {fullBuildoutGapMW > 0 ? `+${fullBuildoutGapMW} MW Unbacked` : 'Fully Covered'}
              </span>
              {renderStatusBadge(campus.overall_power_status)}
            </div>
            <div className="flex items-center gap-2 rounded bg-eco-surface-2 px-2.5 py-1 border border-eco-border">
              <span className="text-eco-muted">Summer Water Gap: </span>
              <span className={fullBuildoutWaterGapKLD > 0 ? 'font-mono font-bold text-amber-400' : 'font-mono font-bold text-emerald-400'}>
                {fullBuildoutWaterGapKLD > 0 ? `+${fullBuildoutWaterGapKLD} KLD Unbacked` : 'Fully Covered'}
              </span>
              {renderStatusBadge(campus.overall_water_status)}
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Power Readiness Chart */}
          <div className="rounded border border-eco-border bg-eco-surface p-3">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-slate-200">
                ⚡ Electrical Power Ramp vs Deliverable Capacity (MW)
              </h4>
              <span className="text-[11px] font-mono text-emerald-400">
                Qualifying Firm Ceiling: {maxVerifiedPowerMW} MW
              </span>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={timelineData} margin={{ top: 10, right: 15, left: -15, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                  <XAxis dataKey="phaseName" tick={{ fill: '#94A3B8', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#94A3B8', fontSize: 11 }} unit=" MW" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', fontSize: 12, borderRadius: 6 }}
                    itemStyle={{ padding: 2 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                  <Bar dataKey="deliverableMW" name="Verified Deliverable MW" stackId="a" fill="#10B981" />
                  <Bar dataKey="documentedMW" name="Documented (Unverified) MW" stackId="a" fill="#64748B" />
                  <Bar dataKey="deficitMW" name="Unsupported Deficit MW" stackId="a" fill="#EF4444" />
                  <Line type="monotone" dataKey="facilityPeakMW" name="Required Facility Peak MW" stroke="#38BDF8" strokeWidth={2} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="itLoadMW" name="IT Load MW" stroke="#A78BFA" strokeWidth={2} strokeDasharray="4 4" />
                  <ReferenceLine y={maxVerifiedPowerMW} stroke="#10B981" strokeDasharray="3 3" label={{ value: 'Sanction Cap', fill: '#10B981', fontSize: 10 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[11px] text-eco-muted mt-2">
              Red bars highlight load commitments that exceed verified utility sanctions. Proximity to substations does not substitute for sanctioned delivery.
            </p>
          </div>

          {/* Water Readiness Chart */}
          <div className="rounded border border-eco-border bg-eco-surface p-3">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-slate-200">
                💧 Summer Water Consumption vs Allocation (KLD)
              </h4>
              <span className="text-[11px] font-mono text-sky-400">
                Qualifying Firm Ceiling: {maxVerifiedWaterKLD} KLD
              </span>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={timelineData} margin={{ top: 10, right: 15, left: -10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                  <XAxis dataKey="phaseName" tick={{ fill: '#94A3B8', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#94A3B8', fontSize: 11 }} unit=" KLD" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', fontSize: 12, borderRadius: 6 }}
                    itemStyle={{ padding: 2 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                  <Bar dataKey="deliverableWaterKLD" name="Verified Supply KLD" stackId="w" fill="#0EA5E9" />
                  <Bar dataKey="documentedWaterKLD" name="Documented (Unverified) KLD" stackId="w" fill="#64748B" />
                  <Bar dataKey="deficitWaterKLD" name="Unallocated Summer Gap" stackId="w" fill="#F59E0B" />
                  <Line type="monotone" dataKey="peakSummerWaterKLD" name="Peak Summer Demand KLD" stroke="#FCD34D" strokeWidth={2} dot={{ r: 4 }} />
                  <ReferenceLine y={maxVerifiedWaterKLD} stroke="#0EA5E9" strokeDasharray="3 3" label={{ value: 'Water Cap', fill: '#0EA5E9', fontSize: 10 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[11px] text-eco-muted mt-2">
              Amber bars indicate peak-summer evaporative cooling deficits. Internal recycling commitments must be supported by water balance engineering studies.
            </p>
          </div>
        </div>

        {/* Phase Consistency & Backend Readiness Status Table */}
        <div className="mt-4 rounded border border-eco-border bg-eco-surface-2/40 p-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
            Phase Readiness & Verification Status Table
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="text-[11px] text-slate-400 border-b border-eco-border uppercase">
                <tr>
                  <th className="py-1.5 px-2">Phase</th>
                  <th className="py-1.5 px-2">Date</th>
                  <th className="py-1.5 px-2">Design PUE</th>
                  <th className="py-1.5 px-2">Implied PUE</th>
                  <th className="py-1.5 px-2">Consistency</th>
                  <th className="py-1.5 px-2">Power Status</th>
                  <th className="py-1.5 px-2">Water Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-eco-border/50 font-mono text-[11px]">
                {timelineData.map((pt, idx) => (
                  <tr key={idx} className="hover:bg-eco-surface-2/60">
                    <td className="py-1.5 px-2 text-slate-200 font-sans">{pt.phaseName}</td>
                    <td className="py-1.5 px-2">{pt.date}</td>
                    <td className="py-1.5 px-2">{pt.designPUE.toFixed(2)}</td>
                    <td className="py-1.5 px-2">{pt.impliedPUE.toFixed(2)}</td>
                    <td className="py-1.5 px-2 font-sans">
                      {pt.pueDiscrepancy ? (
                        <span className="text-amber-400 flex items-center gap-1">
                          ⚠️ Discrepancy ({pt.designPUE} vs {pt.impliedPUE})
                        </span>
                      ) : (
                        <span className="text-emerald-400">✓ Consistent</span>
                      )}
                    </td>
                    <td className="py-1.5 px-2 font-sans">
                      <div className="flex items-center gap-2">
                        {renderStatusBadge(pt.powerStatus)}
                        {pt.deficitMW > 0 ? (
                          <span className="text-rose-400 font-bold">Deficit: -{pt.deficitMW} MW</span>
                        ) : (
                          <span className="text-emerald-400">Supported</span>
                        )}
                      </div>
                    </td>
                    <td className="py-1.5 px-2 font-sans">
                      <div className="flex items-center gap-2">
                        {renderStatusBadge(pt.waterStatus)}
                        {pt.deficitWaterKLD > 0 ? (
                          <span className="text-amber-400 font-bold">Deficit: -{pt.deficitWaterKLD} KLD</span>
                        ) : (
                          <span className="text-emerald-400">Supported</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Backend Findings Ledger */}
        {readinessReport.all_findings.length > 0 && (
          <div className="mt-4 rounded border border-eco-border bg-eco-surface-2/30 p-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2 flex items-center justify-between">
              <span>Readiness Findings & Epistemic Gaps ({readinessReport.all_findings.length})</span>
              <span className="text-[10px] text-eco-muted font-mono font-normal">
                {campus.critical_findings_count} Critical · {campus.warning_findings_count} Warning
              </span>
            </h4>
            <div className="space-y-1.5 text-xs">
              {readinessReport.all_findings.map((finding, idx) => (
                <div
                  key={idx}
                  className="p-2 rounded border border-eco-border/60 bg-eco-surface flex items-start gap-2"
                >
                  <span
                    className={
                      finding.severity === 'CRITICAL'
                        ? 'rounded bg-rose-500/20 text-rose-400 font-mono text-[10px] px-1.5 py-0.5 border border-rose-500/40 uppercase'
                        : finding.severity === 'WARNING'
                        ? 'rounded bg-amber-500/20 text-amber-400 font-mono text-[10px] px-1.5 py-0.5 border border-amber-500/40 uppercase'
                        : 'rounded bg-sky-500/20 text-sky-400 font-mono text-[10px] px-1.5 py-0.5 border border-sky-500/40 uppercase'
                    }
                  >
                    {finding.severity}
                  </span>
                  <div className="flex-1">
                    <p className="text-slate-200">{finding.message}</p>
                    <span className="text-[10px] text-eco-muted font-mono">{finding.domain} · {finding.code}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
    );
  }

  // Fallback to legacy/offline calculations when no backend report is passed
  const activePhases = phases
    .filter((p) => p.status === 'active')
    .sort((a, b) => a.sequence - b.sequence);

  if (activePhases.length === 0) {
    return (
      <Card title="Resource Readiness & Capacity Gap Timeline">
        <p className="text-xs text-eco-muted py-2">
          No development phases defined. Add phases in the Development Phases editor to view capacity readiness curves.
        </p>
      </Card>
    );
  }

  // Derive evidenced power commitments
  const verifiedPowerAssertions = assertions.filter(
    (a) => a.field_key === 'sanctioned_grid_mw' && a.status === 'VERIFIED_WITHIN_SCOPE'
  );
  const maxVerifiedPowerMW = verifiedPowerAssertions.reduce((acc, curr) => {
    const val = typeof curr.value === 'number' ? curr.value : parseFloat(String(curr.value)) || 0;
    return Math.max(acc, val);
  }, 0);

  // Evidenced water allocation
  const verifiedWaterAssertions = assertions.filter(
    (a) => a.field_key === 'water_allocation_kld' && a.status === 'VERIFIED_WITHIN_SCOPE'
  );
  const maxVerifiedWaterKLD = verifiedWaterAssertions.reduce((acc, curr) => {
    const val = typeof curr.value === 'number' ? curr.value : parseFloat(String(curr.value)) || 0;
    return Math.max(acc, val);
  }, 0);

  // Build timeline datapoints
  const timelineData = activePhases.map((phase) => {
    const requiredMW = phase.cumulative_facility_peak_mw;
    const deliverableMW = Math.min(requiredMW, maxVerifiedPowerMW);
    const deficitMW = Math.max(0, requiredMW - maxVerifiedPowerMW);

    const requiredWaterKLD = phase.peak_summer_water_kld;
    const deliverableWaterKLD = Math.min(requiredWaterKLD, maxVerifiedWaterKLD);
    const deficitWaterKLD = Math.max(0, requiredWaterKLD - maxVerifiedWaterKLD);

    const impliedPUE = phase.cumulative_it_mw > 0
      ? Number((phase.cumulative_facility_peak_mw / phase.cumulative_it_mw).toFixed(2))
      : 1.0;
    const pueDiscrepancy = Math.abs(impliedPUE - phase.design_pue) >= 0.05;

    return {
      phaseName: `P${phase.sequence}: ${phase.name}`,
      date: phase.commissioning_date,
      itLoadMW: phase.cumulative_it_mw,
      facilityPeakMW: requiredMW,
      deliverableMW,
      deficitMW,
      peakSummerWaterKLD: requiredWaterKLD,
      deliverableWaterKLD,
      deficitWaterKLD,
      designPUE: phase.design_pue,
      impliedPUE,
      pueDiscrepancy,
    };
  });

  const latestPhase = timelineData[timelineData.length - 1];
  const fullBuildoutGapMW = latestPhase ? latestPhase.deficitMW : 0;
  const fullBuildoutWaterGapKLD = latestPhase ? latestPhase.deficitWaterKLD : 0;

  return (
    <Card title="Resource Readiness & Capacity Gap Timeline">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-eco-border pb-3 mb-4">
        <div>
          <p className="text-xs text-eco-muted">
            Evaluates cumulative phase requirements against verified utility sanctions and water allocations. Unsupported capacity represents pre-investment risk.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <div className="rounded bg-eco-surface-2 px-2.5 py-1 border border-eco-border">
            <span className="text-eco-muted">Full Buildout Power Deficit: </span>
            <span className={fullBuildoutGapMW > 0 ? 'font-mono font-bold text-rose-400' : 'font-mono font-bold text-emerald-400'}>
              {fullBuildoutGapMW > 0 ? `+${fullBuildoutGapMW} MW Unbacked` : 'Fully Covered'}
            </span>
          </div>
          <div className="rounded bg-eco-surface-2 px-2.5 py-1 border border-eco-border">
            <span className="text-eco-muted">Summer Water Gap: </span>
            <span className={fullBuildoutWaterGapKLD > 0 ? 'font-mono font-bold text-amber-400' : 'font-mono font-bold text-emerald-400'}>
              {fullBuildoutWaterGapKLD > 0 ? `+${fullBuildoutWaterGapKLD} KLD Unbacked` : 'Fully Covered'}
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Power Readiness Chart */}
        <div className="rounded border border-eco-border bg-eco-surface p-3">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold text-slate-200">
              ⚡ Electrical Power Ramp vs Deliverable Capacity (MW)
            </h4>
            <span className="text-[11px] font-mono text-emerald-400">
              Sanctioned Ceiling: {maxVerifiedPowerMW} MW
            </span>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={timelineData} margin={{ top: 10, right: 15, left: -15, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                <XAxis dataKey="phaseName" tick={{ fill: '#94A3B8', fontSize: 11 }} />
                <YAxis tick={{ fill: '#94A3B8', fontSize: 11 }} unit=" MW" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', fontSize: 12, borderRadius: 6 }}
                  itemStyle={{ padding: 2 }}
                />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                <Bar dataKey="deliverableMW" name="Verified Deliverable MW" stackId="a" fill="#10B981" />
                <Bar dataKey="deficitMW" name="Unsupported Deficit MW" stackId="a" fill="#EF4444" />
                <Line type="monotone" dataKey="facilityPeakMW" name="Required Facility Peak MW" stroke="#38BDF8" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="itLoadMW" name="IT Load MW" stroke="#A78BFA" strokeWidth={2} strokeDasharray="4 4" />
                <ReferenceLine y={maxVerifiedPowerMW} stroke="#10B981" strokeDasharray="3 3" label={{ value: 'Sanction Cap', fill: '#10B981', fontSize: 10 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[11px] text-eco-muted mt-2">
            Red bars highlight load commitments that exceed verified utility sanctions. Proximity to substations does not substitute for sanctioned delivery.
          </p>
        </div>

        {/* Water Readiness Chart */}
        <div className="rounded border border-eco-border bg-eco-surface p-3">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold text-slate-200">
              💧 Summer Water Consumption vs Allocation (KLD)
            </h4>
            <span className="text-[11px] font-mono text-sky-400">
              Allocated Ceiling: {maxVerifiedWaterKLD} KLD
            </span>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={timelineData} margin={{ top: 10, right: 15, left: -10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                <XAxis dataKey="phaseName" tick={{ fill: '#94A3B8', fontSize: 11 }} />
                <YAxis tick={{ fill: '#94A3B8', fontSize: 11 }} unit=" KLD" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', fontSize: 12, borderRadius: 6 }}
                  itemStyle={{ padding: 2 }}
                />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                <Bar dataKey="deliverableWaterKLD" name="Verified Supply KLD" stackId="w" fill="#0EA5E9" />
                <Bar dataKey="deficitWaterKLD" name="Unallocated Summer Gap" stackId="w" fill="#F59E0B" />
                <Line type="monotone" dataKey="peakSummerWaterKLD" name="Peak Summer Demand KLD" stroke="#FCD34D" strokeWidth={2} dot={{ r: 4 }} />
                <ReferenceLine y={maxVerifiedWaterKLD} stroke="#0EA5E9" strokeDasharray="3 3" label={{ value: 'Water Cap', fill: '#0EA5E9', fontSize: 10 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[11px] text-eco-muted mt-2">
            Amber bars indicate peak-summer evaporative cooling deficits. Internal recycling commitments must be supported by water balance engineering studies.
          </p>
        </div>
      </div>

      {/* Engineering Discrepancy & PUE Analysis Table */}
      <div className="mt-4 rounded border border-eco-border bg-eco-surface-2/40 p-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
          Engineering Discrepancy & Consistency Checks
        </h4>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="text-[11px] text-slate-400 border-b border-eco-border uppercase">
              <tr>
                <th className="py-1.5 px-2">Phase</th>
                <th className="py-1.5 px-2">Date</th>
                <th className="py-1.5 px-2">Design PUE</th>
                <th className="py-1.5 px-2">Implied PUE (Facility/IT)</th>
                <th className="py-1.5 px-2">Consistency Status</th>
                <th className="py-1.5 px-2">Power Status</th>
                <th className="py-1.5 px-2">Water Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-eco-border/50 font-mono text-[11px]">
              {timelineData.map((pt, idx) => (
                <tr key={idx} className="hover:bg-eco-surface-2/60">
                  <td className="py-1.5 px-2 text-slate-200 font-sans">{pt.phaseName}</td>
                  <td className="py-1.5 px-2">{pt.date}</td>
                  <td className="py-1.5 px-2">{pt.designPUE.toFixed(2)}</td>
                  <td className="py-1.5 px-2">{pt.impliedPUE.toFixed(2)}</td>
                  <td className="py-1.5 px-2 font-sans">
                    {pt.pueDiscrepancy ? (
                      <span className="text-amber-400 flex items-center gap-1">
                        ⚠️ Discrepancy ({pt.designPUE} vs {pt.impliedPUE})
                      </span>
                    ) : (
                      <span className="text-emerald-400">✓ Consistent</span>
                    )}
                  </td>
                  <td className="py-1.5 px-2 font-sans">
                    {pt.deficitMW > 0 ? (
                      <span className="text-rose-400 font-bold">Deficit: -{pt.deficitMW} MW</span>
                    ) : (
                      <span className="text-emerald-400">Supported</span>
                    )}
                  </td>
                  <td className="py-1.5 px-2 font-sans">
                    {pt.deficitWaterKLD > 0 ? (
                      <span className="text-amber-400 font-bold">Deficit: -{pt.deficitWaterKLD} KLD</span>
                    ) : (
                      <span className="text-emerald-400">Supported</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
}
