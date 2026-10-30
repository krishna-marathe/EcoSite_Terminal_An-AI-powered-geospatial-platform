import { afterEach, expect, it, vi } from 'vitest';
import { apiClient } from './api';
import { DEMO_MINISTRY_HEADERS, DEMO_OPERATOR_HEADERS } from './demoIdentity';
import { applyReviewAction, createSubmission, getReviewQueue, reviseSubmission, submitForReview } from './submissions';
import type { SubmissionCreate } from '../types/submissions';

vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./api')>()),
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));
afterEach(() => vi.clearAllMocks());

const draft: SubmissionCreate = { facilityName: 'Campus', operatorOrganisationId: 'org-demo-operator', facilityType: 'colocation', stateCode: 'IN-MH', city: 'Mumbai', locality: 'Andheri', exactGeometry: { type: 'Point', coordinates: [72.8, 19.1] } };

it('uses fixed operator identity for create, revise, and submit', async () => {
  vi.mocked(apiClient.post).mockResolvedValue({ data: { ...draft, id: 'sub-1', status: 'draft', revision: 1 } });
  vi.mocked(apiClient.patch).mockResolvedValue({ data: { ...draft, id: 'sub-1', status: 'draft', revision: 2 } });
  await createSubmission(draft);
  await reviseSubmission('sub-1', { expectedRevision: 1, city: 'Pune' });
  await submitForReview('sub-1', 2);
  expect(apiClient.post).toHaveBeenNthCalledWith(1, '/operator/facility-submissions', draft, { headers: DEMO_OPERATOR_HEADERS });
  expect(apiClient.patch).toHaveBeenCalledWith('/operator/facility-submissions/sub-1', { expectedRevision: 1, city: 'Pune' }, { headers: DEMO_OPERATOR_HEADERS });
  expect(apiClient.post).toHaveBeenNthCalledWith(2, '/operator/facility-submissions/sub-1/submit', { expectedRevision: 2 }, { headers: DEMO_OPERATOR_HEADERS });
});

it('keeps review queue and actions behind ministry identity', async () => {
  vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { items: [], page: 1, pageSize: 50, total: 0 } });
  vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { submissionId: 'sub-1', status: 'rejected', revision: 4 } });
  await getReviewQueue({ statuses: ['submitted', 'resubmitted'] });
  await applyReviewAction('sub-1', { expectedRevision: 3, action: 'reject', reason: 'Insufficient evidence' });
  expect(apiClient.get).toHaveBeenCalledWith('/ministry/facility-submissions', { headers: DEMO_MINISTRY_HEADERS, params: { page: 1, pageSize: 50, status: ['submitted', 'resubmitted'] } });
  expect(apiClient.post).toHaveBeenCalledWith('/ministry/facility-submissions/sub-1/actions', { expectedRevision: 3, action: 'reject', reason: 'Insufficient evidence' }, { headers: DEMO_MINISTRY_HEADERS });
});
