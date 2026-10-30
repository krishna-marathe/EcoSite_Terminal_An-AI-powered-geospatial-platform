import { PageHeader, PageShell } from '../components/ui/PageHeader';
import { DemoIdentityBanner } from '../components/workflows/DemoIdentityBanner';
import { OperatorSubmissionForm } from '../components/workflows/OperatorSubmissionForm';
import { InlineAlert } from '../components/ui/StateViews';
import type { RestrictedSubmission, SubmissionDraftInput } from '../components/workflows/types';

export interface OperatorRegistrationProps { submission?: RestrictedSubmission | null; busy?: boolean; error?: string; onSave?: (input: SubmissionDraftInput, current?: RestrictedSubmission | null) => void | Promise<void>; onSubmitForReview?: (submission: RestrictedSubmission) => void | Promise<void> }
export function OperatorRegistration({ submission, busy, error, onSave = () => undefined, onSubmitForReview = () => undefined }: OperatorRegistrationProps) {
  return <PageShell><PageHeader eyebrow="Restricted operator workspace" title="Register a data centre" purpose="Create a private operator declaration and submit evidence for ministry review." /><DemoIdentityBanner role="operator" />{error && <InlineAlert tone="critical" title="Submission unavailable">{error}</InlineAlert>}<OperatorSubmissionForm key={`${submission?.id ?? 'new'}:${submission?.revision ?? 0}`} submission={submission} busy={busy} onCreate={(input) => onSave(input, submission)} onSubmitForReview={onSubmitForReview} /></PageShell>;
}
