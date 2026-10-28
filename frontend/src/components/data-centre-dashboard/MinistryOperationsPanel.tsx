import type { MinistryOverview } from '../../types/ministryOperations';
import { DashboardPanel, PanelState, type PanelLoadState } from './panelPrimitives';
import { formatTimestamp } from './formatTimestamp';

export function MinistryOperationsPanel({ overview, isLoading, error }: PanelLoadState & { overview?: MinistryOverview | null }) {
  return (
    <DashboardPanel title="Action queue and source health" eyebrow="Ministry operations">
      {isLoading ? <PanelState kind="loading" /> : error ? <PanelState kind="error" message={error} /> : !overview ? <PanelState kind="empty" /> : (
        <div className="grid gap-5 lg:grid-cols-2">
          <div><h3 className="text-xs font-semibold uppercase tracking-wide text-eco-muted">Freshness actions ({overview.freshnessQueue.length})</h3>{overview.freshnessQueue.length ? <ul className="mt-2 max-h-48 space-y-2 overflow-auto">{overview.freshnessQueue.map((item, index) => <li key={`${item.facilityId}-${item.metric}-${index}`} className="rounded-md bg-eco-surface-secondary p-2 text-xs"><div className="flex justify-between gap-2"><span className="font-medium text-eco-text">{item.facilityName}</span><span className="font-mono text-eco-warning">{item.status}</span></div><p className="mt-1 text-eco-muted">{item.metric} · {item.reason ?? 'Review freshness'}</p></li>)}</ul> : <p className="mt-2 text-sm text-eco-muted">No freshness actions reported.</p>}</div>
          <div><h3 className="text-xs font-semibold uppercase tracking-wide text-eco-muted">Sources</h3>{overview.sourceHealth.length ? <ul className="mt-2 space-y-2">{overview.sourceHealth.map((source) => <li key={source.sourceId} className="flex items-start justify-between gap-3 text-xs"><span><span className="block text-eco-text">{source.provider}</span><span className="text-eco-muted">Last success {formatTimestamp(source.lastSuccessAt)}</span></span><span className="font-mono">{source.status}</span></li>)}</ul> : <PanelState kind="not-covered" message="NOT_COVERED — no environmental sources are configured." />}</div>
        </div>
      )}
    </DashboardPanel>
  );
}
