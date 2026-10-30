import type { EnvironmentalStateSummaryResponse, MetricAvailability } from '../../types/environmentalMonitoring';
import { DashboardPanel, PanelState, type PanelLoadState } from './panelPrimitives';
import { formatTimestamp } from './formatTimestamp';

const statusClass: Record<MetricAvailability, string> = {
  AVAILABLE: 'text-eco-primary', PARTIAL: 'text-eco-warning', STALE: 'text-eco-warning',
  SOURCE_UNAVAILABLE: 'text-eco-critical', NOT_COVERED: 'text-eco-muted', UNKNOWN: 'text-eco-muted',
};

export function EnvironmentalCoveragePanel({ states, isLoading, error, warning }: PanelLoadState & {
  states?: EnvironmentalStateSummaryResponse[] | null;
  warning?: string | null;
}) {
  return (
    <DashboardPanel title="Environmental coverage" eyebrow="Nearby public observations">
      {isLoading ? <PanelState kind="loading" /> : error ? <PanelState kind="error" message={error} /> : !states?.length ? <PanelState kind="not-covered" /> : (
        <div className="space-y-4">
          {warning && <p role="status" className="rounded-md border border-eco-warning/40 bg-eco-warning/10 px-3 py-2 text-xs text-eco-warning">{warning}</p>}
          {states.map((state) => (
          <article key={state.stateCode} className="rounded-md border border-eco-border p-3">
            <div className="flex items-baseline justify-between gap-2"><h3 className="font-mono text-xs font-semibold">{state.stateCode}</h3><span className="text-xs text-eco-muted">{state.coveredFacilityCount}/{state.facilityCount} facilities covered</span></div>
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">{state.metrics.map((metric) => <li key={metric.metric} className="flex justify-between gap-3 text-xs"><span>{metric.displayName}</span><span className={`font-mono ${statusClass[metric.availability]}`}>{metric.availability}</span></li>)}</ul>
            <p className="mt-2 text-micro text-eco-muted">Generated {formatTimestamp(state.generatedAt)} · {state.range}</p>
          </article>
          ))}
        </div>
      )}
      <p className="mt-3 text-xs text-eco-muted">Context comes from eligible public stations; it is not on-site facility telemetry.</p>
    </DashboardPanel>
  );
}
