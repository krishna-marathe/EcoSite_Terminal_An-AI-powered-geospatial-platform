import { useState } from 'react';
import { CheckCircle2, LockKeyhole, XCircle } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Field, Input, Textarea } from '../ui/Field';
import { EmptyState, InlineAlert } from '../ui/StateViews';
import type { PublicSnapshotPreview, RestrictedSubmission, ReviewAction, ReviewQueueItem } from './types';

interface Props {
  queue: ReviewQueueItem[];
  selected: RestrictedSubmission | null;
  publicPreview: PublicSnapshotPreview | null;
  busy?: boolean;
  onSelect: (id: string) => void;
  onAction: (submission: RestrictedSubmission, action: ReviewAction) => void | Promise<void>;
}

export function MinistryReviewWorkspace({ queue, selected, publicPreview, busy = false, onSelect, onAction }: Props) {
  const [reason, setReason] = useState('');
  const [requestedFields, setRequestedFields] = useState('capacityDisclosures');
  if (!queue.length && !selected) return <Card><EmptyState title="No submissions awaiting review" body="New operator submissions will appear here without exact coordinates in the queue." /></Card>;
  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <Card title="Review queue" subtitle="Exact geometry is intentionally excluded.">
        <div className="space-y-2">
          {queue.map((item) => <button key={item.id} type="button" onClick={() => onSelect(item.id)} className="w-full rounded-sm border border-eco-border bg-eco-surface-secondary p-3 text-left hover:border-eco-primary/40"><div className="flex justify-between gap-2"><span className="font-medium text-eco-text">{item.facilityName}</span><Badge variant="outline" size="xs">{item.status}</Badge></div><p className="text-meta text-eco-muted">{item.city} · {item.stateCode}</p><p className="font-mono text-micro text-eco-muted">Revision {item.revision}</p></button>)}
        </div>
      </Card>
      {!selected ? <Card><EmptyState title="Select a submission" body="Restricted detail loads only after an authorized reviewer selects a queue record." /></Card> : (
        <div className="space-y-4">
          <InlineAlert tone="warning" title="Restricted ministry view"><LockKeyhole className="mr-1 inline h-3.5 w-3.5" />This detail contains the exact operator-submitted point. Do not copy it into the public snapshot.</InlineAlert>
          <Card title={selected.facilityName} subtitle={`${selected.operatorOrganisationId} · revision ${selected.revision}`}>
            <dl className="grid gap-3 text-meta sm:grid-cols-2"><div><dt className="text-eco-muted">Status</dt><dd>{selected.status}</dd></div><div><dt className="text-eco-muted">Location</dt><dd>{selected.locality}, {selected.city}</dd></div><div><dt className="text-eco-muted">Exact longitude</dt><dd className="font-mono">{selected.exactGeometry.coordinates[0]}</dd></div><div><dt className="text-eco-muted">Exact latitude</dt><dd className="font-mono">{selected.exactGeometry.coordinates[1]}</dd></div></dl>
          </Card>
          {publicPreview && <Card title="Generalized public snapshot preview" subtitle="This is the only location representation proposed for publication."><dl className="grid gap-3 text-meta sm:grid-cols-2"><div><dt className="text-eco-muted">Public facility</dt><dd>{publicPreview.name}</dd></div><div><dt className="text-eco-muted">Generalized location</dt><dd>{publicPreview.locality}, {publicPreview.state}</dd></div><div><dt className="text-eco-muted">Public longitude</dt><dd className="font-mono">{publicPreview.publicCoordinates[0]}</dd></div><div><dt className="text-eco-muted">Public latitude</dt><dd className="font-mono">{publicPreview.publicCoordinates[1]}</dd></div></dl><p className="mt-3 text-meta text-eco-muted">Verification expires {publicPreview.verification.expiresAt}. Approval publishes an immutable snapshot and does not validate every private claim.</p></Card>}
          <Card title="Review decision">
            <div className="space-y-3"><Field label="Decision reason" htmlFor="review-reason" required><Textarea id="review-reason" value={reason} onChange={(e) => setReason(e.target.value)} /></Field><Field label="Requested fields" htmlFor="requested-fields" hint="Comma-separated fields used only for information requests."><Input id="requested-fields" value={requestedFields} onChange={(e) => setRequestedFields(e.target.value)} /></Field><div className="flex flex-wrap gap-2"><Button type="button" variant="secondary" disabled={busy || !reason.trim()} onClick={() => void onAction(selected, { action: 'request_information', reason, requestedFields: requestedFields.split(',').map((v) => v.trim()).filter(Boolean) })}>Request information</Button><Button type="button" variant="danger" disabled={busy || !reason.trim()} onClick={() => void onAction(selected, { action: 'reject', reason })}><XCircle className="h-3.5 w-3.5" />Reject</Button><Button type="button" disabled={busy || !reason.trim() || !publicPreview} onClick={() => publicPreview && void onAction(selected, { action: 'approve', reason, publicSnapshot: publicPreview })}><CheckCircle2 className="h-3.5 w-3.5" />Approve and publish</Button></div></div>
          </Card>
        </div>
      )}
    </div>
  );
}
