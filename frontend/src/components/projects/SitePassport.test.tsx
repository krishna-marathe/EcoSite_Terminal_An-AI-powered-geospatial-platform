import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SitePassport } from './SitePassport';
import type { Project, CandidateSite } from '../../services/projects';
import type { ProjectPhase } from '../../services/phases';
import type { Assertion, EvidenceArtifact } from '../../types/evidence';
import type { SiteReadinessPassport } from '../../types/readiness';

const mockProject: Project = {
  id: 'proj-1',
  name: 'Navi Mumbai HyperCampus',
  organization_label: 'CloudCore India',
  archetype: 'hyperscale',
  stage: 'concept',
  status: 'active',
  revision: 1,
};

const mockSite: CandidateSite = {
  id: 'site-1',
  project_id: 'proj-1',
  name: 'Plot 42 MIDC Taloja',
  state_code: 'IN-MH',
  district: 'Raigad',
  area_ha: 14.5,
  revision: 2,
  boundary_source: 'pinpoint_geojson',
  boundary_sha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
  geometry_hash: 'hash-1234',
  status: 'active',
  boundary_screening: {
    status: 'inside_screening_boundary',
    version: '2026.1',
    licence: 'Screening only',
  },
  geometry: {
    type: 'Polygon',
    coordinates: [[[73.1, 19.0], [73.2, 19.0], [73.2, 19.1], [73.1, 19.1], [73.1, 19.0]]],
  },
  created_at: '2026-03-01T00:00:00Z',
  updated_at: '2026-03-01T00:00:00Z',
};

const mockPhases: ProjectPhase[] = [
  {
    id: 'ph-1',
    project_id: 'proj-1',
    sequence: 1,
    name: 'Phase 1 - Base IT',
    commissioning_date: '2026-12',
    cumulative_it_mw: 24,
    cumulative_facility_peak_mw: 33.6,
    design_pue: 1.4,
    average_water_kld: 400,
    peak_summer_water_kld: 600,
    cooling_type: 'evaporative',
    revision: 1,
    status: 'active',
    warnings: [],
    created_at: '2026-03-01T00:00:00Z',
    updated_at: '2026-03-01T00:00:00Z',
  },
  {
    id: 'ph-2',
    project_id: 'proj-1',
    sequence: 2,
    name: 'Phase 2 - Expansion',
    commissioning_date: '2027-12',
    cumulative_it_mw: 36,
    cumulative_facility_peak_mw: 50.4,
    design_pue: 1.4,
    average_water_kld: 600,
    peak_summer_water_kld: 900,
    cooling_type: 'evaporative',
    revision: 1,
    status: 'active',
    warnings: [],
    created_at: '2026-03-01T00:00:00Z',
    updated_at: '2026-03-01T00:00:00Z',
  },
];

const mockAssertions: Assertion[] = [
  {
    id: 'as-1',
    project_id: 'proj-1',
    field_key: 'power_sanctioned_mw',
    field_label: 'Sanctioned Grid Feeder',
    value: 50,
    unit: 'MW',
    status: 'VERIFIED_WITHIN_SCOPE',
    scope_type: 'PHASE',
    evidence_artifact_ids: ['art-1'],
    revision: 1,
    asserted_by: 'analyst@ecosite',
    asserted_at: '2026-03-01T00:00:00Z',
  },
  {
    id: 'as-2',
    project_id: 'proj-1',
    field_key: 'water_allocation_kld',
    field_label: 'MIDC Water Allocation',
    value: 1000,
    unit: 'KLD',
    status: 'VERIFIED_WITHIN_SCOPE',
    scope_type: 'CAMPUS',
    evidence_artifact_ids: ['art-2'],
    revision: 1,
    asserted_by: 'analyst@ecosite',
    asserted_at: '2026-03-01T00:00:00Z',
  },
];

const mockArtifacts: EvidenceArtifact[] = [
  {
    id: 'art-1',
    project_id: 'proj-1',
    filename: 'MSETCL_Feasibility_Letter.pdf',
    document_type: 'UTILITY_SANCTION',
    issuer: 'MSETCL 220kV Substation',
    issued_on: '2026-01-15',
    sha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
    synthetic_demo: false,
    file_size_bytes: 1024,
    mime_type: 'application/pdf',
    visibility: 'PROJECT_TEAM',
    uploaded_by: 'analyst@ecosite',
    uploaded_at: '2026-03-01T00:00:00Z',
  },
];

