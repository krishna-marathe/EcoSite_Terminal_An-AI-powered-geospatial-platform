import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Projects } from './Projects';
import * as projectService from '../services/projects';
import * as phaseService from '../services/phases';
import * as evidenceServiceModule from '../services/evidence';
import * as readinessServiceModule from '../services/readiness';
import type { Project, CandidateSite } from '../services/projects';
import type { ProjectPhase } from '../services/phases';
import type {
  ProjectReadinessReport,
  SiteComparisonResponse,
  SiteReadinessPassport,
} from '../types/readiness';

// Mock maplibre-gl to avoid WebGL context issues in jsdom
vi.mock('maplibre-gl', () => ({
  Map: class {
    handlers: Record<string, (e?: unknown) => void> = {};
    constructor() {}
    on(name: string, handler: (e?: unknown) => void) {
      this.handlers[name] = handler;
    }
    off(name: string) {
      delete this.handlers[name];
    }
    emit(name: string, event?: unknown) {
      this.handlers[name]?.(event);
    }
    addControl() {}
    addLayer() {}
    resize() {}
    easeTo() {}
    flyTo() {}
    fitBounds() {}
    getCenter() {
      return { lng: 73.8567, lat: 18.5204 };
    }
    getSource() {
      return { setData: () => {} };
    }
    addSource() {}
    remove() {}
  },
  AttributionControl: class {},
  Marker: class {
    setLngLat() {
      return this;
    }
    addTo() {
      return this;
    }
    remove() {}
  },
}));

vi.mock('../components/projects/PhaseEditor', () => ({
  PhaseEditor: () => <div data-testid="mock-phase-editor">Phase Editor Loaded</div>,
}));

const TEST_PROJECT: Project = {
  id: 'proj-sahyadri-01',
  name: 'Sahyadri AI Hyperscale Campus',
  organization_label: 'Sahyadri Compute Infra Ltd',
  archetype: 'hyperscale',
  stage: 'concept',
  status: 'active',
  revision: 1,
};

const TEST_SITES: CandidateSite[] = [
  {
    id: 'site-chakan-01',
    project_id: 'proj-sahyadri-01',
    name: 'Chakan Greenfield Parcel A',
    state_code: 'IN-MH',
    district: 'Pune',
    area_ha: 24.5,
    revision: 1,
    boundary_source: 'geoBoundaries gbOpen IND ADM1',
    boundary_sha256: 'sha-sample-01',
    geometry_hash: 'geom-sample-01',
    status: 'active',
    boundary_screening: {
      status: 'inside_screening_boundary',
      version: '9469f09',
      licence: 'CC BY 2.5 IN',
      screening_only: true,
    },
    geometry: {
      type: 'Polygon',
      coordinates: [[[73.84, 18.51], [73.86, 18.51], [73.86, 18.53], [73.84, 18.53], [73.84, 18.51]]],
    },
    created_at: '2026-10-29T10:00:00Z',
    updated_at: '2026-10-29T10:00:00Z',
  },
  {
    id: 'site-talegaon-02',
    project_id: 'proj-sahyadri-01',
    name: 'Talegaon MIDC Parcel B',
    state_code: 'IN-MH',
    district: 'Pune',
    area_ha: 18.2,
    revision: 1,
    boundary_source: 'geoBoundaries gbOpen IND ADM1',
    boundary_sha256: 'sha-sample-02',
    geometry_hash: 'geom-sample-02',
    status: 'active',
    boundary_screening: {
      status: 'inside_screening_boundary',
      version: '9469f09',
      licence: 'CC BY 2.5 IN',
      screening_only: true,
    },
    geometry: {
      type: 'Polygon',
      coordinates: [[[73.88, 18.51], [73.90, 18.51], [73.90, 18.53], [73.88, 18.53], [73.88, 18.51]]],
    },
    created_at: '2026-10-29T10:00:00Z',
    updated_at: '2026-10-29T10:00:00Z',
  },
  {
    id: 'site-ranjangaon-03',
    project_id: 'proj-sahyadri-01',
    name: 'Ranjangaon Industrial Parcel C',
    state_code: 'IN-MH',
    district: 'Pune',
    area_ha: 31.0,
    revision: 1,
    boundary_source: 'geoBoundaries gbOpen IND ADM1',
    boundary_sha256: 'sha-sample-03',
    geometry_hash: 'geom-sample-03',
    status: 'active',
    boundary_screening: {
      status: 'inside_screening_boundary',
      version: '9469f09',
      licence: 'CC BY 2.5 IN',
      screening_only: true,
    },
    geometry: {
      type: 'Polygon',
      coordinates: [[[73.92, 18.51], [73.94, 18.51], [73.94, 18.53], [73.92, 18.53], [73.92, 18.51]]],
    },
    created_at: '2026-10-29T10:00:00Z',
    updated_at: '2026-10-29T10:00:00Z',
  },
];

