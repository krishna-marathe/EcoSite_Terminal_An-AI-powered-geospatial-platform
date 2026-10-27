import { environmentalMessage } from '../../utils/environmentalLayers';
import { useDashboardStore } from '../../stores/dashboardStore';

export const DataQualityBanner = () => {
  const { facilities, dataMode } = useDashboardStore();
  const sources = [...new Set(facilities.map((facility) => `${facility.provenance.sourceOrganization} (${facility.provenance.dataStatus})`))];
  const modeLine = environmentalMessage(dataMode);

  return (
    <details className="mx-2 mb-2 shrink-0 rounded-sm border border-eco-warning/30 bg-eco-warning/5 px-3 py-2 text-meta">
      <summary className="cursor-pointer select-none font-medium text-eco-warning">
        Data quality &amp; coverage · {facilities.length} facility records
      </summary>
      <p className="mt-1 text-eco-text">{modeLine}</p>
      <p className="mt-1 text-eco-muted">API transport does not verify observations; facility source status is shown below.</p>
      <p className="mt-0.5 truncate text-eco-muted" title={sources.join(' · ')}>
        Sources: {sources.length > 0 ? sources.join(' · ') : 'none listed'}
      </p>
    </details>
  );
};
