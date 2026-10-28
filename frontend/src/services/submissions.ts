import { apiClient } from './api';
import { DEMO_MINISTRY_HEADERS, DEMO_OPERATOR_HEADERS } from './demoIdentity';
import type {
  FacilitySubmission,
  ReviewActionRequest,
  ReviewQueue,
  ReviewResult,
  SubmissionCreate,
  SubmissionPatch,
  SubmissionStatus,
} from '../types/submissions';

const operatorConfig = { headers: DEMO_OPERATOR_HEADERS };
const ministryConfig = { headers: DEMO_MINISTRY_HEADERS };

export const createSubmission = async (body: SubmissionCreate): Promise<FacilitySubmission> =>
  (await apiClient.post<FacilitySubmission>('/operator/facility-submissions', body, operatorConfig)).data;

export const getOperatorSubmission = async (submissionId: string): Promise<FacilitySubmission> =>
  (await apiClient.get<FacilitySubmission>(`/operator/facility-submissions/${encodeURIComponent(submissionId)}`, operatorConfig)).data;

export const reviseSubmission = async (submissionId: string, body: SubmissionPatch): Promise<FacilitySubmission> =>
  (await apiClient.patch<FacilitySubmission>(`/operator/facility-submissions/${encodeURIComponent(submissionId)}`, body, operatorConfig)).data;

export const submitForReview = async (submissionId: string, expectedRevision: number): Promise<FacilitySubmission> =>
  (await apiClient.post<FacilitySubmission>(`/operator/facility-submissions/${encodeURIComponent(submissionId)}/submit`, { expectedRevision }, operatorConfig)).data;

export async function getReviewQueue(options: { statuses?: SubmissionStatus[]; page?: number; pageSize?: number } = {}): Promise<ReviewQueue> {
  const params: Record<string, string[] | number> = { page: options.page ?? 1, pageSize: options.pageSize ?? 50 };
  if (options.statuses?.length) params.status = options.statuses;
  return (await apiClient.get<ReviewQueue>('/ministry/facility-submissions', { ...ministryConfig, params })).data;
}

export const getReviewSubmission = async (submissionId: string): Promise<FacilitySubmission> =>
  (await apiClient.get<FacilitySubmission>(`/ministry/facility-submissions/${encodeURIComponent(submissionId)}`, ministryConfig)).data;

export const applyReviewAction = async (submissionId: string, body: ReviewActionRequest): Promise<ReviewResult> =>
  (await apiClient.post<ReviewResult>(`/ministry/facility-submissions/${encodeURIComponent(submissionId)}/actions`, body, ministryConfig)).data;
