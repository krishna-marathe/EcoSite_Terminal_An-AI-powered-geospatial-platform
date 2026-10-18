import { useDashboardStore } from '../../stores/dashboardStore';
import { MetricTile } from '../ui/MetricTile';
import { LoadingSkeleton } from '../ui/StateViews';

export const MacroTelemetryPanel = () => {
  const { facilities, facilitiesStatus } = useDashboardStore();
  const ready = facilitiesStatus === 'ready';

  const mean = (key: 'waterStress' | 'gridPressure' | 'airPollution'): string | null =>
    ready && facilities.length
      ? (facilities.reduce((sum, facility) => sum + facility.indicators[key], 0) / facilities.length).toFixed(1)
      : null;

  const capacityListings = facilities.filter(
    (facility) => typeof facility.capacityMw === 'number' && facility.capacityMw > 0
  );
  const totalCapacity = ready && capacityListings.length
    ? capacityListings.reduce((sum, facility) => sum + (facility.capacityMw || 0), 0).toLocaleString()
    : null;

  const observedRecords =
    ready && facilities.length
      ? facilities.filter((facility) => facility.provenance.dataStatus === 'observed').length
      : null;

  const tiles: Array<{ label: string; value: string | number | null; unit?: string }> = [
    { label: 'Facility records', value: ready ? facilities.length : null },
    { label: 'Listed capacity', value: totalCapacity, unit: 'MW' },
    { label: 'Mean water stress', value: mean('waterStress'), unit: '/100' },
    { label: 'Mean grid pressure', value: mean('gridPressure'), unit: '/100' },
    { label: 'Mean air index', value: mean('airPollution'), unit: '/100' },
    { label: 'Observed records', value: observedRecords },
  ];

  if (facilitiesStatus === 'loading') {
    return (
      <div className="space-y-2 p-3">
        <LoadingSkeleton variant="tiles" rows={6} />
      </div>
    );
  }

  return (
    <div className="space-y-2 p-3">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-2">
        {tiles.map((tile) => (
          <MetricTile key={tile.label} label={tile.label} value={tile.value} unit={tile.unit} />
        ))}
      </div>
      <p className="text-meta text-eco-muted">
        Means cover listed facilities only — normalized screening indices, not measured concentrations or city-wide statistics.
      </p>
    </div>
  );
};
