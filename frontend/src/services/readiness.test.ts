import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  readinessService,
  setReadinessApiMode,
  formatReadinessError,
} from './readiness';
import { apiClient } from './api';

describe('readinessService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setReadinessApiMode(false); // offline/mock mode
  });

  describe('offline / mock mode', () => {
    it('returns structured mock readiness report', async () => {
      const report = await readinessService.getProjectReadiness('proj-test-123');
      expect(report.project_id).toBe('proj-test-123');
      expect(report.campus_summary.total_phases).toBe(3);
      expect(report.campus_summary.overall_power_status).toBe('PARTIAL');
      expect(report.phases.length).toBe(3);
      expect(report.all_findings.length).toBeGreaterThan(0);
    });

    it('returns structured mock 4-dimension site comparisons', async () => {
      const comparisons = await readinessService.getProjectComparisons('proj-test-123');
      expect(comparisons.project_id).toBe('proj-test-123');
      expect(comparisons.sites.length).toBe(2);
      expect(comparisons.epistemic_disclaimer).toContain('Missing data represents UNKNOWN/UNVERIFIED risk');
      
      const site1 = comparisons.sites[0];
      expect(site1.resource_readiness.title).toBe('Resource Readiness');
      expect(site1.environmental_exposure.title).toBe('Environmental Exposure');
      expect(site1.regulatory_readiness.title).toBe('Regulatory Readiness');
      expect(site1.evidence_completeness.title).toBe('Evidence Completeness');
    });

    it('returns structured mock site readiness passport', async () => {
      const passport = await readinessService.getSitePassport('proj-test-123', 'site-abc-456');
      expect(passport.project_id).toBe('proj-test-123');
      expect(passport.site_id).toBe('site-abc-456');
      expect(passport.sections.length).toBe(3);
      expect(passport.statutory_checklist.length).toBe(4);
      expect(passport.epistemic_disclaimer).toContain('Official Pre-Investment Screening Dossier');
    });
  });

  describe('API mode', () => {
    beforeEach(() => {
      setReadinessApiMode(true); // real API mode
    });

    it('calls GET /projects/:projectId/phase-readiness with proper parameters', async () => {
      const mockData = {
        project_id: 'proj-real-1',
        project_name: 'Real Project',
        evaluated_at: '2026-10-29T12:00:00Z',
        campus_summary: {
          total_phases: 1,
          total_cumulative_it_mw: 20,
          total_cumulative_facility_peak_mw: 26,
          total_qualifying_firm_power_mw: 26,
          overall_power_gap_mw: 0,
          overall_power_status: 'MET',
          total_peak_summer_water_kld: 700,
          total_qualifying_firm_water_kld: 700,
          overall_water_gap_kld: 0,
          overall_water_status: 'MET',
          critical_findings_count: 0,
          warning_findings_count: 0,
        },
        phases: [],
        all_findings: [],
      };

      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({ data: mockData });

      const result = await readinessService.getProjectReadiness('proj-real-1', 'site-1');
      expect(getSpy).toHaveBeenCalledWith('/projects/proj-real-1/phase-readiness', {
        params: { site_id: 'site-1' },
        signal: undefined,
      });
      expect(result.project_name).toBe('Real Project');
    });

    it('calls GET /projects/:projectId/comparisons', async () => {
      const mockData = {
        project_id: 'proj-real-2',
        project_name: 'Comparison Project',
        evaluated_at: '2026-10-29T12:00:00Z',
        sites: [],
        epistemic_disclaimer: 'Disclaimer test',
      };

      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({ data: mockData });

      const result = await readinessService.getProjectComparisons('proj-real-2');
      expect(getSpy).toHaveBeenCalledWith('/projects/proj-real-2/comparisons', {
        signal: undefined,
      });
      expect(result.epistemic_disclaimer).toBe('Disclaimer test');
    });

    it('calls GET /projects/:projectId/sites/:siteId/passport', async () => {
      const mockData = {
        passport_id: 'pass-123',
        generated_at: '2026-10-29T12:00:00Z',
        project_id: 'proj-real-3',
        project_name: 'Passport Project',
        archetype: 'hyperscale',
        site_id: 'site-789',
        site_name: 'Passport Site',
        state_code: 'IN-TG',
        district: 'Rangareddy',
        parcel_area_ha: 35.0,
        boundary_source: 'geoBoundaries',
        boundary_screening_status: 'inside_screening_boundary',
        sections: [],
        statutory_checklist: [],
        epistemic_disclaimer: 'Screening only',
      };

      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({ data: mockData });

      const result = await readinessService.getSitePassport('proj-real-3', 'site-789');
      expect(getSpy).toHaveBeenCalledWith('/projects/proj-real-3/sites/site-789/passport', {
        signal: undefined,
      });
      expect(result.passport_id).toBe('pass-123');
    });

    it('propagates 404 error without falling back to mock data', async () => {
      vi.spyOn(apiClient, 'get').mockRejectedValueOnce({
        response: {
          status: 404,
          data: { detail: { message: 'Project not found' } },
        },
      });

      await expect(readinessService.getProjectReadiness('proj-nonexistent')).rejects.toThrow(
        'Project not found'
      );
    });
  });

  describe('formatReadinessError', () => {
    it('extracts detail object message from axios error', () => {
      const err = {
        response: {
          status: 404,
          data: { detail: { message: 'Site record not found.' } },
        },
      };
      expect(formatReadinessError(err)).toBe('Site record not found.');
    });

    it('extracts detail string from axios error', () => {
      const err = {
        response: {
          status: 400,
          data: { detail: 'Bad request detail' },
        },
      };
      expect(formatReadinessError(err)).toBe('Bad request detail');
    });

    it('returns network failure message when response is missing', () => {
      const err = new Error('Network error');
      expect(formatReadinessError(err)).toBe('Network error');
    });
  });
});