const mockBackendPassport: SiteReadinessPassport = {
  passport_id: 'pass-site123-proj456',
  generated_at: '2026-10-29T12:00:00Z',
  project_id: 'proj-1',
  project_name: 'Navi Mumbai HyperCampus',
  archetype: 'hyperscale',
  site_id: 'site-1',
  site_name: 'Plot 42 MIDC Taloja',
  state_code: 'IN-MH',
  district: 'Raigad',
  parcel_area_ha: 14.5,
  boundary_source: 'geoBoundaries gbOpen IND ADM1',
  boundary_screening_status: 'inside_screening_boundary',
  epistemic_disclaimer: 'Official Pre-Investment Screening Dossier from genuine evidence graph.',
  sections: [
    {
      section_id: 'sec_spatial',
      title: 'Spatial & Boundary Screening',
      status: 'SCREENING_VERIFIED',
      data: {
        area_ha: 14.5,
        state_code: 'IN-MH',
        district: 'Raigad',
      },
      findings: [],
    },
    {
      section_id: 'sec_phases',
      title: 'Campus Lifecycle & Phasing Progression',
      status: 'EVALUATED',
      data: {
        phases: [
          {
            phase_sequence: 1,
            phase_name: 'Phase 1 - Base IT',
            commissioning_date: '2026-12',
            cumulative_it_mw: 24,
            cumulative_facility_peak_mw: 33.6,
            design_pue: 1.4,
            peak_summer_water_kld: 600,
          },
        ],
      },
      findings: [],
    },
    {
      section_id: 'sec_resource_gaps',
      title: 'Deliverability & Deficit Balance',
      status: 'DEFICIT',
      data: {
        campus_summary: {
          total_cumulative_it_mw: 24,
          total_cumulative_facility_peak_mw: 33.6,
          total_qualifying_firm_power_mw: 20.0,
          overall_power_gap_mw: 13.6,
          overall_power_status: 'PARTIAL',
          total_peak_summer_water_kld: 600,
          total_qualifying_firm_water_kld: 600,
          overall_water_gap_kld: 0,
          overall_water_status: 'MET',
        },
      },
      findings: [
        {
          code: 'DEFICIT_NOTE',
          domain: 'POWER',
          severity: 'CRITICAL',
          message: 'Firm substation delivery leaves 13.6 MW uncommitted.',
        },
      ],
    },
  ],
  statutory_checklist: [
    {
      name: 'State Environmental Impact Assessment (SEIAA)',
      mandate: 'EIA Notification 2006',
      status: 'EVIDENCE_REQUIRED',
    },
    {
      name: 'Dedicated Substation Feasibility Approval',
      mandate: '220kV feeder bay allocation',
      status: 'ATTENTION_REQUIRED',
    },
    {
      name: 'Consent to Establish (CTE / CTP)',
      mandate: 'State Pollution Control Board',
      status: 'VERIFIED',
    },
  ],
};