const TEST_PHASES: ProjectPhase[] = [
  {
    id: 'ph-01',
    project_id: 'proj-sahyadri-01',
    sequence: 1,
    name: 'Phase 1 - Initial 24MW Pod',
    commissioning_date: '2027-06-01',
    cumulative_it_mw: 24,
    cumulative_facility_peak_mw: 31.2,
    design_pue: 1.3,
    average_water_kld: 400,
    peak_summer_water_kld: 650,
    cooling_type: 'Evaporative Hybrid',
    revision: 1,
    status: 'active',
    warnings: [],
    created_at: '2026-10-29T10:00:00Z',
    updated_at: '2026-10-29T10:00:00Z',
  },
  {
    id: 'ph-02',
    project_id: 'proj-sahyadri-01',
    sequence: 2,
    name: 'Phase 2 - Campus Expansion 48MW',
    commissioning_date: '2029-06-01',
    cumulative_it_mw: 48,
    cumulative_facility_peak_mw: 62.4,
    design_pue: 1.3,
    average_water_kld: 800,
    peak_summer_water_kld: 1300,
    cooling_type: 'Evaporative Hybrid',
    revision: 1,
    status: 'active',
    warnings: [],
    created_at: '2026-10-29T10:00:00Z',
    updated_at: '2026-10-29T10:00:00Z',
  },
  {
    id: 'ph-03',
    project_id: 'proj-sahyadri-01',
    sequence: 3,
    name: 'Phase 3 - Full Buildout 80MW',
    commissioning_date: '2032-06-01',
    cumulative_it_mw: 80,
    cumulative_facility_peak_mw: 104,
    design_pue: 1.3,
    average_water_kld: 1400,
    peak_summer_water_kld: 2200,
    cooling_type: 'Liquid-Air Hybrid',
    revision: 1,
    status: 'active',
    warnings: [],
    created_at: '2026-10-29T10:00:00Z',
    updated_at: '2026-10-29T10:00:00Z',
  },
];

