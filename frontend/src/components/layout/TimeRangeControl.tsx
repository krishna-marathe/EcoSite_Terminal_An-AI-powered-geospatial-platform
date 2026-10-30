import { useSearchParams } from 'react-router-dom';
import { useDashboardStore } from '../../stores/dashboardStore';
import type { TimeRange } from '../../types';

const RANGES: TimeRange[] = ['1h', '24h', '7d', '30d', 'all'];

/**
 * The single time-range control for the dashboard. It used to exist twice — in
 * the app header and again inside the map's "DC SITUATION" strip — bound to the
 * same store with different option sets. This is now the only one.
 */
export function TimeRangeControl({ className = '' }: { className?: string }) {
  const timeRange = useDashboardStore((state) => state.timeRange);
  const setTimeRange = useDashboardStore((state) => state.setTimeRange);
  const [searchParams, setSearchParams] = useSearchParams();

  const select = (next: TimeRange) => {
    setTimeRange(next);
    const params = new URLSearchParams(searchParams);
    params.set('timeRange', next);
    setSearchParams(params, { replace: true });
  };

  return (
    <div
      role="group"
      aria-label="Time range"
      className={`flex items-center rounded-md border border-eco-border bg-eco-surface p-0.5 font-mono text-micro ${className}`}
    >
      {RANGES.map((range) => (
        <button
          key={range}
          type="button"
          aria-pressed={timeRange === range}
          onClick={() => select(range)}
          className={`cursor-pointer rounded-sm px-2 py-0.5 uppercase transition-colors ${
            timeRange === range
              ? 'bg-eco-surface-secondary font-semibold text-eco-primary'
              : 'text-eco-muted hover:text-eco-text'
          }`}
        >
          {range}
        </button>
      ))}
    </div>
  );
}
