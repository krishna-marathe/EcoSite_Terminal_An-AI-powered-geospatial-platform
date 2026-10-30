import { Gauge, TriangleAlert } from 'lucide-react';
import { Badge, type BadgeVariant } from '../ui/Badge';
import { Card } from '../ui/Card';
import type { RiskBand, RiskParameter, RiskScoreResponse } from '../../types/risk';

const BAND_TONE: Record<RiskBand, BadgeVariant> = {
  low: 'primary',
  moderate: 'warning',
  high: 'critical',
  critical: 'critical',
  unknown: 'outline',
};

const BAND_LABEL: Record<RiskBand, string> = {
  low: 'Low',
  moderate: 'Moderate',
  high: 'High',
  critical: 'Critical',
  unknown: 'Not scored',
};

const NUMBER = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 });

function displayValue(parameter: RiskParameter): string {
  if (parameter.value === null) return 'Unavailable';
  const value = parameter.status === 'AVAILABLE' ? NUMBER.format(parameter.value) : '—';
  return `${value} ${parameter.unit}`;
}

function ScoreBar({ score }: { score: number }) {
  const width = Math.max(0, Math.min(100, score));
  return (
    <div className="h-1.5 w-full rounded-full bg-eco-surface-secondary" aria-hidden="true">
      <div
        className="h-1.5 rounded-full bg-eco-primary"
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

export interface RiskScorePanelProps {
  data?: RiskScoreResponse | null;
  loading?: boolean;
  error?: string;
}

/**
 * Environmental risk score, 0-100.
 *
 * Every parameter row states whether a provider returned a value. Unavailable
 * parameters keep their reason visible so a partial score cannot read as a
 * complete one.
 */
export function RiskScorePanel({ data, loading = false, error }: RiskScorePanelProps) {
  const available = data?.parameters.filter((parameter) => parameter.status === 'AVAILABLE') ?? [];
  const unavailable = data?.parameters.filter((parameter) => parameter.status === 'UNAVAILABLE') ?? [];

  return (
    <Card
      title="Environmental risk score"
      subtitle="Weighted public-provider context near the generalised facility coordinates"
      icon={<Gauge className="h-4 w-4" />}
      status={data ? `${BAND_LABEL[data.band]} · ${Math.round(data.coverage * 100)}% coverage` : undefined}
      statusTone={data?.band === 'critical' || data?.band === 'high' ? 'critical' : data?.band === 'moderate' ? 'warning' : 'neutral'}
      footer={
        data
          ? `Screening signal, not a compliance determination. Score model ${data.scoreVersion}.`
          : 'Score unavailable.'
      }
    >
      {loading ? (
        <p className="text-body text-eco-muted">Scoring live provider parameters&hellip;</p>
      ) : error ? (
        <p className="flex items-start gap-2 text-body text-eco-critical">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </p>
      ) : !data ? (
        <p className="text-body text-eco-muted">No risk score has been computed for this facility.</p>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <p className="text-meta text-eco-muted">Risk score</p>
              <p className="font-mono text-display text-eco-text">
                {data.score === null ? '—' : NUMBER.format(data.score)}
                <span className="text-h2 text-eco-muted">/100</span>
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 pb-2">
              <Badge size="sm" variant={BAND_TONE[data.band]}>{BAND_LABEL[data.band]}</Badge>
              <Badge size="xs" variant="outline">{data.confidence} confidence</Badge>
              <Badge size="xs" variant="outline">
                {available.length} of {data.parameters.length} parameters
              </Badge>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-micro text-eco-muted">
              <span>Parameter coverage</span>
              <span>{Math.round(data.coverage * 100)}%</span>
            </div>
            <ScoreBar score={data.coverage * 100} />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-meta">
              <thead>
                <tr className="text-micro uppercase tracking-[0.06em] text-eco-muted">
                  <th className="pb-2 pr-3 font-medium">Parameter</th>
                  <th className="pb-2 pr-3 font-medium">Value</th>
                  <th className="pb-2 pr-3 font-medium">Risk</th>
                  <th className="pb-2 font-medium">Weight</th>
                </tr>
              </thead>
              <tbody>
                {data.parameters.map((parameter) => (
                  <tr key={parameter.key} className="border-t border-eco-border align-top">
                    <td className="py-2 pr-3">
                      <span className="text-eco-text">{parameter.label}</span>
                      {parameter.status === 'UNAVAILABLE' ? (
                        <span className="block text-micro text-eco-muted">{parameter.reason}</span>
                      ) : (
                        <span className="block text-micro text-eco-muted">{parameter.note}</span>
                      )}
                    </td>
                    <td className="py-2 pr-3 font-mono text-eco-text">{displayValue(parameter)}</td>
                    <td className="py-2 pr-3">
                      {parameter.score === null ? (
                        <Badge size="xs" variant="outline">Unavailable</Badge>
                      ) : (
                        <span className="font-mono text-eco-text">{NUMBER.format(parameter.score)}</span>
                      )}
                    </td>
                    <td className="py-2 font-mono text-eco-muted">{parameter.weight.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {unavailable.length > 0 && (
            <p className="text-micro text-eco-muted">
              {unavailable.length} parameter{unavailable.length === 1 ? '' : 's'} could not be measured and
              {' '}are excluded from the score, not scored as zero.
            </p>
          )}

          {data.providerErrors.length > 0 && (
            <ul className="space-y-1 text-micro text-eco-warning">
              {data.providerErrors.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}
