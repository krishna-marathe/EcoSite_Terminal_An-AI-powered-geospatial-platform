import type { PublicFacilitySummary } from '../../types/publicFacilities';
import { DashboardPanel, PanelState, type PanelLoadState } from './panelPrimitives';
import { formatTimestamp } from './formatTimestamp';

export function RegistryKpiSummary({ summary, isLoading, error }: PanelLoadState & { summary?: PublicFacilitySummary | null }) {
  return (
    <DashboardPanel title="Operational registry" eyebrow="Public facilities">
      {isLoading ? <PanelState kind="loading" /> : error ? <PanelState kind="error" message={error} /> : !summary ? <PanelState kind="empty" /> : (
        <>
          <dl className="grid grid-cols-2 gap-3">
            <div className="rounded-md bg-eco-surface-secondary p-3"><dt className="text-xs text-eco-muted">Operating facilities</dt><dd className="mt-1 text-2xl font-semibold text-eco-text">{summary.operationalFacilityCount}</dd></div>
            <div className="rounded-md bg-eco-surface-secondary p-3"><dt className="text-xs text-eco-muted">Operators</dt><dd className="mt-1 text-2xl font-semibold text-eco-text">{summary.operatorCount}</dd></div>
          </dl>
          <p className="mt-3 text-xs text-eco-muted">Capacity total not shown: disclosures use mixed measurement boundaries.</p>
          <p className="mt-2 font-mono text-micro text-eco-muted">Registry {summary.registryVersion} · As of {formatTimestamp(summary.asOf)}</p>
        </>
      )}
    </DashboardPanel>
  );
}
