import { useState, type FormEvent } from 'react';
import { LockKeyhole, MapPin } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Field, Input, Select } from '../ui/Field';
import { InlineAlert } from '../ui/StateViews';
import type { RestrictedSubmission, SubmissionDraftInput, WorkflowFacilityType, WorkflowStateCode } from './types';

interface Props {
  submission?: RestrictedSubmission | null;
  busy?: boolean;
  onCreate: (input: SubmissionDraftInput) => void | Promise<void>;
  onSubmitForReview: (submission: RestrictedSubmission) => void | Promise<void>;
}

const initial: SubmissionDraftInput = {
  facilityName: '', operatorOrganisationId: 'org_demo_operator', facilityType: 'colocation', stateCode: 'IN-MH', city: '', locality: '',
  exactGeometry: { type: 'Point', coordinates: [72.8777, 19.076] },
};

export function OperatorSubmissionForm({ submission, busy = false, onCreate, onSubmitForReview }: Props) {
  const [draft, setDraft] = useState<SubmissionDraftInput>(() => submission ? { facilityName: submission.facilityName, operatorOrganisationId: submission.operatorOrganisationId, facilityType: submission.facilityType, stateCode: submission.stateCode, city: submission.city, locality: submission.locality, exactGeometry: submission.exactGeometry } : initial);
  const update = <K extends keyof SubmissionDraftInput>(key: K, value: SubmissionDraftInput[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const coordinate = (index: 0 | 1, value: string) => {
    const number = Number(value);
    const next: [number, number] = [...draft.exactGeometry.coordinates];
    next[index] = Number.isFinite(number) ? number : 0;
    update('exactGeometry', { type: 'Point', coordinates: next });
  };
  const save = (event: FormEvent) => { event.preventDefault(); void onCreate(draft); };
  const canSubmit = submission && ['draft', 'information_requested'].includes(submission.status);

  return (
    <div className="space-y-4">
      <InlineAlert tone="warning" title="Restricted exact location">
        The coordinates below are visible only to the submitting operator and authorized ministry reviewers. Public publication uses a separate generalized location.
      </InlineAlert>
      <form onSubmit={save} className="space-y-4">
        <Card title="Facility identity" subtitle="Registration creates an operator declaration, not government verification.">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Facility name" htmlFor="facility-name" required><Input id="facility-name" value={draft.facilityName} onChange={(e) => update('facilityName', e.target.value)} required /></Field>
            <Field label="Operator organisation ID" htmlFor="operator-org" required><Input id="operator-org" value={draft.operatorOrganisationId} onChange={(e) => update('operatorOrganisationId', e.target.value)} required /></Field>
            <Field label="Facility type" htmlFor="facility-type"><Select id="facility-type" value={draft.facilityType} onChange={(e) => update('facilityType', e.target.value as WorkflowFacilityType)}>{['colocation','hyperscale','enterprise','edge','government','other'].map((value) => <option key={value} value={value}>{value}</option>)}</Select></Field>
            <Field label="State" htmlFor="facility-state"><Select id="facility-state" value={draft.stateCode} onChange={(e) => update('stateCode', e.target.value as WorkflowStateCode)}><option value="IN-MH">Maharashtra</option><option value="IN-TG">Telangana</option><option value="IN-KA">Karnataka</option><option value="IN-TN">Tamil Nadu</option></Select></Field>
            <Field label="City" htmlFor="facility-city" required><Input id="facility-city" value={draft.city} onChange={(e) => update('city', e.target.value)} required /></Field>
            <Field label="Locality" htmlFor="facility-locality" required><Input id="facility-locality" value={draft.locality} onChange={(e) => update('locality', e.target.value)} required /></Field>
          </div>
        </Card>
        <Card title="Exact campus point" icon={<LockKeyhole className="h-4 w-4" />} subtitle="Restricted Point geometry; a full map picker can replace these coordinate controls.">
          <div className="mb-3 flex h-28 items-center justify-center rounded-sm border border-dashed border-eco-border bg-eco-surface-secondary text-meta text-eco-muted"><MapPin className="mr-2 h-4 w-4" />Restricted map picker placeholder</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Longitude" htmlFor="exact-longitude" required><Input id="exact-longitude" type="number" step="any" value={draft.exactGeometry.coordinates[0]} onChange={(e) => coordinate(0, e.target.value)} /></Field>
            <Field label="Latitude" htmlFor="exact-latitude" required><Input id="exact-latitude" type="number" step="any" value={draft.exactGeometry.coordinates[1]} onChange={(e) => coordinate(1, e.target.value)} /></Field>
          </div>
        </Card>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={busy}>{submission ? 'Save new revision' : 'Create private draft'}</Button>
          {canSubmit && <Button type="button" variant="secondary" disabled={busy} onClick={() => void onSubmitForReview(submission)}>Submit for ministry review</Button>}
          {submission && <span className="font-mono text-meta text-eco-muted">Status {submission.status} · revision {submission.revision}</span>}
        </div>
      </form>
    </div>
  );
}
