import { describe, it, expect, beforeEach } from 'vitest';
import { evidenceService } from './evidence';

describe('evidenceService', () => {
  beforeEach(() => {
    evidenceService.resetMocks();
  });

  it('retrieves evidence artifacts and preserves metadata', async () => {
    const artifacts = await evidenceService.getArtifacts('proj-pune-hyperscale');
    expect(artifacts.length).toBeGreaterThanOrEqual(3);
    const sanction = artifacts.find((a) => a.document_type === 'UTILITY_SANCTION');
    expect(sanction).toBeDefined();
    expect(sanction?.filename).toContain('MSEDCL_Grid_Sanction');
    expect(sanction?.synthetic_demo).toBe(true);
  });

  it('uploads a new artifact and prepends to the collection', async () => {
    const mockFile = new File(['mock content'], 'CEA_Clearance.pdf', { type: 'application/pdf' });
    const uploaded = await evidenceService.uploadArtifact('proj-pune-hyperscale', mockFile, {
      document_type: 'PLANNING',
      issuer: 'State Environmental Directorate',
      reference: 'ENV/2026/09',
    });

    expect(uploaded.id).toBeDefined();
    expect(uploaded.filename).toBe('CEA_Clearance.pdf');
    expect(uploaded.document_type).toBe('PLANNING');

    const all = await evidenceService.getArtifacts('proj-pune-hyperscale');
    expect(all[0].id).toBe(uploaded.id);
  });

  it('retrieves assertions with appropriate status vocabulary', async () => {
    const assertions = await evidenceService.getAssertions('proj-pune-hyperscale');
    expect(assertions.length).toBeGreaterThanOrEqual(4);

    const verified = assertions.find((a) => a.status === 'VERIFIED_WITHIN_SCOPE');
    expect(verified).toBeDefined();
    expect(verified?.field_key).toBe('sanctioned_grid_mw');

    const conflict = assertions.find((a) => a.status === 'CONFLICTING');
    expect(conflict).toBeDefined();
    expect(conflict?.field_key).toBe('peak_summer_water_kld');
  });

  it('reviews an assertion and advances revision', async () => {
    const updated = await evidenceService.reviewAssertion({
      assertion_id: 'asrt-002',
      decision: 'VERIFIED_WITHIN_SCOPE',
      reviewer_role: 'CONSULTANT',
      notes: 'Verified against DPR rev 2 page 14 load table.',
    });

    expect(updated.status).toBe('VERIFIED_WITHIN_SCOPE');
    expect(updated.revision).toBe(2);
  });

  it('reviews extraction candidates and supports manual adjustments', async () => {
    const extractions = await evidenceService.getExtractions('art-003');
    expect(extractions.length).toBe(1);
    expect(extractions[0].review_status).toBe('PENDING');

    const accepted = await evidenceService.confirmExtraction('ext-003', 'ACCEPTED', 2800);
    expect(accepted.review_status).toBe('ACCEPTED');
    expect(accepted.normalized_value).toBe(2800);
  });
});