const TEST_READINESS_REPORT: ProjectReadinessReport = {
  project_id: 'proj-sahyadri-01',
  project_name: 'Sahyadri AI Hyperscale Campus',
  evaluated_at: '2026-10-29T12:00:00Z',
  campus_summary: {
    total_phases: 3,
    total_cumulative_it_mw: 80,
    total_cumulative_facility_peak_mw: 104,
    total_qualifying_firm_power_mw: 40,
    overall_power_gap_mw: 64,
    overall_power_status: 'PARTIAL',
    total_peak_summer_water_kld: 2200,
    total_qualifying_firm_water_kld: 1000,
    overall_water_gap_kld: 1200,
    overall_water_status: 'PARTIAL',
    critical_findings_count: 1,
    warning_findings_count: 1,
  },
  phases: [
    {
      phase_id: 'ph-01',
      phase_sequence: 1,
      phase_name: 'Phase 1 - Initial 24MW Pod',
      commissioning_date: '2027-06-01',
      cooling_type: 'Evaporative Hybrid',
      design_pue: 1.3,
      power: {
        phase_sequence: 1,
        demand_mw: 31.2,
        incremental_demand_mw: 24,
        verified_capacity_mw: 40,
        documented_capacity_mw: 0,
        qualifying_firm_capacity_mw: 31.2,
        proposed_capacity_mw: 0,
        unverified_capacity_mw: 0,
        power_gap_mw: 0,
        power_surplus_mw: 8.8,
        status: 'MET',
        qualifying_commitments_count: 1,
        total_commitments_count: 1,
      },
      water: {
        phase_sequence: 1,
        peak_summer_demand_kld: 650,
        average_demand_kld: 400,
        verified_allocated_kld: 1000,
        documented_allocated_kld: 0,
        qualifying_firm_allocated_kld: 650,
        proposed_kld: 0,
        unverified_kld: 0,
        water_gap_kld: 0,
        water_surplus_kld: 350,
        status: 'MET',
        qualifying_commitments_count: 1,
        total_commitments_count: 1,
      },
      findings: [],
    },
    {
      phase_id: 'ph-02',
      phase_sequence: 2,
      phase_name: 'Phase 2 - Campus Expansion 48MW',
      commissioning_date: '2029-06-01',
      cooling_type: 'Evaporative Hybrid',
      design_pue: 1.3,
      power: {
        phase_sequence: 2,
        demand_mw: 62.4,
        incremental_demand_mw: 24,
        verified_capacity_mw: 40,
        documented_capacity_mw: 0,
        qualifying_firm_capacity_mw: 40,
        proposed_capacity_mw: 25,
        unverified_capacity_mw: 0,
        power_gap_mw: 22.4,
        power_surplus_mw: 0,
        status: 'PARTIAL',
        qualifying_commitments_count: 1,
        total_commitments_count: 2,
      },
      water: {
        phase_sequence: 2,
        peak_summer_demand_kld: 1300,
        average_demand_kld: 800,
        verified_allocated_kld: 1000,
        documented_allocated_kld: 0,
        qualifying_firm_allocated_kld: 1000,
        proposed_kld: 300,
        unverified_kld: 0,
        water_gap_kld: 300,
        water_surplus_kld: 0,
        status: 'PARTIAL',
        qualifying_commitments_count: 1,
        total_commitments_count: 2,
      },
      findings: [
        {
          code: 'WATER_GAP_P2',
          domain: 'WATER',
          severity: 'WARNING',
          message: 'Phase 2 summer water demand (1300 KLD) exceeds firm allocation by 300 KLD.',
        },
      ],
    },
    {
      phase_id: 'ph-03',
      phase_sequence: 3,
      phase_name: 'Phase 3 - Full Buildout 80MW',
      commissioning_date: '2032-06-01',
      cooling_type: 'Liquid-Air Hybrid',
      design_pue: 1.3,
      power: {
        phase_sequence: 3,
        demand_mw: 104,
        incremental_demand_mw: 32,
        verified_capacity_mw: 40,
        documented_capacity_mw: 0,
        qualifying_firm_capacity_mw: 40,
        proposed_capacity_mw: 64,
        unverified_capacity_mw: 0,
        power_gap_mw: 64,
        power_surplus_mw: 0,
        status: 'PARTIAL',
        qualifying_commitments_count: 1,
        total_commitments_count: 2,
      },
      water: {
        phase_sequence: 3,
        peak_summer_demand_kld: 2200,
        average_demand_kld: 1400,
        verified_allocated_kld: 1000,
        documented_allocated_kld: 0,
        qualifying_firm_allocated_kld: 1000,
        proposed_kld: 1200,
        unverified_kld: 0,
        water_gap_kld: 1200,
        water_surplus_kld: 0,
        status: 'PARTIAL',
        qualifying_commitments_count: 1,
        total_commitments_count: 2,
      },
      findings: [
        {
          code: 'POWER_DEFICIT_FULL',
          domain: 'POWER',
          severity: 'CRITICAL',
          message: 'Full campus peak facility load (104 MW) leaves 64 MW unbacked by verified utility sanctions.',
        },
      ],
    },
  ],
  all_findings: [
    {
      code: 'POWER_DEFICIT_FULL',
      domain: 'POWER',
      severity: 'CRITICAL',
      message: 'Full campus peak facility load (104 MW) leaves 64 MW unbacked by verified utility sanctions.',
    },
  ],
};

