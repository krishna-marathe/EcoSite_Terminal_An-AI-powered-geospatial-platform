import type { EnvironmentalStateSummaryResponse, MetricAvailability } from '../../types/environmentalMonitoring';
import { DashboardPanel, PanelState, type PanelLoadState } from './panelPrimitives';

const statusClass: Record<MetricAvailability, string> = {
  AVAILABLE: 'text-eco-primary', PARTIAL: 'text-eco-warning', STALE: 'text-eco-warning',
  SOURCE_UNAVAILABLE: 'text-eco-critical', NOT_COVERED: 'text-eco-muted', UNKNOWN: 'text-eco-muted',
};

/**
 * Coverage summary.
 *
 * This used to render 4 state cards × 14 metric rows = 56 rows, every one of them
 * `NOT_COVERED`, which is one sentence of information occupying about a thousand
 * pixels. It now leads with the totals and keeps the per-metric detail behind a
 * disclosure for the reader who needs it.
 */
export function EnvironmentalCoveragePanel({ states, isLoading, error, warning }: PanelLoadState & {
  states?: EnvironmentalStateSummaryResponse[] | null;
  warning?: string | null;
}) {
  const covered = states?.reduce((sum, state) => sum + state.coveredFacilityCount, 0) ?? 0;
  const total = states?.reduce((sum, state) => sum + state.facilityCount, 0) ?? 0;
  const metrics = states?.[0]?.metrics ?? [];

  return (
    <DashboardPanel title="Environmental coverage" eyebrow="Nearby public observations">
      {isLoading ? <PanelState kind="loading" /> : error ? <PanelState kind="error" message={error} /> : !states?.length ? <PanelState kind="not-covered" /> : (
        <div className="space-y-3">
          <p className="text-body text-eco-text">
            <span className="font-mono text-h2 text-eco-text">{covered}</span>
            <span className="text-eco-muted"> of {total} facilities have a linked public monitoring station.</span>
          </p>

          {warning && <p role="status" className="text-meta text-eco-warning">{warning}</p>}

          <p className="text-meta text-eco-muted">
            Coverage by state:{' '}
            {states.map((state, index) => (
              <span key={state.stateCode} className="whitespace-nowrap">
                {index > 0 ? ' · ' : ''}
                <span className="font-mono text-eco-text">{state.stateCode}</span>{' '}
                {state.coveredFacilityCount}/{state.facilityCount}
              </span>
            ))}
          </p>

          {metrics.length > 0 && (
            <details className="rounded border border-eco-border bg-eco-surface-secondary/40 p-2">
              <summary className="cursor-pointer text-meta text-eco-primary">
                Which metrics, and what is missing?
              </summary>
              <ul className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-2">
                {metrics.map((metric) => (
                  <li key={metric.metric} className="flex justify-between gap-3 text-meta">
                    <span className="text-eco-text">{metric.displayName}</span>
                    <span className={`font-mono text-micro ${statusClass[metric.availability]}`}>
                      {metric.availability.replaceAll('_', ' ')}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
      <p className="mt-3 text-meta text-eco-muted">
        Context comes from eligible public stations; it is not on-site facility telemetry.
      </p>
    </DashboardPanel>
  );
}
