import { Activity, Clock3 } from 'lucide-react';
import { Badge, type BadgeVariant } from '../ui/Badge';
import { Card } from '../ui/Card';
import type { CurrentEnvironmentalMetric, EnvironmentalCurrentResponse } from '../../types/environmentalMonitoring';
import { StationContext } from './StationContext';

const AVAILABILITY_TONE: Record<CurrentEnvironmentalMetric['availability'], BadgeVariant> = {
  AVAILABLE: 'primary',
  PARTIAL: 'warning',
  STALE: 'warning',
  SOURCE_UNAVAILABLE: 'critical',
  UNKNOWN: 'outline',
  NOT_COVERED: 'outline',
};

function displayValue(metric: CurrentEnvironmentalMetric): string {
  if (metric.value === null) return 'Unavailable';
  return `${metric.value.toLocaleString()} ${metric.unit}`;
}

export interface EnvironmentalCurrentProps {
  data: EnvironmentalCurrentResponse | null;
  loading?: boolean;
}

export function EnvironmentalCurrent({ data, loading = false }: EnvironmentalCurrentProps) {
  return (
    <Card title="Current environmental context" subtitle="Official CPCB & IMD station network · Surrounding ambient baseline" icon={<Activity className="h-4 w-4" />}>
      {loading ? <p className="text-body text-eco-muted">Loading current observations&hellip;</p> : !data ? (
        <p className="text-body text-eco-muted">Environmental context is unavailable.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data.metrics.map((metric) => (
            <article key={metric.metric} className="rounded border border-eco-border bg-eco-surface-secondary/35 p-3">
              <div className="flex items-start justify-between gap-2">
                <div><p className="text-meta text-eco-muted">{metric.displayName}</p><p className="mt-1 font-mono text-h2 text-eco-text">{displayValue(metric)}</p></div>
                <Badge size="xs" variant={AVAILABILITY_TONE[metric.availability]}>{metric.availability.replaceAll('_', ' ')}</Badge>
              </div>
              <div className="mt-3 border-t border-eco-border pt-2">
                <StationContext station={metric.station} contextNotice={metric.contextNotice} />
              </div>
              <p className="mt-2 flex items-center gap-1 text-micro text-eco-muted">
                <Clock3 className="h-3 w-3" />
                {metric.observedAt ? `Observed ${metric.observedAt}` : 'No observation timestamp'}
              </p>
            </article>
          ))}
        </div>
      )}
    </Card>
  );
}

