import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SiteComparisonMatrix } from './SiteComparisonMatrix';
import type { CandidateSite } from '../../services/projects';
import type { SiteComparisonResponse } from '../../types/readiness';
import { INITIAL_MOCK_ASSERTIONS } from '../../services/evidence';

const MOCK_SITES: CandidateSite[] = [
  {
    id: 'site-daund-01',
    project_id: 'proj-01',
    name: 'Daund Greenfield Site',
    state_code: 'IN-MH',
    district: 'Pune',
    area_ha: 24.5,
    geometry: { type: 'Polygon', coordinates: [[[73.84, 18.51], [73.86, 18.51], [73.86, 18.53], [73.84, 18.53], [73.84, 18.51]]] },
    boundary_source: 'geoBoundaries gbOpen IND ADM1',
    boundary_sha256: 'sha-sample-01',
    geometry_hash: 'geom-sample-01',
    boundary_screening: { version: '9469f09', licence: 'CC BY 2.5 IN', screening_only: true, status: 'inside_screening_boundary' },
    revision: 1,
    status: 'active',
    created_at: '2026-10-20T10:00:00Z',
    updated_at: '2026-10-20T10:00:00Z',
  },
  {
    id: 'site-chakan-02',
    project_id: 'proj-01',
    name: 'Chakan MIDC Industrial Parcel',
    state_code: 'IN-MH',
    district: 'Pune',
    area_ha: 18.2,
    geometry: { type: 'Polygon', coordinates: [[[73.84, 18.51], [73.86, 18.51], [73.86, 18.53], [73.84, 18.53], [73.84, 18.51]]] },
    boundary_source: 'geoBoundaries gbOpen IND ADM1',
    boundary_sha256: 'sha-sample-02',
    geometry_hash: 'geom-sample-02',
    boundary_screening: { version: '9469f09', licence: 'CC BY 2.5 IN', screening_only: true, status: 'inside_screening_boundary' },
    revision: 1,
    status: 'active',
    created_at: '2026-10-21T10:00:00Z',
    updated_at: '2026-10-21T10:00:00Z',
  },
];

const MOCK_BACKEND_COMPARISONS: SiteComparisonResponse = {
  project_id: 'proj-01',
  project_name: 'Pune Campus',
  evaluated_at: '2026-10-29T12:00:00Z',
  epistemic_disclaimer: 'Independent 4-dimension comparison without black-box scores.',
  sites: [
    {
      site_id: 'site-daund-01',
      site_name: 'Daund Greenfield Site',
      area_ha: 24.5,
      state_code: 'IN-MH',
      district: 'Pune',
      boundary_screening_status: 'inside_screening_boundary',
      resource_readiness: {
        title: 'Resource Readiness',
        status: 'READY',
        metrics: {
          firm_power_mw: 40,
          power_gap_mw: 0,
          power_status: 'MET',
          firm_water_kld: 1800,
          water_gap_kld: 0,
          water_status: 'MET',
        },
        notes: ['Fully substantiated grid and water commitments.'],
      },
      environmental_exposure: {
        title: 'Environmental Exposure',
        status: 'READY',
        metrics: {
          boundary_screening: 'inside_screening_boundary',
          boundary_source: 'geoBoundaries gbOpen IND ADM1',
          area_ha: 24.5,
        },
        notes: [],
      },
      regulatory_readiness: {
        title: 'Regulatory Readiness',
        status: 'READY',
        metrics: {
          state_code: 'IN-MH',
          policy_framework: 'Maharashtra Data Centre Policy 2023',
        },
        notes: ['Stamp duty exemption applicable.'],
      },
      evidence_completeness: {
        title: 'Evidence Completeness',
        status: 'READY',
        metrics: {
          total_artifacts: 3,
          total_assertions: 4,
          verified_assertions: 3,
          conflicting_assertions: 0,
          documented_assertions: 1,
        },
        notes: [],
      },
    },
    {
      site_id: 'site-chakan-02',
      site_name: 'Chakan MIDC Industrial Parcel',
      area_ha: 18.2,
      state_code: 'IN-MH',
      district: 'Pune',
      boundary_screening_status: 'inside_screening_boundary',
      resource_readiness: {
        title: 'Resource Readiness',
        status: 'ATTENTION_REQUIRED',
        metrics: {
          firm_power_mw: 20,
          power_gap_mw: 60,
          power_status: 'PARTIAL',
          firm_water_kld: 1200,
          water_gap_kld: 1600,
          water_status: 'PARTIAL',
        },
        notes: ['Substation proximity does not substitute for sanctioned delivery.'],
      },
      environmental_exposure: {
        title: 'Environmental Exposure',
        status: 'READY',
        metrics: {
          boundary_screening: 'inside_screening_boundary',
          boundary_source: 'geoBoundaries gbOpen IND ADM1',
          area_ha: 18.2,
        },
        notes: [],
      },
      regulatory_readiness: {
        title: 'Regulatory Readiness',
        status: 'READY',
        metrics: {
          state_code: 'IN-MH',
          policy_framework: 'Maharashtra Data Centre Policy 2023',
        },
        notes: [],
      },
      evidence_completeness: {
        title: 'Evidence Completeness',
        status: 'HIGH_RISK',
        metrics: {
          total_artifacts: 2,
          total_assertions: 3,
          verified_assertions: 1,
          conflicting_assertions: 1,
          documented_assertions: 1,
        },
        notes: ['1 conflicting assertion detected.'],
      },
    },
  ],
};

