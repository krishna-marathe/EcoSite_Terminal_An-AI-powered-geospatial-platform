import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SitePassport } from './SitePassport';
import type { Project, CandidateSite } from '../../services/projects';
import type { ProjectPhase } from '../../services/phases';
import type { Assertion, EvidenceArtifact } from '../../types/evidence';

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

describe('SitePassport', () => {
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

    // Total Facility MW = 33.6 + 50.4 = 84 MW. Verified = 50 MW. Gap = 34 MW.
    expect(screen.getByText(/34.0 MW Gap/i)).toBeInTheDocument();
    // Total Water = 600 + 900 = 1500 KLD. Verified = 1000 KLD. Gap = 500 KLD.
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
