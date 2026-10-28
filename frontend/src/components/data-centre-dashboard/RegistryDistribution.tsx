import type { PublicFacility, PublicFacilitySummary, PublicStateCode } from '../../types/publicFacilities';
import { DashboardPanel, PanelState, type PanelLoadState } from './panelPrimitives';

const STATE_LABELS: Record<PublicStateCode, string> = { 'IN-MH': 'Maharashtra', 'IN-TG': 'Telangana', 'IN-KA': 'Karnataka', 'IN-TN': 'Tamil Nadu' };

export function RegistryDistribution({ summary, facilities, isLoading, error }: PanelLoadState & {
  summary?: PublicFacilitySummary | null;
  facilities?: PublicFacility[] | null;
}) {
  if (isLoading) return <DashboardPanel title="Registry distribution"><PanelState kind="loading" /></DashboardPanel>;
  if (error) return <DashboardPanel title="Registry distribution"><PanelState kind="error" message={error} /></DashboardPanel>;
  if (!summary && !facilities?.length) return <DashboardPanel title="Registry distribution"><PanelState kind="empty" /></DashboardPanel>;
  const operators = new Map<string, number>();
  facilities?.forEach((facility) => operators.set(facility.operator, (operators.get(facility.operator) ?? 0) + 1));
  const operatorRows = [...operators.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return (
    <DashboardPanel title="Registry distribution" eyebrow="State and operator">
      <div className="grid gap-5 sm:grid-cols-2">
        <div><h3 className="text-xs font-semibold uppercase tracking-wide text-eco-muted">By state</h3><ul className="mt-2 space-y-2">{summary && Object.entries(summary.byState).map(([code, count]) => <li key={code} className="flex justify-between text-sm"><span>{STATE_LABELS[code as PublicStateCode] ?? code}</span><span className="font-mono">{count}</span></li>)}</ul></div>
        <div><h3 className="text-xs font-semibold uppercase tracking-wide text-eco-muted">By operator</h3>{operatorRows.length ? <ul className="mt-2 max-h-40 space-y-2 overflow-auto">{operatorRows.map(([operator, count]) => <li key={operator} className="flex justify-between gap-3 text-sm"><span className="truncate">{operator}</span><span className="font-mono">{count}</span></li>)}</ul> : <p className="mt-2 text-sm text-eco-muted">Operator distribution requires the current facility page.</p>}</div>
      </div>
    </DashboardPanel>
  );
}
