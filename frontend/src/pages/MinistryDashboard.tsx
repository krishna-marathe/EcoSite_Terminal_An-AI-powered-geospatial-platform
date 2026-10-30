import { PageHeader, PageShell } from '../components/ui/PageHeader';
import { ErrorState, LoadingSkeleton } from '../components/ui/StateViews';
import { DemoIdentityBanner } from '../components/workflows/DemoIdentityBanner';
import { MinistryOperationsPanel } from '../components/workflows/MinistryOperationsPanel';
import type { MinistryOverviewData } from '../components/workflows/types';

export interface MinistryDashboardProps { overview?: MinistryOverviewData; loading?: boolean; error?: string; onRetry?: () => void }
export function MinistryDashboard({ overview, loading = false, error, onRetry }: MinistryDashboardProps) {
  return <PageShell><PageHeader eyebrow="Restricted ministry workspace" title="Data-centre operations" purpose="Monitor registry coverage, source health and freshness signals across the four target states." /><DemoIdentityBanner role="ministry_reviewer" />{loading ? <LoadingSkeleton variant="tiles" rows={3} /> : error || !overview ? <ErrorState title="Ministry overview unavailable" cause={error ?? 'Connect the ministry operations service.'} onRetry={onRetry} /> : <MinistryOperationsPanel overview={overview} />}</PageShell>;
}
