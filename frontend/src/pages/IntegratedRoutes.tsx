import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { ErrorState, LoadingSkeleton } from '../components/ui/StateViews';
import { PageShell } from '../components/ui/PageHeader';
import type { ReviewAction } from '../components/workflows/types';
import { getFacilityEnvironmentalCurrent, getFacilityEnvironmentalRange } from '../services/environmentalMonitoring';
import { getMinistryOverview } from '../services/ministryOperations';
import { getPublicFacility } from '../services/publicFacilities';
import { apiErrorMessage } from '../services/api';
import { applyReviewAction, createSubmission, getReviewQueue, getReviewSubmission, reviseSubmission, submitForReview } from '../services/submissions';
import type { EnvironmentalMetricKey, EnvironmentalRange } from '../types/environmentalMonitoring';
import type { PublicFacility } from '../types/publicFacilities';
import type { FacilitySubmission, SubmissionCreate } from '../types/submissions';
import { MinistryDashboard } from './MinistryDashboard';
import { MinistryReview } from './MinistryReview';
import { OperatorRegistration } from './OperatorRegistration';
import { PublicFacilityDetail } from './PublicFacilityDetail';

const CURRENT_METRICS: EnvironmentalMetricKey[] = ['aqi', 'pm25', 'temperature', 'relative_humidity', 'rainfall', 'groundwater_depth'];

export function PublicFacilityDetailRoute() {
  const { facilityId = '' } = useParams();
  const navigate = useNavigate();
  const [range, setRange] = useState<EnvironmentalRange>('24h');
  const facility = useQuery({ queryKey: ['public-facility', facilityId], queryFn: () => getPublicFacility(facilityId), enabled: Boolean(facilityId), retry: false });
  const current = useQuery({ queryKey: ['facility-environment-current', facilityId], queryFn: () => getFacilityEnvironmentalCurrent(facilityId, CURRENT_METRICS), enabled: Boolean(facility.data), retry: false });
  const trend = useQuery({ queryKey: ['facility-environment-range', facilityId, range], queryFn: () => getFacilityEnvironmentalRange(facilityId, { metrics: CURRENT_METRICS, range }), enabled: Boolean(facility.data), retry: false });
  if (facility.isLoading) return <PageShell><LoadingSkeleton rows={6} /></PageShell>;
  if (facility.error || !facility.data) return <PageShell><ErrorState title="Facility profile unavailable" cause={apiErrorMessage(facility.error, 'The public facility could not be loaded.')} onRetry={() => void facility.refetch()} /></PageShell>;
  return <PublicFacilityDetail facility={facility.data} current={current.data ?? null} trend={trend.data ?? null} range={range} onRangeChange={setRange} onBack={() => navigate('/public-facilities')} currentLoading={current.isLoading} trendLoading={trend.isLoading} />;
}

export function MinistryDashboardRoute() {
  const overview = useQuery({ queryKey: ['ministry-overview'], queryFn: () => getMinistryOverview(100), retry: false });
  return <MinistryDashboard overview={overview.data} loading={overview.isLoading} error={overview.error ? apiErrorMessage(overview.error, 'Ministry overview is unavailable.') : undefined} onRetry={() => void overview.refetch()} />;
}

export function OperatorRegistrationRoute() {
  const [submission, setSubmission] = useState<FacilitySubmission | null>(null);
  const mutation = useMutation({ mutationFn: async ({ input, current }: { input: SubmissionCreate; current: FacilitySubmission | null }) => current
    ? reviseSubmission(current.id, { expectedRevision: current.revision, facilityName: input.facilityName, facilityType: input.facilityType, stateCode: input.stateCode, city: input.city, locality: input.locality, exactGeometry: input.exactGeometry })
    : createSubmission(input), onSuccess: setSubmission });
  const submit = useMutation({ mutationFn: (current: FacilitySubmission) => submitForReview(current.id, current.revision), onSuccess: setSubmission });
  return <OperatorRegistration submission={submission} busy={mutation.isPending || submit.isPending} error={mutation.error || submit.error ? apiErrorMessage(mutation.error ?? submit.error, 'The private submission could not be saved.') : undefined} onSave={async (input, current) => { await mutation.mutateAsync({ input, current: current ?? null }); }} onSubmitForReview={async (current) => { await submit.mutateAsync(current); }} />;
}

const stateNames = { 'IN-MH': 'Maharashtra', 'IN-TG': 'Telangana', 'IN-KA': 'Karnataka', 'IN-TN': 'Tamil Nadu' } as const;
const dateOnly = (date: Date) => date.toISOString().slice(0, 10);

function publicPreview(submission: FacilitySubmission | undefined): PublicFacility | null {
  if (!submission) return null;
  const verifiedAt = new Date();
  const expiresAt = new Date(verifiedAt); expiresAt.setUTCDate(expiresAt.getUTCDate() + 89);
  return {
    id: `registered-${submission.id.toLowerCase().replaceAll('_', '-').replace(/[^a-z0-9-]/g, '')}`,
    name: submission.facilityName,
    operator: submission.operatorOrganisationId,
    ownershipCategory: 'private', facilityType: submission.facilityType,
    stateCode: submission.stateCode, state: stateNames[submission.stateCode], city: submission.city, locality: submission.locality,
    publicCoordinates: submission.exactGeometry.coordinates.map((value) => Number(value.toFixed(3))) as [number, number],
    locationPrecision: 'locality', operationalSince: new Date().getUTCFullYear(), capacityDisclosures: submission.capacityDisclosures,
    verification: { status: 'government_verified', verifiedAt: dateOnly(verifiedAt), expiresAt: dateOnly(expiresAt), source: { title: 'Reviewed operator submission', publisher: 'EcoSite Ministry Reviewer', url: `http://localhost/reviews/${encodeURIComponent(submission.id)}`, sourceClass: 'government', retrievedAt: dateOnly(verifiedAt) } },
  };
}

export function MinistryReviewRoute() {
  const client = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const queue = useQuery({ queryKey: ['ministry-review-queue'], queryFn: () => getReviewQueue(), retry: false });
  const selected = useQuery({ queryKey: ['ministry-review-detail', selectedId], queryFn: () => getReviewSubmission(selectedId as string), enabled: Boolean(selectedId), retry: false });
  const action = useMutation({ mutationFn: ({ submission, review }: { submission: FacilitySubmission; review: ReviewAction }) => applyReviewAction(submission.id, { expectedRevision: submission.revision, ...review }), onSuccess: async () => { await client.invalidateQueries({ queryKey: ['ministry-review-queue'] }); await client.invalidateQueries({ queryKey: ['ministry-review-detail', selectedId] }); } });
  const preview = useMemo(() => publicPreview(selected.data), [selected.data]);
  return <MinistryReview queue={queue.data?.items ?? []} selected={selected.data ?? null} publicPreview={preview} busy={action.isPending} loading={queue.isLoading || selected.isLoading} error={queue.error || selected.error || action.error ? apiErrorMessage(queue.error ?? selected.error ?? action.error, 'The review workflow is unavailable.') : undefined} onRetry={() => void queue.refetch()} onSelect={setSelectedId} onAction={async (submission, review) => { await action.mutateAsync({ submission, review }); }} />;
}
