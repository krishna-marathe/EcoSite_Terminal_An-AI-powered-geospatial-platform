import { PILOT_CITIES, getPilotCity } from '../../data/pilotCities';
import { useDashboardStore } from '../../stores/dashboardStore';
import { Select } from '../ui/Field';
import { Button } from '../ui/Button';
import { InlineAlert } from '../ui/StateViews';
import type { CityId, DataMode } from '../../types';

/**
 * The single planning-context control: which city, which data mode, and what
 * the current city dataset actually contains. Exactly one mode indicator exists
 * in the app — this bar.
 */
export function PlanningBar() {
  const { cityId, setCityId, dataMode, setDataMode, facilities, facilitiesStatus, facilitiesError } = useDashboardStore();
  const city = getPilotCity(cityId);
  const observed = facilities.filter((facility) => facility.provenance.dataStatus === 'observed').length;

  const statusText =
    facilitiesStatus === 'loading'
      ? `Loading ${city.name} records…`
      : facilitiesStatus === 'error'
        ? `${city.name} records unavailable`
        : `${facilities.length} ${city.name} records · ${observed} marked observed · ${facilities.length - observed} other source statuses`;

  return (
    <section aria-label="Planning context" className="z-30 shrink-0 border-b border-eco-border bg-eco-surface px-3 py-1.5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-meta">
        <div className="flex items-center gap-1.5">
          <label htmlFor="planning-city" className="text-eco-muted">
            City
          </label>
          <Select
            id="planning-city"
            size="sm"
            value={cityId}
            onChange={(event) => setCityId(event.target.value as CityId)}
            className="w-auto"
          >
            {PILOT_CITIES.map((cityOption) => (
              <option key={cityOption.id} value={cityOption.id}>
                {cityOption.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex items-center gap-1.5">
          <label htmlFor="planning-data-mode" className="text-eco-muted">
            Data
          </label>
          <Select
            id="planning-data-mode"
            size="sm"
            value={dataMode}
            onChange={(event) => setDataMode(event.target.value as DataMode)}
            className="w-auto"
          >
            <option value="demo">Synthetic demo</option>
            <option value="api">Backend API</option>
          </Select>
        </div>

        <span role="status" className="min-w-0 truncate text-eco-text">
          {statusText}
        </span>

        <span className="hidden min-w-0 truncate text-eco-muted lg:inline">
          {city.extentDescription} · Coverage is a pilot snapshot, not a complete city inventory.
        </span>
      </div>

      {facilitiesError && (
        <InlineAlert
          tone="warning"
          className="mt-1.5"
          action={
            <Button size="xs" onClick={() => setDataMode('demo')}>
              Switch to Synthetic demo
            </Button>
          }
        >
          {facilitiesError} The backend may be unreachable.
        </InlineAlert>
      )}
    </section>
  );
}
