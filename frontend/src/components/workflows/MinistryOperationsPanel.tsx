import { Activity, AlertTriangle, Database, Server } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';
import { DataTable } from '../ui/DataTable';
import { EmptyState } from '../ui/StateViews';
import type { FreshnessQueueItem, MinistryOverviewData, SourceHealthItem } from './types';

const stateNames: Record<string, string> = {
  'IN-MH': 'Maharashtra', 'IN-TG': 'Telangana', 'IN-KA': 'Karnataka', 'IN-TN': 'Tamil Nadu',
};

function statusBadge(status: SourceHealthItem['status']) {
  const variant = status === 'CONNECTED' ? 'primary' : status === 'STALE' ? 'warning' : status === 'NOT_CONNECTED' ? 'outline' : 'critical';
  return <Badge variant={variant} size="xs">{status.replaceAll('_', ' ')}</Badge>;
}

function queueBadge(status: FreshnessQueueItem['status']) {
  const variant = status === 'current' ? 'primary' : status === 'stale' ? 'warning' : status === 'unavailable' ? 'critical' : 'outline';
  return <Badge variant={variant} size="xs">{status.replace('_', ' ')}</Badge>;
}

export function MinistryOperationsPanel({ overview }: { overview: MinistryOverviewData }) {
  const unavailable = overview.states.reduce((sum, state) => sum + state.unavailableFacilityCount, 0);
  const stale = overview.states.reduce((sum, state) => sum + state.staleFacilityCount, 0);
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card title="Published facilities" icon={<Server className="h-4 w-4" />}>
          <p className="font-mono text-h1 text-eco-primary">{overview.facilityCount}</p>
          <p className="text-meta text-eco-muted">Across the four-state scope</p>
        </Card>
        <Card title="Unavailable context" icon={<AlertTriangle className="h-4 w-4" />}>
          <p className="font-mono text-h1 text-eco-critical">{unavailable}</p>
          <p className="text-meta text-eco-muted">Requires source or station coverage</p>
        </Card>
        <Card title="Stale context" icon={<Activity className="h-4 w-4" />}>
          <p className="font-mono text-h1 text-eco-warning">{stale}</p>
          <p className="text-meta text-eco-muted">Operational attention, not enforcement</p>
        </Card>
      </div>

      <Card title="State monitoring coverage" subtitle={`Generated ${overview.generatedAt}`}>
        <DataTable columns={[{ key: 'state', header: 'State' }, { key: 'facilities', header: 'Facilities' }, { key: 'current', header: 'Current' }, { key: 'stale', header: 'Stale' }, { key: 'unavailable', header: 'Unavailable' }]}
          rows={overview.states.map((state) => [stateNames[state.stateCode] ?? state.stateCode, state.facilityCount, state.currentFacilityCount, state.staleFacilityCount, state.unavailableFacilityCount])}
          empty={<EmptyState title="No state summaries" body="The ministry API returned no published facilities." />} />
      </Card>

      <Card title="Source health" icon={<Database className="h-4 w-4" />}>
        <DataTable dense columns={[{ key: 'source', header: 'Source' }, { key: 'status', header: 'Status' }, { key: 'success', header: 'Last success' }, { key: 'failures', header: 'Failed runs' }]}
          rows={overview.sourceHealth.map((source) => [<div key="source"><p>{source.provider}</p><p className="font-mono text-micro text-eco-muted">{source.sourceId}</p></div>, statusBadge(source.status), source.lastSuccessAt ?? 'Never', source.failedRunCount])}
          empty={<EmptyState title="No source health records" />} />
      </Card>

      <Card title="Prioritized freshness queue" subtitle="Unavailable and stale context is listed first; this does not trigger automatic enforcement.">
        <DataTable dense columns={[{ key: 'facility', header: 'Facility' }, { key: 'metric', header: 'Metric' }, { key: 'status', header: 'Status' }, { key: 'reason', header: 'Reason' }]}
          rows={overview.freshnessQueue.map((item) => [<div key="facility"><p>{item.facilityName}</p><p className="text-micro text-eco-muted">{item.stateCode}</p></div>, item.metric, queueBadge(item.status), item.reason])}
          empty={<EmptyState title="No facilities require attention" />} />
      </Card>
    </div>
  );
}
