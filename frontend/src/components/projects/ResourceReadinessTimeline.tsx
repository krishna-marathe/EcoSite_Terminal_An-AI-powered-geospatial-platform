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
import { Card } from '../ui/Card';

interface ResourceReadinessTimelineProps {
  phases: ProjectPhase[];
  assertions: Assertion[];
}

export function ResourceReadinessTimeline({ phases, assertions }: ResourceReadinessTimelineProps) {
  // Sort active phases in sequence order
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
  // A verified sanction for Phase 1 covers up to that MW. We compute the verified deliverable capacity.
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

    // Implied PUE calculation and warning
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
