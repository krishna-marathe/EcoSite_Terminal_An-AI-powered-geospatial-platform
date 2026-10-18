import { useQuery } from '@tanstack/react-query';
import { PILOT_CITIES } from '../../data/pilotCities';
import { getFacilities } from '../../services/facilities';
import { useDashboardStore } from '../../stores/dashboardStore';
import type { Facility } from '../../types';
import { DataTable } from '../ui/DataTable';
import { InlineAlert, LoadingSkeleton } from '../ui/StateViews';

export function CityComparison() {
  const mode = useDashboardStore((state) => state.dataMode);
  const query = useQuery({ queryKey: ['city-comparison', mode], queryFn: () => Promise.all(PILOT_CITIES.map(async (city) => ({ city, facilities: await getFacilities({ cityId: city.id }, mode) }))) });
  const mean = (facilities: Facility[], key: 'waterStress' | 'gridPressure' | 'airPollution') => facilities.length ? (facilities.reduce((sum, facility) => sum + facility.indicators[key], 0) / facilities.length).toFixed(1) : null;
  const unavailable = <span className="text-eco-muted">Unavailable</span>;

  return (
    <details open className="shrink-0 border-b border-eco-border bg-eco-surface px-3 py-2">
      <summary className="cursor-pointer select-none text-body font-medium text-eco-text">
        Compare Pune and Mumbai coverage
      </summary>

      {query.isPending && <LoadingSkeleton rows={3} className="mt-3" />}

      {query.isError && (
        <InlineAlert tone="critical" className="mt-3">
          Comparison unavailable: {query.error.message}
        </InlineAlert>
      )}

      {query.data && (
        <DataTable
          className="mt-2"
          columns={[
            { key: 'city', header: 'City' },
            { key: 'records', header: 'Records (observed)', align: 'right', mono: true },
            { key: 'water', header: 'Mean water /100', align: 'right', mono: true },
            { key: 'grid', header: 'Mean grid /100', align: 'right', mono: true },
            { key: 'air', header: 'Mean air /100', align: 'right', mono: true },
          ]}
          rows={query.data.map(({ city, facilities }) => [
            city.name,
            `${facilities.length} · ${facilities.filter((facility) => facility.provenance.dataStatus === 'observed').length} observed`,
            mean(facilities, 'waterStress') ?? unavailable,
            mean(facilities, 'gridPressure') ?? unavailable,
            mean(facilities, 'airPollution') ?? unavailable,
          ])}
        />
      )}

      <p className="pt-2 text-meta text-eco-muted">
        Same unweighted mean of normalized facility indices for both cities. Coverage denominator is unknown; these samples do not establish city-wide conditions.
      </p>
    </details>
  );
}
