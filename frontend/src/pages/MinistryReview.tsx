import { PageHeader, PageShell } from '../components/ui/PageHeader';
import { DemoIdentityBanner } from '../components/workflows/DemoIdentityBanner';
import { MinistryReviewWorkspace } from '../components/workflows/MinistryReviewWorkspace';
import { ErrorState, LoadingSkeleton } from '../components/ui/StateViews';
import type { PublicSnapshotPreview, RestrictedSubmission, ReviewAction, ReviewQueueItem } from '../components/workflows/types';

export interface MinistryReviewProps { queue?: ReviewQueueItem[]; selected?: RestrictedSubmission | null; publicPreview?: PublicSnapshotPreview | null; busy?: boolean; loading?: boolean; error?: string; onRetry?: () => void; onSelect?: (id: string) => void; onAction?: (submission: RestrictedSubmission, action: ReviewAction) => void | Promise<void> }
export function MinistryReview({ queue = [], selected = null, publicPreview = null, busy, loading, error, onRetry, onSelect = () => undefined, onAction = () => undefined }: MinistryReviewProps) {
  return <PageShell><PageHeader eyebrow="Restricted ministry workspace" title="Facility registration review" purpose="Review private operator declarations and publish only approved, generalized public snapshots." /><DemoIdentityBanner role="ministry_reviewer" />{loading ? <LoadingSkeleton rows={5} /> : error ? <ErrorState title="Review workflow unavailable" cause={error} onRetry={onRetry} /> : <MinistryReviewWorkspace key={selected?.id ?? 'none'} queue={queue} selected={selected} publicPreview={publicPreview} busy={busy} onSelect={onSelect} onAction={onAction} />}</PageShell>;
}
