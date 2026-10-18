import { useEffect, useState } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { useDashboardStore } from '../stores/dashboardStore';
import { getForecast, FORECAST_METRICS } from '../services/forecasts';
import { getPilotCity } from '../data/pilotCities';
import { chartColors } from '../theme/tokens';
import { PageHeader, PageShell } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { DataModeBadge, SourceTag } from '../components/ui/Badge';
import { Field, Select } from '../components/ui/Field';
import { MetricTile } from '../components/ui/MetricTile';
import { EmptyState, InlineAlert, LoadingSkeleton } from '../components/ui/StateViews';
import type { CityId, DataMode, ForecastResponse } from '../types';

export function Forecast() {
  const { cityId, dataMode } = useDashboardStore();
  return <CityForecast key={`${cityId}-${dataMode}`} cityId={cityId} dataMode={dataMode} />;
}

function CityForecast({ cityId, dataMode }: { cityId: CityId; dataMode: DataMode }) {
  const [metric, setMetric] = useState('electricity_demand');
  const [horizon, setHorizon] = useState(12);
  const [response, setResponse] = useState<{ key: string; data?: ForecastResponse; error?: string } | null>(null);
  const key = `${cityId}-${dataMode}-${metric}-${horizon}`;
  useEffect(() => {
    let active = true;
    getForecast({ location_id: cityId, metric, horizon_months: horizon }, dataMode).then(data => { if (active) setResponse({ key, data }); }).catch(e => { if (active) setResponse({ key, error: e instanceof Error ? e.message : 'Forecast unavailable.' }); });
    return () => { active = false; };
  }, [cityId, dataMode, metric, horizon, key]);
  const data = response?.key === key ? response.data : undefined;
  const error = response?.key === key ? response.error : undefined;
  const points = data?.forecast ?? [];
  const first = points[0]?.prediction;
  const last = points.at(-1)?.prediction;
  const metricConfig = FORECAST_METRICS[metric as keyof typeof FORECAST_METRICS];
  const changePercent = first !== undefined && first !== 0 && last !== undefined ? ((last - first) / first) * 100 : null;

  return <PageShell>
    <PageHeader
      eyebrow="Forecast"
      title={`${getPilotCity(cityId).name} environmental forecasts`}
      purpose="Explore synthetic pilot projections by metric and horizon; no validated prediction is provided."
      meta={<DataModeBadge mode={dataMode} />}
    />
    <InlineAlert tone="warning">
      Pilot forecasts are synthetic demonstrations; no validated prediction or calibrated confidence interval is provided.
    </InlineAlert>
    <Card title="Projection settings">
      <div className="grid max-w-xl gap-4 sm:grid-cols-2">
        <Field label="Metric" htmlFor="forecast-metric">
          <Select id="forecast-metric" value={metric} onChange={e => setMetric(e.target.value)}>
            {Object.entries(FORECAST_METRICS).map(([id, item]) => <option key={id} value={id}>{item.label} ({item.unit})</option>)}
          </Select>
        </Field>
        <Field label="Horizon" htmlFor="forecast-horizon">
          <Select id="forecast-horizon" value={horizon} onChange={e => setHorizon(Number(e.target.value))}>
            {[6, 12, 24].map(n => <option key={n} value={n}>{n} months</option>)}
          </Select>
        </Field>
      </div>
    </Card>
    <Card
      title={`Synthetic projection · ${metricConfig.label}`}
      subtitle={data ? `${data.model} (${data.modelVersion})` : undefined}
      footer={data ? <SourceTag organization="" status={data.dataStatus} /> : undefined}
    >
      {!data && !error && <LoadingSkeleton variant="chart" />}
      {error && <InlineAlert tone="critical">Forecast unavailable: {error}</InlineAlert>}
      {data && (points.length ? <>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points}>
              <CartesianGrid stroke={chartColors.grid} />
              <XAxis dataKey="date" tick={{ fill: chartColors.muted, fontSize: 12 }} />
              <YAxis unit={` ${data.unit}`} width={100} tick={{ fill: chartColors.muted, fontSize: 12 }} />
              <Tooltip />
              <Line dataKey="prediction" stroke={chartColors.primary} name="Synthetic projection" />
              <Line dataKey="lower_bound" stroke={chartColors.muted} strokeDasharray="4 4" name="Illustrative lower bound" dot={false} />
              <Line dataKey="upper_bound" stroke={chartColors.muted} strokeDasharray="4 4" name="Illustrative upper bound" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-meta text-eco-muted">Solid line: synthetic projection. Dashed lines: illustrative bounds, not a calibrated confidence interval.</p>
      </> : <EmptyState title="No forecast points available." body="Try another metric or horizon." />)}
    </Card>
    {data && points.length > 0 && <>
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricTile label="First" value={first === undefined ? null : first.toLocaleString()} unit={data.unit} caption={points[0]?.date} />
        <MetricTile label="Final" value={last === undefined ? null : last.toLocaleString()} unit={data.unit} caption={points.at(-1)?.date} />
        <MetricTile label="Change" value={changePercent === null ? null : `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(1)}%`} caption="Across the selected horizon." />
      </div>
      <details className="rounded-md border border-eco-border bg-eco-surface px-3 py-2">
        <summary className="cursor-pointer text-body font-medium text-eco-text">Methodology and limitations</summary>
        <p className="mt-2 text-meta text-eco-muted">{data.methodologyNotes}</p>
      </details>
    </>}
  </PageShell>;
}
