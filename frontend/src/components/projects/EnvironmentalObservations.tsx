import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { DataTable, type DataTableColumn } from '../ui/DataTable';
import { EmptyState, InlineAlert, LoadingSkeleton } from '../ui/StateViews';
import {
  IMPLEMENTED_SOURCES,
  getSiteObservations,
  indicatorLabel,
  observationError,
  runEnvironmentalAnalysis,
  sourceLabel,
  type AnalysisResponse,
  type Observation,
  type ObservationStatus,
} from '../../services/observations';
import type { CandidateSite } from '../../services/projects';

const DEFAULT_SOURCES = ['jrc_gsw', 'copernicus_stac'];

const statusVariant = (status: ObservationStatus) => {
  if (status === 'AVAILABLE') return 'primary' as const;
  if (status === 'PARTIAL' || status === 'STALE') return 'warning' as const;
  if (status === 'SOURCE_UNAVAILABLE') return 'outline' as const;
  return 'neutral' as const;
};

const runVariant = (status: AnalysisResponse['results'][number]['status']) => {
  if (status === 'success') return 'primary' as const;
  if (status === 'partial') return 'warning' as const;
  return 'critical' as const;
};

function formatValue(observation: Observation) {
  if (observation.value === null) {
    return (
      <span className="text-eco-muted" title={observation.missing_reason ?? undefined}>
        Unavailable
      </span>
    );
  }
  return observation.value.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

const columns: DataTableColumn[] = [
  { key: 'source', header: 'Source' },
  { key: 'indicator', header: 'Indicator' },
  { key: 'value', header: 'Value', align: 'right', mono: true },
  { key: 'unit', header: 'Unit' },
  { key: 'status', header: 'Status' },
  { key: 'period', header: 'Period' },
  { key: 'coverage', header: 'Coverage', align: 'right', mono: true },
  { key: 'evidence', header: 'Evidence' },
  { key: 'provenance', header: 'Provenance' },
];

function Provenance({ observation }: { observation: Observation }) {
  return (
    <details>
      <summary className="cursor-pointer text-meta text-eco-primary">View</summary>
      <dl className="mt-1 space-y-0.5 text-micro text-eco-muted">
        <div>Dataset: <span className="text-eco-text">{observation.dataset_version}</span></div>
        <div>Method: <span className="text-eco-text">{observation.method}</span></div>
        <div>Parser: <span className="text-eco-text">{observation.processing_version}</span></div>
        <div>Resolution: <span className="text-eco-text">{observation.resolution}</span></div>
        <div>Retrieved: <span className="text-eco-text">{observation.retrieved_at}</span></div>
        {observation.raw_snapshot_id && (
          <div>Snapshot: <span className="text-eco-text">{observation.raw_snapshot_id}</span></div>
        )}
        {observation.missing_reason && (
          <div>Missing reason: <span className="text-eco-text">{observation.missing_reason}</span></div>
        )}
        {Object.keys(observation.quality_flags).length > 0 && (
          <div>
            Quality flags: <code className="break-all text-eco-text">{JSON.stringify(observation.quality_flags)}</code>
          </div>
        )}
      </dl>
    </details>
  );
}

/**
 * Stored environmental observations for one candidate polygon.
 *
 * The panel reads the local data plane and can trigger the implemented P0
 * connectors. A failed source is listed with its error; a missing value is
 * rendered as "Unavailable", never as zero. No score is derived here.
 */
export function EnvironmentalObservations({ site }: { site: CandidateSite }) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string[]>(DEFAULT_SOURCES);
  const [buffer, setBuffer] = useState(1000);
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [error, setError] = useState('');
  const [running, setRunning] = useState(false);

  const observations = useQuery({
    queryKey: ['site-observations', site.id],
    queryFn: ({ signal }) => getSiteObservations(site.id, signal),
    retry: false,
  });

  const toggle = (sourceId: string) => {
    setSelected((current) =>
      current.includes(sourceId) ? current.filter((id) => id !== sourceId) : [...current, sourceId]
    );
  };

  const run = async () => {
    if (selected.length === 0) return;
    setRunning(true);
    setError('');
    setAnalysis(null);
    try {
      const response = await runEnvironmentalAnalysis(site.id, {
        sources: selected,
        buffer_m: buffer,
      });
      setAnalysis(response);
      await queryClient.invalidateQueries({ queryKey: ['site-observations', site.id] });
    } catch (err) {
      setError(observationError(err));
    } finally {
      setRunning(false);
    }
  };

  const rows = (observations.data?.items ?? []).map((observation) => [
    <span className="text-meta">{sourceLabel(observation.source_id)}</span>,
    <span title={observation.indicator}>{indicatorLabel(observation.indicator)}</span>,
    formatValue(observation),
    <span className="text-meta text-eco-muted">{observation.unit}</span>,
    <Badge variant={statusVariant(observation.status)} size="xs">
      {observation.status}
    </Badge>,
    <span className="text-meta text-eco-muted">
      {observation.period_start || observation.period_end
        ? `${observation.period_start ?? '—'} → ${observation.period_end ?? '—'}`
        : '—'}
    </span>,
    observation.coverage_fraction === null ? (
      <span className="text-eco-muted" title="Metadata-only observation; pixel coverage is not claimed.">
        —
      </span>
    ) : (
      `${(observation.coverage_fraction * 100).toFixed(1)}%`
    ),
    <span className="text-micro text-eco-muted">{observation.evidence_class}</span>,
    <Provenance observation={observation} />,
  ]);

  return (
    <Card
      title="Stored environmental observations"
      subtitle={`${site.name} · geometry ${site.geometry_hash.slice(0, 12)}…`}
      status={observations.data ? `${observations.data.total} records` : undefined}
      footer="Local backend observations. Missing values stay Unavailable and are never replaced with zero."
    >
      <div className="space-y-4">
        <InlineAlert tone="info">
          These are source observations, not a sustainability score. JRC reports historical water
          occurrence; Sentinel-2 records scene availability only. SRTM terrain reads the Earthdata
          token configured on the backend.
        </InlineAlert>

        <fieldset className="space-y-2" disabled={running}>
          <legend className="text-meta font-medium text-eco-text">Sources to fetch</legend>
          {IMPLEMENTED_SOURCES.map((source) => (
            <label key={source.id} className="flex items-start gap-2 text-meta text-eco-text">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={selected.includes(source.id)}
                onChange={() => toggle(source.id)}
              />
              <span>
                {source.label}
                <span className="block text-micro text-eco-muted">{source.note}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <div className="flex flex-wrap items-end gap-3">
          <label className="text-meta text-eco-text">
            Buffer (m)
            <input
              type="number"
              min={0}
              max={50000}
              step={100}
              value={buffer}
              disabled={running}
              onChange={(event) => {
                const next = Number(event.target.value);
                setBuffer(Number.isFinite(next) ? Math.max(0, Math.min(50000, next)) : 0);
              }}
              className="ml-2 w-24 rounded-sm border border-eco-border bg-eco-surface px-2 py-1 font-mono text-meta"
            />
          </label>
          <Button
            type="button"
            variant="primary"
            size="sm"
            loading={running}
            disabled={running || selected.length === 0}
            onClick={run}
          >
            {running ? 'Fetching sources…' : 'Run local analysis'}
          </Button>
        </div>

        {error && <InlineAlert tone="critical">{error}</InlineAlert>}

        <div aria-live="polite" className="space-y-2">
          {analysis && (
            <div className="space-y-1 rounded-sm border border-eco-border bg-eco-surface-secondary p-2">
              <p className="text-meta font-medium text-eco-text">Last run</p>
              {analysis.results.map((result) => (
                <div key={result.source_id} className="flex flex-wrap items-center gap-2 text-meta">
                  <Badge variant={runVariant(result.status)} size="xs">
                    {result.status}
                  </Badge>
                  <span className="text-eco-text">{sourceLabel(result.source_id)}</span>
                  <span className="text-eco-muted">{result.observation_count} observations</span>
                  {result.error && <span className="text-eco-critical">{result.error}</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        {observations.isPending && <LoadingSkeleton rows={4} />}
        {observations.error && <InlineAlert tone="critical">{observationError(observations.error)}</InlineAlert>}
        {observations.data && (
          <DataTable
            columns={columns}
            rows={rows}
            dense
            empty={
              <EmptyState
                title="No stored observations for this candidate."
                body="Run the local connectors to fetch JRC water occurrence and Sentinel-2 scene metadata. A source that fails is recorded as failed; nothing is filled in."
              />
            }
          />
        )}
      </div>
    </Card>
  );
}