describe('SitePassport', () => {
  describe('legacy fallback mode', () => {
    it('renders site passport header and honesty disclaimer banner', () => {
      render(
        <SitePassport
          project={mockProject}
          site={mockSite}
          phases={mockPhases}
          assertions={mockAssertions}
          artifacts={mockArtifacts}
        />
      );

      expect(screen.getByText(/Site Readiness Passport: Plot 42 MIDC Taloja/i)).toBeInTheDocument();
      expect(screen.getByText(/Pre-Investment Screening & Honesty Disclaimer/i)).toBeInTheDocument();
      expect(screen.getByText(/constitute an official governmental clearance/i)).toBeInTheDocument();
    });

    it('computes and displays deliverability gaps correctly', () => {
      render(
        <SitePassport
          project={mockProject}
          site={mockSite}
          phases={mockPhases}
          assertions={mockAssertions}
          artifacts={mockArtifacts}
        />
      );

      expect(screen.getByText(/34.0 MW Gap/i)).toBeInTheDocument();
      expect(screen.getByText(/500 KLD Gap/i)).toBeInTheDocument();
    });

    it('triggers window.print when clicking Print / Export button', () => {
      const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
      render(
        <SitePassport
          project={mockProject}
          site={mockSite}
          phases={mockPhases}
          assertions={mockAssertions}
          artifacts={mockArtifacts}
        />
      );

      const printButton = screen.getByRole('button', { name: /Print \/ Export PDF/i });
      fireEvent.click(printButton);
      expect(printSpy).toHaveBeenCalled();
      printSpy.mockRestore();
    });
  });

  describe('backend passport mode', () => {
    it('renders backend sections, metrics and statutory checklist', () => {
      render(
        <SitePassport
          project={mockProject}
          site={mockSite}
          passportData={mockBackendPassport}
          artifacts={mockArtifacts}
        />
      );

      expect(screen.getByText('Passport ID: pass-site123-proj456')).toBeInTheDocument();
      expect(screen.getByText(/Official Pre-Investment Screening Dossier from genuine evidence graph/i)).toBeInTheDocument();

      // Check gap calculation from backend campus summary
      expect(screen.getByText(/13.6 MW Gap/i)).toBeInTheDocument();
      expect(screen.getByText(/Firm substation delivery leaves 13.6 MW uncommitted/i)).toBeInTheDocument();

      // Check statutory checklist
      expect(screen.getByText('State Environmental Impact Assessment (SEIAA)')).toBeInTheDocument();
      expect(screen.getByText('Dedicated Substation Feasibility Approval')).toBeInTheDocument();
      expect(screen.getByText('Consent to Establish (CTE / CTP)')).toBeInTheDocument();
      expect(screen.getByText('[✓]')).toBeInTheDocument();
      expect(screen.getByText('[!]')).toBeInTheDocument();
      expect(screen.getByText('[ ]')).toBeInTheDocument();
    });

    it('handles loading and error states in passport modal', () => {
      const { rerender } = render(
        <SitePassport
          project={mockProject}
          site={mockSite}
          loading={true}
        />
      );

      expect(screen.getByText(/Generating immutable pre-investment Site Readiness Passport snapshot/i)).toBeInTheDocument();

      rerender(
        <SitePassport
          project={mockProject}
          site={mockSite}
          error="Candidate site not found in project"
        />
      );

      expect(screen.getByText('Failed to load Site Readiness Passport')).toBeInTheDocument();
      expect(screen.getByText('Candidate site not found in project')).toBeInTheDocument();
    });

    it('renders environmental intelligence and observations with provenance in passport', () => {
      const mockObs = [
        {
          id: 'obs-jrc-1',
          source_id: 'jrc_gsw',
          site_id: 'site-1',
          geometry_hash: 'hash-1234',
          indicator: 'historical_water_occurrence_overlap_fraction',
          value: 0.025,
          unit: 'fraction',
          status: 'AVAILABLE' as const,
          evidence_class: 'REMOTE_SENSING_DERIVED' as const,
          dataset_version: 'GSW v1.5 (1984-2024)',
          period_start: '1984-01-01',
          period_end: '2024-12-31',
          observed_at: null,
          published_at: null,
          retrieved_at: '2026-10-27T00:00:00Z',
          resolution: '30 m',
          method: 'zonal_occurrence',
          processing_version: '1.0.0',
          coverage_fraction: 1.0,
          quality_flags: {},
          missing_reason: null,
          raw_snapshot_id: null,
        },
      ];

      render(
        <SitePassport
          project={mockProject}
          site={mockSite}
          passportData={mockBackendPassport}
          observations={mockObs}
        />
      );

      expect(screen.getByText(/6. Environmental Intelligence & Geospatial Screening \(1 Observations\)/i)).toBeInTheDocument();
      expect(screen.getByText('historical water occurrence overlap fraction')).toBeInTheDocument();
      expect(screen.getByText('0.025')).toBeInTheDocument();
      expect(screen.getByText('REMOTE_SENSING_DERIVED')).toBeInTheDocument();
      expect(screen.getByText(/Public Geospatial \/ Reanalysis Grounding/i)).toBeInTheDocument();
    });
  });
});
