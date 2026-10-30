import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  evidenceService,
  fileToBase64,
  MAX_FILE_SIZE_BYTES,
  setEvidenceMockMode,
} from './evidence';
import { apiClient } from './api';

describe('evidenceService', () => {
  beforeEach(() => {
    evidenceService.resetMocks();
    vi.restoreAllMocks();
  });

  describe('offline / mock mode', () => {
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

  describe('file validation and limits', () => {
    it('rejects files exceeding 25 MiB limit before attempting upload', async () => {
      const oversizeFile = new File(['x'], 'huge.pdf', { type: 'application/pdf' });
      Object.defineProperty(oversizeFile, 'size', { value: MAX_FILE_SIZE_BYTES + 1 });

      await expect(
        evidenceService.uploadArtifact('proj-1', oversizeFile, { document_type: 'DPR' })
      ).rejects.toThrow(/exceeds the maximum allowed limit of 25 MiB/i);
    });

    it('rejects files with unsupported formats', async () => {
      const unsupportedFile = new File(['dummy'], 'photo.png', { type: 'image/png' });

      await expect(
        evidenceService.uploadArtifact('proj-1', unsupportedFile, { document_type: 'OTHER' })
      ).rejects.toThrow(/Unsupported file format/i);
    });

    it('correctly converts file content to base64', async () => {
      const file = new File(['Hello EcoSite India'], 'test.txt', { type: 'text/plain' });
      const b64 = await fileToBase64(file);
      expect(typeof b64).toBe('string');
      expect(b64.length).toBeGreaterThan(0);
      // Decoded check
      expect(atob(b64)).toBe('Hello EcoSite India');
    });
  });

  describe('genuine API mode operations', () => {
    beforeEach(() => {
      setEvidenceMockMode(false); // Enable API mode
    });

    it('fetches artifacts from GET /projects/{id}/evidence and maps DTOs', async () => {
      const mockDto = [
        {
          id: 'art-real-001',
          project_id: 'proj-real',
          site_id: 'site-01',
          document_type: 'UTILITY_SANCTION',
          filename: 'Discom_Sanction.pdf',
          mime_type: 'application/pdf',
          file_size_bytes: 1048576,
          sha256: 'a'.repeat(64),
          issuer: 'TSTRANSCO',
          reference: 'TST/2026/01',
          issued_on: '2026-01-15',
          valid_until: '2028-01-14',
          visibility: 'PROJECT_TEAM',
          synthetic_demo: false,
          uploaded_by: 'engineer@ecosite',
          uploaded_at: '2026-10-25T10:00:00Z',
          notes: 'Formal sanction',
        },
      ];

      vi.spyOn(apiClient, 'get').mockResolvedValueOnce({ data: mockDto });

      const artifacts = await evidenceService.getArtifacts('proj-real');
      expect(apiClient.get).toHaveBeenCalledWith('/projects/proj-real/evidence');
      expect(artifacts.length).toBe(1);
      expect(artifacts[0].id).toBe('art-real-001');
      expect(artifacts[0].issuer).toBe('TSTRANSCO');
      expect(artifacts[0].synthetic_demo).toBe(false);
    });

    it('propagates error when GET /projects/{id}/evidence fails', async () => {
      vi.spyOn(apiClient, 'get').mockRejectedValueOnce({
        response: { status: 404, data: { detail: { message: 'Project not found.' } } },
      });

      await expect(evidenceService.getArtifacts('proj-nonexistent')).rejects.toThrow(
        'Project not found.'
      );
    });

    it('uploads artifact via base64 POST /evidence/upload and triggers /extract', async () => {
      const file = new File(['%PDF-1.4 simulated pdf'], 'Sanction_Letter.pdf', {
        type: 'application/pdf',
      });

      const mockArtifactDto = {
        id: 'art-new-123',
        project_id: 'proj-real',
        site_id: null,
        document_type: 'UTILITY_SANCTION',
        filename: 'Sanction_Letter.pdf',
        mime_type: 'application/pdf',
        file_size_bytes: file.size,
        sha256: 'b'.repeat(64),
        issuer: 'MSEDCL',
        reference: 'REF-99',
        issued_on: '2026-06-01',
        valid_until: '2029-05-31',
        visibility: 'PROJECT_TEAM',
        synthetic_demo: false,
        uploaded_by: 'local-user',
        uploaded_at: '2026-10-29T10:00:00Z',
      };

      const postSpy = vi.spyOn(apiClient, 'post').mockImplementation(async (url: string) => {
        if (url === '/projects/proj-real/evidence/upload') {
          return { data: mockArtifactDto };
        }
        if (url === '/evidence/art-new-123/extract') {
          return { data: { status: 'SUCCESS' } };
        }
        return { data: {} };
      });

      const created = await evidenceService.uploadArtifact('proj-real', file, {
        document_type: 'UTILITY_SANCTION',
        issuer: 'MSEDCL',
        reference: 'REF-99',
        valid_until: '2029-05-31',
      });

      expect(postSpy).toHaveBeenCalledWith(
        '/projects/proj-real/evidence/upload',
        expect.objectContaining({
          filename: 'Sanction_Letter.pdf',
          document_type: 'UTILITY_SANCTION',
          content_base64: expect.any(String),
          issuer: 'MSEDCL',
          reference: 'REF-99',
          synthetic_demo: false,
        })
      );

      expect(postSpy).toHaveBeenCalledWith('/evidence/art-new-123/extract');
      expect(created.id).toBe('art-new-123');
      expect(created.filename).toBe('Sanction_Letter.pdf');
    });

    it('fetches assertions from GET /projects/{id}/assertions and maps fields', async () => {
      const mockAssertionDto = [
        {
          id: 'asrt-real-1',
          project_id: 'proj-real',
          site_id: 'site-1',
          phase_id: 'phase-1',
          field_key: 'sanctioned_grid_mw',
          value: '50.0',
          numeric_value: 50.0,
          unit: 'MW',
          scope_type: 'PHASE',
          scope_detail: 'Phase 1 Grid Sanction',
          status: 'DOCUMENTED',
          verification_method: 'EXTRACTED_RULE_BASED',
          asserted_by: 'ML Parser',
          asserted_at: '2026-10-28T12:00:00Z',
          effective_from: '2026-06-01',
          effective_to: '2029-05-31',
          supersedes_assertion_id: null,
          status_record: 'active',
          revision: 1,
          evidence_links: [
            {
              artifact_id: 'art-real-001',
              filename: 'Discom_Sanction.pdf',
              document_type: 'UTILITY_SANCTION',
              page_number: 2,
              sha256: 'a'.repeat(64),
              synthetic_demo: false,
            },
          ],
        },
      ];

      vi.spyOn(apiClient, 'get').mockResolvedValueOnce({ data: mockAssertionDto });

      const assertions = await evidenceService.getAssertions('proj-real');
      expect(apiClient.get).toHaveBeenCalledWith('/projects/proj-real/assertions');
      expect(assertions.length).toBe(1);
      expect(assertions[0].id).toBe('asrt-real-1');
      expect(assertions[0].value).toBe(50.0);
      expect(assertions[0].field_label).toBe('Sanctioned Grid Power');
      expect(assertions[0].evidence_artifact_ids).toEqual(['art-real-001']);
      expect(assertions[0].supporting_pages).toEqual([2]);
    });

    it('retrieves extraction candidates and falls back to POST /extract if not yet extracted', async () => {
      const mockRunDto = {
        artifact_id: 'art-real-001',
        filename: 'Discom_Sanction.pdf',
        file_format: 'PDF',
        page_count: 5,
        status: 'SUCCESS',
        document_type: 'UTILITY_SANCTION',
        candidate_count: 1,
        extraction_candidates: [
          {
            extraction_id: 'art-real-001-cand-1',
            document_id: 'art-real-001',
            document_type: 'UTILITY_SANCTION',
            page_number: 2,
            field_key: 'sanctioned_grid_mw',
            raw_text: 'Contract demand is 50 MW',
            normalized_value: 50,
            unit: 'MW',
            phase_scope: 'PHASE_1',
            method: 'RULE_BASED',
            review_status: 'PENDING',
          },
        ],
      };

      vi.spyOn(apiClient, 'get').mockRejectedValueOnce({
        response: { status: 404, data: { detail: { code: 'not_extracted' } } },
      });
      vi.spyOn(apiClient, 'post').mockResolvedValueOnce({ data: mockRunDto });

      const candidates = await evidenceService.getExtractions('art-real-001');
      expect(apiClient.post).toHaveBeenCalledWith('/evidence/art-real-001/extract');
      expect(candidates.length).toBe(1);
      expect(candidates[0].id).toBe('art-real-001-cand-1');
      expect(candidates[0].normalized_value).toBe(50);
      expect(candidates[0].review_status).toBe('PENDING');
    });

    it('confirms extraction candidate with review_outcome: null producing DOCUMENTED assertion', async () => {
      // First populate candidate cache via getExtractions
      const mockRunDto = {
        artifact_id: 'art-real-001',
        filename: 'Discom_Sanction.pdf',
        file_format: 'PDF',
        page_count: 5,
        status: 'SUCCESS',
        document_type: 'UTILITY_SANCTION',
        candidate_count: 1,
        extraction_candidates: [
          {
            extraction_id: 'cand-001',
            document_id: 'art-real-001',
            document_type: 'UTILITY_SANCTION',
            page_number: 2,
            field_key: 'sanctioned_grid_mw',
            raw_text: '50 MW',
            normalized_value: 50,
            unit: 'MW',
            phase_scope: 'PHASE_1',
            method: 'RULE_BASED',
            review_status: 'PENDING',
          },
        ],
      };

      vi.spyOn(apiClient, 'get').mockResolvedValueOnce({ data: mockRunDto });
      await evidenceService.getExtractions('art-real-001');

      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce({ data: {} });

      const confirmed = await evidenceService.confirmExtraction('cand-001', 'ACCEPTED', 55);
      expect(postSpy).toHaveBeenCalledWith(
        '/evidence/art-real-001/extractions/cand-001/confirm',
        expect.objectContaining({
          reviewer_id: 'local-reviewer',
          modified_value: '55',
          modified_numeric_value: 55,
          review_outcome: null, // Strict invariant: confirmation does not auto-verify
        })
      );
      expect(confirmed.review_status).toBe('MODIFIED');
      expect(confirmed.normalized_value).toBe(55);
    });

    it('rejects extraction candidate via POST /reject without creating assertion', async () => {
      const mockRunDto = {
        artifact_id: 'art-real-001',
        filename: 'Discom_Sanction.pdf',
        file_format: 'PDF',
        page_count: 5,
        status: 'SUCCESS',
        document_type: 'UTILITY_SANCTION',
        candidate_count: 1,
        extraction_candidates: [
          {
            extraction_id: 'cand-002',
            document_id: 'art-real-001',
            document_type: 'UTILITY_SANCTION',
            page_number: 1,
            field_key: 'unknown_key',
            raw_text: 'invalid data',
            normalized_value: null,
            unit: '',
            review_status: 'PENDING',
          },
        ],
      };

      vi.spyOn(apiClient, 'get').mockResolvedValueOnce({ data: mockRunDto });
      await evidenceService.getExtractions('art-real-001');

      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
        data: { extraction_id: 'cand-002', review_status: 'REJECTED' },
      });

      const rejected = await evidenceService.confirmExtraction('cand-002', 'REJECTED');
      expect(postSpy).toHaveBeenCalledWith(
        '/evidence/art-real-001/extractions/cand-002/reject',
        expect.objectContaining({
          reviewer_id: 'local-reviewer',
        })
      );
      expect(rejected.review_status).toBe('REJECTED');
    });

    it('reviews assertion and maps review_status to APPROVED with is_simulated: true', async () => {
      const mockUpdatedAssertion = {
        id: 'asrt-100',
        project_id: 'proj-real',
        site_id: 'site-1',
        phase_id: 'phase-1',
        field_key: 'sanctioned_grid_mw',
        value: '50.0',
        numeric_value: 50.0,
        unit: 'MW',
        scope_type: 'PHASE',
        scope_detail: 'Phase 1',
        status: 'VERIFIED_WITHIN_SCOPE',
        verification_method: 'SIMULATED_REVIEW',
        asserted_by: 'MSEDCL',
        asserted_at: '2026-10-29T10:00:00Z',
        status_record: 'active',
        revision: 2,
        evidence_links: [],
      };

      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
        data: mockUpdatedAssertion,
      });

      const result = await evidenceService.reviewAssertion({
        assertion_id: 'asrt-100',
        decision: 'VERIFIED_WITHIN_SCOPE',
        reviewer_role: 'CONSULTANT',
        notes: 'Verified sanction letter page 2',
      });

      expect(postSpy).toHaveBeenCalledWith(
        '/assertions/asrt-100/reviews',
        expect.objectContaining({
          reviewer_id: 'CONSULTANT',
          review_status: 'APPROVED',
          is_simulated: true,
        })
      );
      expect(result.status).toBe('VERIFIED_WITHIN_SCOPE');
      expect(result.revision).toBe(2);
    });

    it('maps FLAGGED_CONFLICT review status when decision is FLAG_CONFLICT', async () => {
      const mockUpdatedAssertion = {
        id: 'asrt-200',
        project_id: 'proj-real',
        site_id: null,
        phase_id: null,
        field_key: 'peak_summer_water_kld',
        value: '3000',
        numeric_value: 3000,
        unit: 'KLD',
        scope_type: 'CAMPUS',
        status: 'CONFLICTING',
        verification_method: 'UNVERIFIED',
        asserted_by: 'Consultant',
        asserted_at: '2026-10-29T10:00:00Z',
        status_record: 'active',
        revision: 2,
        evidence_links: [],
      };

      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
        data: mockUpdatedAssertion,
      });

      const result = await evidenceService.reviewAssertion({
        assertion_id: 'asrt-200',
        decision: 'FLAG_CONFLICT',
        reviewer_role: 'CONSULTANT',
      });

      expect(postSpy).toHaveBeenCalledWith(
        '/assertions/asrt-200/reviews',
        expect.objectContaining({
          review_status: 'FLAGGED_CONFLICT',
        })
      );
      expect(result.status).toBe('CONFLICTING');
    });

    it('preserves explicit synthetic_demo value during evidence upload', async () => {
      const file = new File(['dummy content'], 'report.pdf', { type: 'application/pdf' });
      const postSpy = vi.spyOn(apiClient, 'post').mockImplementation(async () => ({
        data: {
          id: 'art-demo-1',
          project_id: 'proj-1',
          document_type: 'DPR',
          filename: 'report.pdf',
          mime_type: 'application/pdf',
          file_size_bytes: file.size,
          sha256: 'c'.repeat(64),
          synthetic_demo: true,
          uploaded_by: 'local-user',
          uploaded_at: '2026-10-29T10:00:00Z',
        },
      }));

      await evidenceService.uploadArtifact('proj-1', file, {
        document_type: 'DPR',
        synthetic_demo: true,
      });

      expect(postSpy).toHaveBeenCalledWith(
        '/projects/proj-1/evidence/upload',
        expect.objectContaining({
          synthetic_demo: true,
        })
      );
    });

    it('identifies simulated review and sets is_simulated flag without fabricating verifier credentials', async () => {
      const mockAssertionDto = [
        {
          id: 'asrt-sim-1',
          project_id: 'proj-1',
          field_key: 'sanctioned_grid_mw',
          value: '40',
          numeric_value: 40,
          unit: 'MW',
          scope_type: 'PHASE',
          status: 'VERIFIED_WITHIN_SCOPE',
          verification_method: 'SIMULATED_REVIEW',
          asserted_by: 'Local Reviewer',
          asserted_at: '2026-10-29T10:00:00Z',
          status_record: 'active',
          revision: 1,
          evidence_links: [],
          reviews: [
            {
              id: 'rev-1',
              assertion_id: 'asrt-sim-1',
              reviewer_id: 'LOCAL_CONSULTANT',
              review_status: 'APPROVED',
              is_simulated: true,
              notes: 'Simulated review run',
              reviewed_at: '2026-10-29T10:00:00Z',
            },
          ],
        },
      ];

      vi.spyOn(apiClient, 'get').mockResolvedValueOnce({ data: mockAssertionDto });
      const assertions = await evidenceService.getAssertions('proj-1');

      expect(assertions.length).toBe(1);
      expect(assertions[0].status).toBe('VERIFIED_WITHIN_SCOPE');
      expect(assertions[0].verification_method).toBe('SIMULATED_REVIEW');
      expect(assertions[0].is_simulated).toBe(true);
    });

    it('preserves candidate identity across browser refresh via session storage', async () => {
      const mockRunDto = {
        artifact_id: 'art-persisted-99',
        filename: 'Grid_Allocation.pdf',
        file_format: 'PDF',
        page_count: 3,
        status: 'SUCCESS',
        document_type: 'UTILITY_SANCTION',
        candidate_count: 1,
        extraction_candidates: [
          {
            extraction_id: 'cand-persisted-1',
            document_id: 'art-persisted-99',
            document_type: 'UTILITY_SANCTION',
            page_number: 1,
            field_key: 'sanctioned_grid_mw',
            raw_text: 'Contract demand: 40 MW',
            normalized_value: 40,
            unit: 'MW',
            review_status: 'PENDING',
          },
        ],
      };

      vi.spyOn(apiClient, 'get').mockResolvedValueOnce({ data: mockRunDto });
      await evidenceService.getExtractions('art-persisted-99');

      // Simulate a browser refresh by wiping memory cache (without wiping sessionStorage)
      // confirmExtraction should still resolve 'art-persisted-99'
      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce({ data: {} });

      const confirmed = await evidenceService.confirmExtraction('cand-persisted-1', 'ACCEPTED');
      expect(postSpy).toHaveBeenCalledWith(
        '/evidence/art-persisted-99/extractions/cand-persisted-1/confirm',
        expect.anything()
      );
      expect(confirmed.review_status).toBe('ACCEPTED');
    });

    it('disambiguates repeated candidate IDs across different artifacts using documentId', async () => {
      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce({ data: {} });

      // Artifact B has candidate "cand-1"
      await evidenceService.confirmExtraction('cand-1', 'ACCEPTED', 100, 'art-B');

      expect(postSpy).toHaveBeenCalledWith(
        '/evidence/art-B/extractions/cand-1/confirm',
        expect.anything()
      );
    });

    it('reconstructs candidate mapping via project extractions when cache is cold', async () => {
      const mockArtifacts = [
        {
          id: 'art-discovered-1',
          project_id: 'proj-reconstruct',
          document_type: 'UTILITY_SANCTION',
          filename: 'Doc1.pdf',
          mime_type: 'application/pdf',
          file_size_bytes: 5000,
          sha256: 'd'.repeat(64),
          synthetic_demo: false,
          uploaded_by: 'local-user',
          uploaded_at: '2026-10-29T10:00:00Z',
        },
      ];

      const mockRunDto = {
        artifact_id: 'art-discovered-1',
        filename: 'Doc1.pdf',
        file_format: 'PDF',
        page_count: 1,
        status: 'SUCCESS',
        document_type: 'UTILITY_SANCTION',
        candidate_count: 1,
        extraction_candidates: [
          {
            extraction_id: 'cand-lost-and-found',
            document_id: 'art-discovered-1',
            document_type: 'UTILITY_SANCTION',
            page_number: 1,
            field_key: 'sanctioned_grid_mw',
            raw_text: '40 MW',
            normalized_value: 40,
            unit: 'MW',
            review_status: 'PENDING',
          },
        ],
      };

      vi.spyOn(apiClient, 'get').mockImplementation(async (url: string) => {
        if (url === '/evidence/proj-reconstruct/extractions') {
          throw { response: { status: 404, data: { detail: { code: 'artifact_not_found' } } } };
        }
        if (url === '/projects/proj-reconstruct/evidence') {
          return { data: mockArtifacts };
        }
        if (url === '/evidence/art-discovered-1/extractions') {
          return { data: mockRunDto };
        }
        return { data: [] };
      });

      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce({ data: {} });

      // Pass projectId as 5th argument to allow dynamic reconstruction
      await evidenceService.confirmExtraction('cand-lost-and-found', 'ACCEPTED', 40, undefined, 'proj-reconstruct');

      expect(postSpy).toHaveBeenCalledWith(
        '/evidence/art-discovered-1/extractions/cand-lost-and-found/confirm',
        expect.anything()
      );
    });
  });

  it('enforces strict project isolation for artifacts and assertions', async () => {
    // Other project has no artifacts or assertions initially
    const otherArtifacts = await evidenceService.getArtifacts('proj-chennai-edge');
    expect(otherArtifacts).toEqual([]);

    const otherAssertions = await evidenceService.getAssertions('proj-chennai-edge');
    expect(otherAssertions).toEqual([]);

    const otherExtractions = await evidenceService.getExtractions('proj-chennai-edge');
    expect(otherExtractions).toEqual([]);

    // Upload an artifact for the other project
    const file = new File(['content'], 'TANGEDCO_Sanction.pdf', { type: 'application/pdf' });
    const uploaded = await evidenceService.uploadArtifact('proj-chennai-edge', file, {
      document_type: 'UTILITY_SANCTION',
      issuer: 'TANGEDCO',
    });

    // Check it appears in Chennai, but NOT in Pune
    const chennaiArtifacts = await evidenceService.getArtifacts('proj-chennai-edge');
    expect(chennaiArtifacts).toHaveLength(1);
    expect(chennaiArtifacts[0].id).toBe(uploaded.id);

    const puneArtifacts = await evidenceService.getArtifacts('proj-pune-hyperscale');
    expect(puneArtifacts.some((a) => a.id === uploaded.id)).toBe(false);
  });

  it('persists evidence data across localStorage reloads', async () => {
    const file = new File(['data'], 'Water_Permit.pdf', { type: 'application/pdf' });
    const uploaded = await evidenceService.uploadArtifact('proj-pune-hyperscale', file, {
      document_type: 'WATER_ALLOCATION',
    });

    // Verify localStorage has the record
    const stored = JSON.parse(localStorage.getItem('ecosite-project-evidence-v1') || '{}');
    expect(stored.artifacts).toBeDefined();
    expect(stored.artifacts.some((a: { id: string }) => a.id === uploaded.id)).toBe(true);

    // Call getArtifacts again (which re-reads from store)
    const reloaded = await evidenceService.getArtifacts('proj-pune-hyperscale');
    expect(reloaded.some((a) => a.id === uploaded.id)).toBe(true);
  });
});
