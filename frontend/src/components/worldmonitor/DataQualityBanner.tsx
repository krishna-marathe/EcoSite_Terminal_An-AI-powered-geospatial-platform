import { useDashboardStore } from '../../stores/dashboardStore';

export const DataQualityBanner = () => {
  const { facilities, dataMode } = useDashboardStore();
  const sources = [...new Set(facilities.map((facility) => `${facility.provenance.sourceOrganization} (${facility.provenance.dataStatus})`))];
  const modeLine =
    dataMode === 'demo'
      ? 'Synthetic pilot fixtures; environmental overlays are illustrative geometry — no municipal inventory or live sensor stream.'
      : 'Backend records preserve submitted provenance; environmental overlays and live feeds are unavailable in API mode.';

  return (
    <details className="mx-2 mb-2 shrink-0 rounded-sm border border-eco-warning/30 bg-eco-warning/5 px-3 py-2 text-meta">
      <summary className="cursor-pointer select-none font-medium text-eco-warning">
        Data quality &amp; coverage · {facilities.length} facility records
      </summary>
      <p className="mt-1 text-eco-text">{modeLine}</p>
      <p className="mt-0.5 truncate text-eco-muted" title={sources.join(' · ')}>
        Sources: {sources.length > 0 ? sources.join(' · ') : 'none listed'}
      </p>
    </details>
  );
};
