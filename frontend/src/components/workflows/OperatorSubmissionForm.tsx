import { useState, type FormEvent } from 'react';
import { LockKeyhole, Plus, Trash2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Field, Input, Select } from '../ui/Field';
import { InlineAlert } from '../ui/StateViews';
import type { PublicCapacityDisclosure } from '../../types/publicFacilities';
import type { SubmissionEvidence } from '../../types/submissions';
import type { RestrictedSubmission, SubmissionDraftInput, WorkflowFacilityType, WorkflowStateCode } from './types';
import { RestrictedPointPicker } from './RestrictedPointPicker';

interface Props {
  submission?: RestrictedSubmission | null;
  busy?: boolean;
  onCreate: (input: SubmissionDraftInput) => void | Promise<void>;
  onSubmitForReview: (submission: RestrictedSubmission) => void | Promise<void>;
}

const initial: SubmissionDraftInput = {
  facilityName: '', operatorOrganisationId: 'org_demo_operator', facilityType: 'colocation', stateCode: 'IN-MH', city: '', locality: '',
  exactGeometry: { type: 'Point', coordinates: [72.8777, 19.076] }, capacityDisclosures: [], evidence: [],
};
const newCapacity = (): PublicCapacityDisclosure => ({ value: 0, unit: 'MW', capacityType: 'it_load', scope: 'facility' });
const newEvidence = (): SubmissionEvidence => ({ evidenceType: 'source_url', title: '', reference: '' });
const isValidUrl = (value: string) => { try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; } };
const reviewReady = (submission: RestrictedSubmission) => Boolean(
  submission.facilityName.trim() && submission.city.trim() && submission.locality.trim()
  && Number.isFinite(submission.exactGeometry.coordinates[0]) && Math.abs(submission.exactGeometry.coordinates[0]) <= 180
  && Number.isFinite(submission.exactGeometry.coordinates[1]) && Math.abs(submission.exactGeometry.coordinates[1]) <= 90
  && submission.capacityDisclosures.some((item) => item.value > 0 && item.scope.trim())
  && submission.evidence.some((item) => item.title.trim() && item.reference.trim() && (item.evidenceType !== 'source_url' || isValidUrl(item.reference)))
);

