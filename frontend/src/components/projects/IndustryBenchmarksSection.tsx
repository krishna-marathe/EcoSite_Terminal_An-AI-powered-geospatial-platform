import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  getBenchmarks,
  metricDisplayLabel,
  formatBenchmarkValue,
  type IndustryBenchmark,
} from '../../services/benchmarks';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';

export function IndustryBenchmarksSection() {
  const [selectedOperator, setSelectedOperator] = useState<string>('all');
  const [selectedMetric, setSelectedMetric] = useState<string>('all');

  const { data, isPending, error } = useQuery({
    queryKey: ['industry-benchmarks', selectedOperator, selectedMetric],
    queryFn: ({ signal }) =>
      getBenchmarks(
        {
          operator: selectedOperator === 'all' ? undefined : selectedOperator,
          metric: selectedMetric === 'all' ? undefined : selectedMetric,
        },
        signal
      ),
    staleTime: 60000,
  });

  const allItems = data?.items || [];

  return (
    <Card
      title="Industry Sustainability & Efficiency Benchmarks"
      subtitle="Contextual reference from official sustainability reports and audited ESG disclosures"
      status={data ? `${data.total} operator benchmarks` : undefined}
    >
      <div className="space-y-4">
        {/* Prominent Epistemic Caution */}
        <div className="rounded border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
          <p className="font-semibold uppercase tracking-wider text-[11px] text-amber-400">
            ⚠️ Contextual Reference Only — Not Proof of Site Headroom
          </p>
          <p className="mt-1 leading-relaxed">
            Industry benchmarks represent historical operator publications, fleet-wide portfolio averages, and engineered campus specifications.
            They <strong>must never</strong> be substituted for verified local utility capacity sanctions, DISCOM feeder commitments, or statutory water allocations for candidate parcels.
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <label className="flex items-center gap-1.5 text-eco-muted">
            <span>Operator:</span>
            <select
              aria-label="Filter by operator"
              value={selectedOperator}
              onChange={(e) => setSelectedOperator(e.target.value)}
              className="rounded-sm border border-eco-border bg-eco-surface px-2 py-1 text-eco-text text-xs"
            >
              <option value="all">All Operators</option>
              <option value="Nxtra">Nxtra by Airtel</option>
              <option value="STT GDC">STT GDC India</option>
              <option value="CtrlS">CtrlS Datacenters</option>
              <option value="Google">Google</option>
              <option value="Microsoft">Microsoft</option>
              <option value="AWS">Amazon Web Services (AWS)</option>
            </select>
          </label>

          <label className="flex items-center gap-1.5 text-eco-muted">
            <span>Metric:</span>
            <select
              aria-label="Filter by metric"
              value={selectedMetric}
              onChange={(e) => setSelectedMetric(e.target.value)}
              className="rounded-sm border border-eco-border bg-eco-surface px-2 py-1 text-eco-text text-xs"
            >
              <option value="all">All Metrics</option>
              <option value="measured_operating_pue">Measured Operating PUE</option>
              <option value="design_pue">Engineered Design PUE</option>
              <option value="datacenter_renewable_share_percent">DC Renewable Share (%)</option>
              <option value="company_wide_renewable_matching_percent">Company-Wide RE Matching (%)</option>
              <option value="wue_liters_per_kwh">Water Usage Effectiveness (WUE)</option>
            </select>
          </label>

          <div className="ml-auto flex items-center gap-2 text-[11px] text-eco-muted">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-400 inline-block" /> Published
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-rose-400 inline-block" /> Unavailable (Not fabricated)
            </span>
          </div>
        </div>

        {/* Loading and Error States */}
        {isPending && (
          <p className="text-xs text-eco-muted py-4 animate-pulse">Loading published industry benchmarks…</p>
        )}

        {error && (
          <div className="rounded border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300" role="alert">
            <p className="font-semibold">Unable to load industry benchmarks</p>
            <p className="mt-0.5">{error instanceof Error ? error.message : 'Unknown error'}</p>
          </div>
        )}

        {/* Table of Benchmarks */}
        {allItems.length > 0 && (
          <div className="overflow-x-auto rounded border border-eco-border">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-eco-surface-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-eco-border">
                <tr>
                  <th className="p-2.5">Operator & Year</th>
                  <th className="p-2.5">Metric</th>
                  <th className="p-2.5 text-right">Value</th>
                  <th className="p-2.5">Accounting Classification</th>
                  <th className="p-2.5">Reporting Scope & Boundary</th>
                  <th className="p-2.5">Official Publication & Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-eco-border/60">
                {allItems.map((item: IndustryBenchmark) => {
                  const isUnavailable = item.status === 'UNAVAILABLE' || item.value === null;

                  return (
                    <tr key={item.id} className="hover:bg-eco-surface-2/40">
                      <td className="p-2.5">
                        <strong className="text-slate-100 block">{item.operator}</strong>
                        <span className="text-[10px] text-eco-muted font-mono">{item.reporting_year}</span>
                      </td>

                      <td className="p-2.5">
                        <span className="font-medium text-slate-200 block">
                          {metricDisplayLabel(item.metric)}
                        </span>
                        <span className="text-[10px] text-eco-muted font-mono">{item.metric}</span>
                      </td>

                      <td className="p-2.5 text-right font-mono">
                        {isUnavailable ? (
                          <Badge variant="outline" size="xs">
                            UNAVAILABLE
                          </Badge>
                        ) : (
                          <span className="text-sm font-bold text-slate-100">
                            {formatBenchmarkValue(item)}
                          </span>
                        )}
                      </td>

                      <td className="p-2.5">
                        {item.metric === 'design_pue' ? (
                          <span className="rounded bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-mono font-medium text-sky-400 border border-sky-500/30">
                            ENGINEERED DESIGN SPEC
                          </span>
                        ) : item.metric === 'company_wide_renewable_matching_percent' ? (
                          <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-mono font-medium text-amber-400 border border-amber-500/30">
                            COMPANY-WIDE MATCHING
                          </span>
                        ) : item.metric === 'datacenter_renewable_share_percent' ? (
                          <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-mono font-medium text-emerald-400 border border-emerald-500/30">
                            DC-SPECIFIC CONSUMPTION
                          </span>
                        ) : item.is_portfolio_average ? (
                          <span className="rounded bg-slate-500/10 px-1.5 py-0.5 text-[10px] font-mono font-medium text-slate-300 border border-slate-500/30">
                            PORTFOLIO FLEET AVERAGE
                          </span>
                        ) : (
                          <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-mono font-medium text-emerald-400 border border-emerald-500/30">
                            OPERATIONAL MEASURED
                          </span>
                        )}
                      </td>

                      <td className="p-2.5 max-w-xs">
                        <p className="text-[11px] font-medium text-slate-200">{item.reporting_scope}</p>
                        <p className="text-[10px] text-eco-muted mt-0.5 line-clamp-2" title={item.boundary_notes}>
                          {item.boundary_notes}
                        </p>
                      </td>

                      <td className="p-2.5 max-w-xs">
                        <p className="text-[11px] text-slate-200 font-medium truncate" title={item.document_title}>
                          {item.document_title}
                        </p>
                        {item.page_or_reference && (
                          <p className="text-[10px] text-eco-muted font-mono truncate" title={item.page_or_reference}>
                            {item.page_or_reference}
                          </p>
                        )}
                        {item.source_url && (
                          <a
                            href={item.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-eco-primary hover:underline block mt-0.5 truncate font-mono"
                          >
                            ↗ Source Verification Link
                          </a>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {allItems.length === 0 && !isPending && !error && (
          <p className="text-xs text-eco-muted italic py-3 text-center">
            No published benchmarks matched the selected filter criteria.
          </p>
        )}
      </div>
    </Card>
  );
}

