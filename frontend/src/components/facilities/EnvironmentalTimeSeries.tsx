import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card } from '../ui/Card';
import type { EnvironmentalRange, EnvironmentalRangeResponse } from '../../types/environmentalMonitoring';
import { StationContext } from './StationContext';

const RANGES: EnvironmentalRange[] = ['24h', '7d', '30d', '90d', '1y'];

export interface EnvironmentalTimeSeriesProps {
  data: EnvironmentalRangeResponse | null;
  range: EnvironmentalRange;
  onRangeChange: (range: EnvironmentalRange) => void;
  loading?: boolean;
}

export function EnvironmentalTimeSeries({ data, range, onRangeChange, loading = false }: EnvironmentalTimeSeriesProps) {
  return (
    <Card
      title="Environmental trends"
      subtitle="Cached observations and rollups from linked public stations"
      actions={
        <div className="flex flex-wrap gap-1" aria-label="Environmental time range">
          {RANGES.map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={range === item}
              onClick={() => onRangeChange(item)}
              className={`rounded border px-2 py-1 font-mono text-micro ${range === item ? 'border-eco-primary bg-eco-primary/10 text-eco-primary' : 'border-eco-border text-eco-muted hover:text-eco-text'}`}
            >
              {item}
            </button>
          ))}
        </div>
      }
    >
      {loading ? <p className="text-body text-eco-muted">Loading trend&hellip;</p> : !data ? (
        <p className="text-body text-eco-muted">No trend response is available.</p>
      ) : (
        <div className="space-y-5">
          {data.series.map((series) => (
            <article key={series.metric} className="grid gap-3 border-b border-eco-border pb-5 last:border-0 last:pb-0 lg:grid-cols-[220px_1fr]">
              <div>
                <p className="font-medium text-eco-text">{series.displayName}</p>
                <p className="text-meta text-eco-muted">{series.unit} &middot; {series.availability.replaceAll('_', ' ')}</p>
                <div className="mt-2"><StationContext station={series.station} contextNotice={series.contextNotice} /></div>
              </div>
              {series.points.length ? (
                <div className="h-44 min-w-0" aria-label={`${series.displayName} chart`}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={series.points} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                      <XAxis dataKey="timestamp" tick={{ fill: '#87988e', fontSize: 10 }} tickFormatter={(value: string) => value.slice(5, 16).replace('T', ' ')} />
                      <YAxis tick={{ fill: '#87988e', fontSize: 10 }} width={42} />
                      <Tooltip contentStyle={{ background: '#111514', border: '1px solid #29362f', color: '#e7f1e8' }} />
                      <Line type="monotone" dataKey="value" stroke="#39f58b" strokeWidth={2} dot={false} connectNulls={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : <div className="flex min-h-28 items-center justify-center rounded border border-dashed border-eco-border text-meta text-eco-muted">No observations in this range</div>}
            </article>
          ))}
        </div>
      )}
    </Card>
  );
}