export function OperatorSubmissionForm({ submission, busy = false, onCreate, onSubmitForReview }: Props) {
  const [draft, setDraft] = useState<SubmissionDraftInput>(() => submission ? {
    facilityName: submission.facilityName, operatorOrganisationId: submission.operatorOrganisationId,
    facilityType: submission.facilityType, stateCode: submission.stateCode, city: submission.city,
    locality: submission.locality, exactGeometry: submission.exactGeometry,
    capacityDisclosures: submission.capacityDisclosures, evidence: submission.evidence,
  } : initial);
  const update = <K extends keyof SubmissionDraftInput>(key: K, value: SubmissionDraftInput[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const coordinate = (index: 0 | 1, value: string) => {
    const number = Number(value);
    const next: [number, number] = [...draft.exactGeometry.coordinates];
    next[index] = Number.isFinite(number) ? number : 0;
    update('exactGeometry', { type: 'Point', coordinates: next });
  };
  const capacities = draft.capacityDisclosures ?? [];
  const evidence = draft.evidence ?? [];
  const updateCapacity = (index: number, patch: Partial<PublicCapacityDisclosure>) => update('capacityDisclosures', capacities.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  const updateEvidence = (index: number, patch: Partial<SubmissionEvidence>) => update('evidence', evidence.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  const save = (event: FormEvent) => { event.preventDefault(); void onCreate({ ...draft, capacityDisclosures: capacities, evidence }); };
  const canSubmit = Boolean(submission && ['draft', 'information_requested'].includes(submission.status));
  const isReady = Boolean(submission && reviewReady(submission));

  return (
    <div className="space-y-4">
      <InlineAlert tone="warning" title="Restricted exact location">
        The point below is visible only to the submitting operator and authorized ministry reviewers. Public publication uses a separate generalized location.
      </InlineAlert>
      <form onSubmit={save} className="space-y-4">
        <Card title="Facility identity" subtitle="Registration creates an operator declaration, not government verification.">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Facility name" htmlFor="facility-name" required><Input id="facility-name" value={draft.facilityName} onChange={(e) => update('facilityName', e.target.value)} /></Field>
            <Field label="Operator organisation ID" htmlFor="operator-org" required><Input id="operator-org" value={draft.operatorOrganisationId} onChange={(e) => update('operatorOrganisationId', e.target.value)} /></Field>
            <Field label="Data-centre type" htmlFor="facility-type" required><Select id="facility-type" value={draft.facilityType} onChange={(e) => update('facilityType', e.target.value as WorkflowFacilityType)}>{['colocation','hyperscale','enterprise','edge','government','other'].map((value) => <option key={value} value={value}>{value}</option>)}</Select></Field>
            <Field label="State" htmlFor="facility-state" required><Select id="facility-state" value={draft.stateCode} onChange={(e) => update('stateCode', e.target.value as WorkflowStateCode)}><option value="IN-MH">Maharashtra</option><option value="IN-TG">Telangana</option><option value="IN-KA">Karnataka</option><option value="IN-TN">Tamil Nadu</option></Select></Field>
            <Field label="City" htmlFor="facility-city" required><Input id="facility-city" value={draft.city} onChange={(e) => update('city', e.target.value)} /></Field>
            <Field label="Locality" htmlFor="facility-locality" required><Input id="facility-locality" value={draft.locality} onChange={(e) => update('locality', e.target.value)} /></Field>
          </div>
        </Card>

        <Card title="Exact campus point" icon={<LockKeyhole className="h-4 w-4" />} subtitle="Restricted Point geometry. Map clicks and numeric inputs update the same private field.">
          <RestrictedPointPicker value={draft.exactGeometry} onChange={(value) => update('exactGeometry', value)} disabled={busy} />
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Longitude" htmlFor="exact-longitude" required><Input id="exact-longitude" type="number" min="-180" max="180" step="any" value={draft.exactGeometry.coordinates[0]} onChange={(e) => coordinate(0, e.target.value)} /></Field>
            <Field label="Latitude" htmlFor="exact-latitude" required><Input id="exact-latitude" type="number" min="-90" max="90" step="any" value={draft.exactGeometry.coordinates[1]} onChange={(e) => coordinate(1, e.target.value)} /></Field>
          </div>
        </Card>

        <Card title="Capacity disclosures" subtitle="Add at least one public capacity claim and keep its measurement boundary explicit.">
          <div className="space-y-3">
            {capacities.map((item, index) => <div key={index} className="grid gap-2 rounded-sm border border-eco-border p-3 md:grid-cols-[1fr_1fr_1fr_1.5fr_auto]">
              <Field label="Capacity type" htmlFor={`capacity-type-${index}`}><Select id={`capacity-type-${index}`} value={item.capacityType} onChange={(e) => updateCapacity(index, { capacityType: e.target.value as PublicCapacityDisclosure['capacityType'] })}><option value="it_load">IT load</option><option value="total_power">Total power</option><option value="power_capacity">Power capacity</option><option value="power_capacity_unspecified">Power capacity (boundary unspecified)</option></Select></Field>
              <Field label="Value" htmlFor={`capacity-value-${index}`}><Input id={`capacity-value-${index}`} type="number" min="0.001" step="any" value={item.value || ''} onChange={(e) => updateCapacity(index, { value: Number(e.target.value) })} /></Field>
              <Field label="Unit" htmlFor={`capacity-unit-${index}`}><Select id={`capacity-unit-${index}`} value={item.unit} onChange={(e) => updateCapacity(index, { unit: e.target.value as 'MW' | 'MVA' })}><option value="MW">MW</option><option value="MVA">MVA</option></Select></Field>
              <Field label="Measurement scope" htmlFor={`capacity-scope-${index}`}><Input id={`capacity-scope-${index}`} value={item.scope} onChange={(e) => updateCapacity(index, { scope: e.target.value })} placeholder="facility, building or phase" /></Field>
              <Button type="button" variant="ghost" className="self-end" aria-label={`Remove capacity disclosure ${index + 1}`} onClick={() => update('capacityDisclosures', capacities.filter((_, itemIndex) => itemIndex !== index))}><Trash2 className="h-4 w-4" /></Button>
            </div>)}
            {!capacities.length && <p className="text-body text-eco-muted">No capacity disclosure added. The draft can be saved, but it cannot enter ministry review.</p>}
            <Button type="button" variant="secondary" onClick={() => update('capacityDisclosures', [...capacities, newCapacity()])}><Plus className="mr-1 h-4 w-4" />Add capacity disclosure</Button>
          </div>
        </Card>

        <Card title="Supporting evidence" subtitle="Add at least one traceable public URL or document reference for ministry review.">
          <div className="space-y-3">
            {evidence.map((item, index) => <div key={index} className="grid gap-2 rounded-sm border border-eco-border p-3 md:grid-cols-[1fr_1.2fr_2fr_auto]">
              <Field label="Evidence type" htmlFor={`evidence-type-${index}`}><Select id={`evidence-type-${index}`} value={item.evidenceType} onChange={(e) => updateEvidence(index, { evidenceType: e.target.value as SubmissionEvidence['evidenceType'] })}><option value="source_url">Source URL</option><option value="document_reference">Document reference</option></Select></Field>
              <Field label="Title" htmlFor={`evidence-title-${index}`}><Input id={`evidence-title-${index}`} value={item.title} onChange={(e) => updateEvidence(index, { title: e.target.value })} /></Field>
              <Field label={item.evidenceType === 'source_url' ? 'Public source URL' : 'Document reference'} htmlFor={`evidence-reference-${index}`}><Input id={`evidence-reference-${index}`} type={item.evidenceType === 'source_url' ? 'url' : 'text'} value={item.reference} onChange={(e) => updateEvidence(index, { reference: e.target.value })} placeholder={item.evidenceType === 'source_url' ? 'https://operator.example/facility' : 'Document ID or filing reference'} /></Field>
              <Button type="button" variant="ghost" className="self-end" aria-label={`Remove evidence ${index + 1}`} onClick={() => update('evidence', evidence.filter((_, itemIndex) => itemIndex !== index))}><Trash2 className="h-4 w-4" /></Button>
            </div>)}
            {!evidence.length && <p className="text-body text-eco-muted">No evidence added. The draft can be saved, but it cannot enter ministry review.</p>}
            <Button type="button" variant="secondary" onClick={() => update('evidence', [...evidence, newEvidence()])}><Plus className="mr-1 h-4 w-4" />Add evidence</Button>
          </div>
        </Card>

        {submission && canSubmit && !isReady && <InlineAlert tone="warning" title="Review requirements incomplete">Save a revision containing at least one positive capacity disclosure and one traceable evidence reference before submitting for ministry review.</InlineAlert>}
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={busy}>{submission ? 'Save new revision' : 'Create private draft'}</Button>
          {canSubmit && <Button type="button" variant="secondary" disabled={busy || !isReady} onClick={() => submission && void onSubmitForReview(submission)}>Submit for ministry review</Button>}
          {submission && <span className="font-mono text-meta text-eco-muted">Status {submission.status} · revision {submission.revision}</span>}
        </div>
      </form>
    </div>
  );
}
