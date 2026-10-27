import { afterEach, expect, it, vi } from 'vitest';
import { assessProposedSite, type SiteAssessmentRequest } from './siteAssessments';
import { apiClient } from './api';
const request: SiteAssessmentRequest = { cityId: 'pune', name: 'Candidate', type: 'data_centre', longitude: 73.86, latitude: 18.52, capacityMw: 100, waterDemandKld: 0, powerDemandMw: 100 };
afterEach(() => vi.restoreAllMocks());
it('forwards cancellation separately from the unchanged request body', async () => {
  const response = await assessProposedSite(request);
  const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: response });
  const controller = new AbortController();
  expect(await assessProposedSite(request, 'api', controller.signal)).toBe(response);
  expect(post).toHaveBeenCalledWith('/site-assessments', request, { signal: controller.signal });
});
it('propagates API failures without creating a successful demo assessment', async () => {
  const failure = new Error('Backend unavailable');
  vi.spyOn(apiClient, 'post').mockRejectedValue(failure);
  await expect(assessProposedSite(request, 'api')).rejects.toBe(failure);
});
it('keeps missing environmental evidence unavailable in demo mode', async () => {
  expect(await assessProposedSite(request)).toMatchObject({ name: 'Candidate', suitabilityScore: null, suitabilityStatus: 'Insufficient data', groundwaterZone: 'Unavailable', protectedAreaDistanceKm: null, population5km: null });
});