const TEST_COMPARISONS: SiteComparisonResponse = {
  project_id: 'proj-sahyadri-01',
  project_name: 'Sahyadri AI Hyperscale Campus',
  evaluated_at: '2026-10-29T12:00:00Z',
  epistemic_disclaimer:
    'Independent 4-dimension comparison. Does not compute a black-box composite score. Missing data represents UNKNOWN/UNVERIFIED risk rather than safety.',
  sites: [
    {
      site_id: 'site-chakan-01',
      site_name: 'Chakan Greenfield Parcel A',
      area_ha: 24.5,
      state_code: 'IN-MH',
      district: 'Pune',
      boundary_screening_status: 'inside_screening_boundary',
      resource_readiness: {
        title: 'Resource Readiness',
        status: 'READY',
        metrics: {
          firm_power_mw: 40,
          power_gap_mw: 64,
          power_status: 'PARTIAL',
          firm_water_kld: 1000,
          water_gap_kld: 1200,
          water_status: 'PARTIAL',
        },
        notes: ['Phase 1 grid deliverability sanctioned (40 MW).'],
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
        notes: ['Eligible for stamp duty concession.'],
      },
      evidence_completeness: {
        title: 'Evidence Completeness',
        status: 'READY',
        metrics: {
          total_artifacts: 3,
          total_assertions: 4,
          verified_assertions: 2,
          conflicting_assertions: 0,
          documented_assertions: 2,
        },
        notes: [],
      },
    },
    {
      site_id: 'site-talegaon-02',
      site_name: 'Talegaon MIDC Parcel B',
      area_ha: 18.2,
      state_code: 'IN-MH',
      district: 'Pune',
      boundary_screening_status: 'inside_screening_boundary',
      resource_readiness: {
        title: 'Resource Readiness',
        status: 'ATTENTION_REQUIRED',
        metrics: {
          firm_power_mw: 20,
          power_gap_mw: 84,
          power_status: 'PARTIAL',
          firm_water_kld: 500,
          water_gap_kld: 1700,
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
        status: 'ATTENTION_REQUIRED',
        metrics: {
          total_artifacts: 1,
          total_assertions: 2,
          verified_assertions: 1,
          conflicting_assertions: 0,
          documented_assertions: 1,
        },
        notes: ['Third-party audit pending.'],
      },
    },
    {
      site_id: 'site-ranjangaon-03',
      site_name: 'Ranjangaon Industrial Parcel C',
      area_ha: 31.0,
      state_code: 'IN-MH',
      district: 'Pune',
      boundary_screening_status: 'inside_screening_boundary',
      resource_readiness: {
        title: 'Resource Readiness',
        status: 'UNKNOWN',
        metrics: {
          firm_power_mw: 0,
          power_gap_mw: 104,
          power_status: 'UNCOMMITTED',
          firm_water_kld: 0,
          water_gap_kld: 2200,
          water_status: 'UNCOMMITTED',
        },
        notes: ['Utility commitments unassessed.'],
      },
      environmental_exposure: {
        title: 'Environmental Exposure',
        status: 'READY',
        metrics: {
          boundary_screening: 'inside_screening_boundary',
          boundary_source: 'geoBoundaries gbOpen IND ADM1',
          area_ha: 31.0,
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
        status: 'UNKNOWN',
        metrics: {
          total_artifacts: 0,
          total_assertions: 0,
          verified_assertions: 0,
          conflicting_assertions: 0,
          documented_assertions: 0,
        },
        notes: ['Zero evidence artifacts uploaded.'],
      },
    },
  ],
};

const TEST_PASSPORT: SiteReadinessPassport = {
  passport_id: 'pass-chakan01-sahyadri01',
  generated_at: '2026-10-29T12:00:00Z',
  project_id: 'proj-sahyadri-01',
  project_name: 'Sahyadri AI Hyperscale Campus',
  archetype: 'hyperscale',
  site_id: 'site-chakan-01',
  site_name: 'Chakan Greenfield Parcel A',
  state_code: 'IN-MH',
  district: 'Pune',
  parcel_area_ha: 24.5,
  boundary_source: 'geoBoundaries gbOpen IND ADM1',
  boundary_screening_status: 'inside_screening_boundary',
  epistemic_disclaimer:
    'Official Pre-Investment Screening Dossier. This passport compiles evidence records for preliminary screening only and does not constitute a legal approval, official clearance, or verified spare utility capacity reservation.',
  sections: [
    {
      section_id: 'sec_spatial',
      title: 'Spatial & Boundary Screening',
      status: 'SCREENING_VERIFIED',
      data: {
        area_ha: 24.5,
        state_code: 'IN-MH',
        district: 'Pune',
        boundary_source: 'geoBoundaries gbOpen IND ADM1',
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
            phase_name: 'Phase 1 - Initial 24MW Pod',
            commissioning_date: '2027-06-01',
            cumulative_it_mw: 24,
            cumulative_facility_peak_mw: 31.2,
            design_pue: 1.3,
            peak_summer_water_kld: 650,
          },
          {
            phase_sequence: 2,
            phase_name: 'Phase 2 - Campus Expansion 48MW',
            commissioning_date: '2029-06-01',
            cumulative_it_mw: 48,
            cumulative_facility_peak_mw: 62.4,
            design_pue: 1.3,
            peak_summer_water_kld: 1300,
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
          total_cumulative_it_mw: 80,
          total_cumulative_facility_peak_mw: 104,
          total_qualifying_firm_power_mw: 40,
          overall_power_gap_mw: 64,
          overall_power_status: 'PARTIAL',
          total_peak_summer_water_kld: 2200,
          total_qualifying_firm_water_kld: 1000,
          overall_water_gap_kld: 1200,
          overall_water_status: 'PARTIAL',
        },
      },
      findings: [
        {
          code: 'POWER_DEFICIT_FULL',
          domain: 'POWER',
          severity: 'CRITICAL',
          message: 'Full campus peak facility load (104 MW) leaves 64 MW unbacked by verified utility sanctions.',
        },
      ],
    },
  ],
  statutory_checklist: [
    {
      name: 'State Environmental Impact Assessment (SEIAA / MoEFCC)',
      mandate: 'EIA Notification 2006 for built-up area > 20,000 sq.m',
      status: 'EVIDENCE_REQUIRED',
    },
    {
      name: 'Consent to Establish (CTE / CTP)',
      mandate: 'State Pollution Control Board (DG emissions & STP effluent discharge)',
      status: 'EVIDENCE_REQUIRED',
    },
    {
      name: 'Dedicated Substation Feasibility Approval',
      mandate: 'STU / DISCOM dedicated 220kV or 110kV feeder and bay availability',
      status: 'ATTENTION_REQUIRED',
    },
    {
      name: 'PESO Explosives Licence for HSD Storage',
      mandate: 'Bulk High Speed Diesel fuel storage for standby backup generator sets',
      status: 'EVIDENCE_REQUIRED',
    },
  ],
};

function renderProjectsPage(path = '/projects?project=proj-sahyadri-01') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Projects />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Projects Page Real End-to-End Demo Integration Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      disconnect() {}
    });
    vi.stubEnv('VITE_MAPBOX_TOKEN', '');

    vi.spyOn(projectService, 'getProjects').mockResolvedValue({
      items: [TEST_PROJECT],
      total: 1,
    });
    vi.spyOn(projectService, 'getSites').mockResolvedValue(TEST_SITES);
    vi.spyOn(phaseService, 'getPhases').mockResolvedValue(TEST_PHASES);

    vi.spyOn(evidenceServiceModule.evidenceService, 'getArtifacts').mockResolvedValue([]);
    vi.spyOn(evidenceServiceModule.evidenceService, 'getAssertions').mockResolvedValue([]);
    vi.spyOn(evidenceServiceModule.evidenceService, 'getExtractions').mockResolvedValue([]);

    vi.spyOn(readinessServiceModule.readinessService, 'getProjectReadiness').mockResolvedValue(TEST_READINESS_REPORT);
    vi.spyOn(readinessServiceModule.readinessService, 'getProjectComparisons').mockResolvedValue(TEST_COMPARISONS);
    vi.spyOn(readinessServiceModule.readinessService, 'getSitePassport').mockResolvedValue(TEST_PASSPORT);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('renders project header, candidate sites, and phase editor', async () => {
    renderProjectsPage();

    await screen.findByRole('heading', { name: /Project candidate polygons/i });
    expect(await screen.findByText('3 / 3 active candidates')).toBeInTheDocument();
    expect(screen.getAllByText('Chakan Greenfield Parcel A')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Talegaon MIDC Parcel B')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Ranjangaon Industrial Parcel C')[0]).toBeInTheDocument();
  });

  it('renders ResourceReadinessTimeline with backend phase readiness data and commitment disclaimer', async () => {
    renderProjectsPage();

    await screen.findByText('Resource Readiness & Capacity Gap Timeline');

    // Capacity deficit and ceiling metrics
    expect(await screen.findByText('+64 MW Unbacked')).toBeInTheDocument();
    expect(screen.getByText('+1200 KLD Unbacked')).toBeInTheDocument();
    expect(screen.getByText(/Qualifying Firm Ceiling: 40 MW/i)).toBeInTheDocument();
    expect(screen.getByText(/Qualifying Firm Ceiling: 1000 KLD/i)).toBeInTheDocument();

    // Commitment gap disclaimer
    expect(
      screen.getByText(/Capacity gaps reflect evidenced commitment status, not confirmed physical utility deficits/i)
    ).toBeInTheDocument();

    // Findings ledger
    expect(
      screen.getByText(/Full campus peak facility load \(104 MW\) leaves 64 MW unbacked/i)
    ).toBeInTheDocument();
  });

  it('renders SiteComparisonMatrix comparing all 3 candidate sites across 4 independent dimensions', async () => {
    renderProjectsPage();

    await screen.findByText('3-Site Pre-Investment Comparison Matrix');

    // Epistemic disclaimer without black box scores
    expect(
      await screen.findByText(/Independent 4-dimension comparison. Does not compute a black-box composite score/i)
    ).toBeInTheDocument();

    // 4 dimensions present
    expect(screen.getByText(/Dimension 1: Resource Readiness/i)).toBeInTheDocument();
    expect(screen.getByText(/Dimension 2: Environmental & Spatial Screening/i)).toBeInTheDocument();
    expect(screen.getByText(/Dimension 3: Regulatory & State Policy Coverage/i)).toBeInTheDocument();
    expect(screen.getByText(/Dimension 4: Evidence Completeness & Integrity/i)).toBeInTheDocument();

    // Site deliverability values
    expect(screen.getByText('40 MW Firm')).toBeInTheDocument();
    expect(screen.getByText('20 MW Firm')).toBeInTheDocument();
    expect(screen.getByText('0 MW Firm')).toBeInTheDocument();
  });

  it('opens Site Readiness Passport modal and verifies sections and statutory checklist', async () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
    renderProjectsPage();

    // Click on Passport button for first candidate
    const passportButtons = await screen.findAllByRole('button', { name: /Passport/i });
    expect(passportButtons.length).toBeGreaterThan(0);
    fireEvent.click(passportButtons[0]);

    // Modal renders
    await screen.findByText(/Site Readiness Passport: Chakan Greenfield Parcel A/i);
    expect(screen.getByText(/Passport ID: pass-chakan01-sahyadri01/i)).toBeInTheDocument();
    expect(screen.getByText(/Pre-Investment Screening & Honesty Disclaimer/i)).toBeInTheDocument();

    // Check sections
    expect(screen.getByText(/1. Spatial & Boundary Screening/i)).toBeInTheDocument();
    expect(screen.getByText(/2. Campus Lifecycle & Phasing Progression/i)).toBeInTheDocument();
    expect(screen.getByText(/3. Deliverability & Deficit Balance/i)).toBeInTheDocument();
    expect(screen.getByText(/5. Mandatory Statutory Approvals Checklist/i)).toBeInTheDocument();

    // Check statutory checklist
    expect(screen.getByText(/State Environmental Impact Assessment \(SEIAA \/ MoEFCC\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Dedicated Substation Feasibility Approval/i)).toBeInTheDocument();

    // Trigger Print / Export PDF
    const printBtn = screen.getByRole('button', { name: /Print \/ Export PDF/i });
    fireEvent.click(printBtn);
    expect(printSpy).toHaveBeenCalled();

    // Close modal
    const closeBtn = screen.getByRole('button', { name: /Close/i });
    fireEvent.click(closeBtn);

    await waitFor(() => {
      expect(screen.queryByText(/Passport ID: pass-chakan01-sahyadri01/i)).not.toBeInTheDocument();
    });
  });
});