describe('SiteComparisonMatrix Component', () => {
  describe('legacy fallback mode', () => {
    it('renders side-by-side comparison across 4 independent dimensions', () => {
      render(
        <SiteComparisonMatrix
          sites={MOCK_SITES}
          phases={[]}
          assertions={INITIAL_MOCK_ASSERTIONS}
          onGeneratePassport={vi.fn()}
        />
      );

      expect(screen.getByText('3-Site Pre-Investment Comparison Matrix')).toBeInTheDocument();
      expect(screen.getByText('Daund Greenfield Site')).toBeInTheDocument();
      expect(screen.getByText('Chakan MIDC Industrial Parcel')).toBeInTheDocument();

      expect(screen.getByText(/Dimension 1: Resource Readiness/i)).toBeInTheDocument();
      expect(screen.getByText(/Dimension 2: Environmental & Spatial Screening/i)).toBeInTheDocument();
      expect(screen.getByText(/Dimension 3: Regulatory & State Policy Coverage/i)).toBeInTheDocument();
      expect(screen.getByText(/Dimension 4: Evidence Completeness & Integrity/i)).toBeInTheDocument();
    });

    it('handles empty site list with helpful guidance', () => {
      render(<SiteComparisonMatrix sites={[]} phases={[]} assertions={[]} />);
      expect(screen.getByText(/No candidate sites saved for this project/i)).toBeInTheDocument();
    });
  });

  describe('real backend comparison mode', () => {
    it('renders the 4 independent dimensions from backend comparison response', () => {
      render(
        <SiteComparisonMatrix
          comparisonData={MOCK_BACKEND_COMPARISONS}
          onGeneratePassport={vi.fn()}
        />
      );

      expect(screen.getByText('Daund Greenfield Site')).toBeInTheDocument();
      expect(screen.getByText('Chakan MIDC Industrial Parcel')).toBeInTheDocument();
      expect(screen.getByText(/Independent 4-dimension comparison without black-box scores/i)).toBeInTheDocument();

      // Check firm values
      expect(screen.getByText('40 MW Firm')).toBeInTheDocument();
      expect(screen.getByText('20 MW Firm')).toBeInTheDocument();
      expect(screen.getByText('Gap: -60 MW')).toBeInTheDocument();

      // Check status badges
      expect(screen.getAllByText('READY').length).toBeGreaterThan(0);
      expect(screen.getByText('ATTENTION REQUIRED')).toBeInTheDocument();
      expect(screen.getByText('HIGH RISK')).toBeInTheDocument();

      // Check notes
      expect(screen.getByText(/Substation proximity does not substitute for sanctioned delivery/i)).toBeInTheDocument();
      expect(screen.getByText(/1 Unresolved Contradictions/i)).toBeInTheDocument();
    });

    it('allows selecting candidate site and triggers export passport', () => {
      const exportSpy = vi.fn();
      render(
        <SiteComparisonMatrix
          comparisonData={MOCK_BACKEND_COMPARISONS}
          onGeneratePassport={exportSpy}
        />
      );

      const radios = screen.getAllByRole('radio');
      expect(radios.length).toBe(2);

      // Select second candidate
      fireEvent.click(radios[1]);

      const exportBtn = screen.getByRole('button', { name: /Export Site Readiness Passport/i });
      fireEvent.click(exportBtn);

      expect(exportSpy).toHaveBeenCalledWith('site-chakan-02');
    });

    it('handles single candidate gracefully', () => {
      const singleSiteData: SiteComparisonResponse = {
        ...MOCK_BACKEND_COMPARISONS,
        sites: [MOCK_BACKEND_COMPARISONS.sites[0]],
      };

      render(<SiteComparisonMatrix comparisonData={singleSiteData} />);
      expect(screen.getByText(/Single candidate polygon evaluated/i)).toBeInTheDocument();
      expect(screen.getByText('Daund Greenfield Site')).toBeInTheDocument();
    });

    it('handles loading and error states', () => {
      const { rerender } = render(<SiteComparisonMatrix loading={true} />);
      expect(screen.getByText(/Evaluating candidate polygon dimensions from genuine evidence records/i)).toBeInTheDocument();

      rerender(<SiteComparisonMatrix error="Failed to fetch candidate comparisons" />);
      expect(screen.getByText('Unable to load candidate site comparisons')).toBeInTheDocument();
      expect(screen.getByText('Failed to fetch candidate comparisons')).toBeInTheDocument();
    });
  });
});
