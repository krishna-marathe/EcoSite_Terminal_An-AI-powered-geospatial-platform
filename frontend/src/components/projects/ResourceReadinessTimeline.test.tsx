import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ResourceReadinessTimeline } from './ResourceReadinessTimeline';
import type { ProjectPhase } from '../../services/phases';
import type { Assertion } from '../../types/evidence';
import type { ProjectReadinessReport } from '../../types/readiness';

const MOCK_PHASES: ProjectPhase[] = [
  {
    id: 'phase-01',
    project_id: 'proj-01',
    sequence: 1,
    name: 'Initial Buildout',
    commissioning_date: '2027-06-01',
    cumulative_it_mw: 20,
    cumulative_facility_peak_mw: 26,
    design_pue: 1.3,
    average_water_kld: 400,
    peak_summer_water_kld: 700,
    cooling_type: 'Evaporative Hybrid',
    revision: 1,
    status: 'active',
    created_at: '2026-10-20T10:00:00Z',
    updated_at: '2026-10-20T10:00:00Z',
    warnings: [],
  },
  {
    id: 'phase-02',
    project_id: 'proj-01',
    sequence: 2,
    name: 'Campus Expansion',
    commissioning_date: '2029-06-01',
    cumulative_it_mw: 50,
    cumulative_facility_peak_mw: 65,
    design_pue: 1.3,
    average_water_kld: 900,
    peak_summer_water_kld: 1600,
    cooling_type: 'Evaporative Hybrid',
    revision: 1,
    status: 'active',
    created_at: '2026-10-20T10:00:00Z',
    updated_at: '2026-10-20T10:00:00Z',
    warnings: [],
  },
  {
    id: 'phase-03',
    project_id: 'proj-01',
    sequence: 3,
    name: 'Full Buildout',
    commissioning_date: '2032-06-01',
    cumulative_it_mw: 80,
    cumulative_facility_peak_mw: 104,
    design_pue: 1.15, // Discrepancy with implied 104 / 80 = 1.30
    average_water_kld: 1400,
    peak_summer_water_kld: 2800,
    cooling_type: 'Liquid + Air Hybrid',
    revision: 1,
    status: 'active',
    created_at: '2026-10-20T10:00:00Z',
    updated_at: '2026-10-20T10:00:00Z',
    warnings: [],
  },
];

const MOCK_ASSERTIONS: Assertion[] = [
  {
    id: 'asrt-01',
    project_id: 'proj-01',
    field_key: 'sanctioned_grid_mw',
    field_label: 'Sanctioned Grid Power',
    value: 40,
    unit: 'MW',
    scope_type: 'PHASE',
    status: 'VERIFIED_WITHIN_SCOPE',
    asserted_by: 'MSEDCL',
    asserted_at: '2026-10-20T10:00:00Z',
    evidence_artifact_ids: ['art-01'],
    revision: 1,
  },
  {
    id: 'asrt-02',
    project_id: 'proj-01',
    field_key: 'water_allocation_kld',
    field_label: 'Water Allocation',
    value: 1800,
    unit: 'KLD',
    scope_type: 'CAMPUS',
    status: 'VERIFIED_WITHIN_SCOPE',
    asserted_by: 'MIDC',
    asserted_at: '2026-10-20T10:00:00Z',
    evidence_artifact_ids: ['art-02'],
    revision: 1,
  },
];

const MOCK_BACKEND_REPORT: ProjectReadinessReport = {
  project_id: 'proj-01',
  project_name: 'Pune Hyperscale Campus',
  evaluated_at: '2026-10-29T12:00:00Z',
  campus_summary: {
    total_phases: 2,
    total_cumulative_it_mw: 50,
    total_cumulative_facility_peak_mw: 65,
    total_qualifying_firm_power_mw: 40,
    overall_power_gap_mw: 25,
    overall_power_status: 'PARTIAL',
    total_peak_summer_water_kld: 1600,
    total_qualifying_firm_water_kld: 1600,
    overall_water_gap_kld: 0,
    overall_water_status: 'MET',
    critical_findings_count: 0,
    warning_findings_count: 1,
  },
  phases: [
    {
      phase_id: 'ph-1',
      phase_sequence: 1,
      phase_name: 'Phase 1 - Initial Buildout',
      commissioning_date: '2027-06-01',
      cooling_type: 'Evaporative Hybrid',
      design_pue: 1.3,
      power: {
        phase_sequence: 1,
        demand_mw: 26,
        incremental_demand_mw: 26,
        verified_capacity_mw: 40,
        documented_capacity_mw: 0,
        qualifying_firm_capacity_mw: 26,
        proposed_capacity_mw: 0,
        unverified_capacity_mw: 0,
        power_gap_mw: 0,
        power_surplus_mw: 14,
        status: 'MET',
        qualifying_commitments_count: 1,
        total_commitments_count: 1,
      },
      water: {
        phase_sequence: 1,
        peak_summer_demand_kld: 700,
        average_demand_kld: 400,
        verified_allocated_kld: 1600,
        documented_allocated_kld: 0,
        qualifying_firm_allocated_kld: 700,
        proposed_kld: 0,
        unverified_kld: 0,
        water_gap_kld: 0,
        water_surplus_kld: 900,
        status: 'MET',
        qualifying_commitments_count: 1,
        total_commitments_count: 1,
      },
      findings: [],
    },
    {
      phase_id: 'ph-2',
      phase_sequence: 2,
      phase_name: 'Phase 2 - Campus Expansion',
      commissioning_date: '2029-06-01',
      cooling_type: 'Evaporative Hybrid',
      design_pue: 1.3,
      power: {
        phase_sequence: 2,
        demand_mw: 65,
        incremental_demand_mw: 39,
        verified_capacity_mw: 40,
        documented_capacity_mw: 0,
        qualifying_firm_capacity_mw: 40,
        proposed_capacity_mw: 25,
        unverified_capacity_mw: 0,
        power_gap_mw: 25,
        power_surplus_mw: 0,
        status: 'PARTIAL',
        qualifying_commitments_count: 1,
        total_commitments_count: 2,
      },
      water: {
        phase_sequence: 2,
        peak_summer_demand_kld: 1600,
        average_demand_kld: 900,
        verified_allocated_kld: 1600,
        documented_allocated_kld: 0,
        qualifying_firm_allocated_kld: 1600,
        proposed_kld: 0,
        unverified_kld: 0,
        water_gap_kld: 0,
        water_surplus_kld: 0,
        status: 'MET',
        qualifying_commitments_count: 1,
        total_commitments_count: 1,
      },
      findings: [
        {
          code: 'POWER_GAP_P2',
          domain: 'POWER',
          severity: 'WARNING',
          message: 'Phase 2 demand (65 MW) exceeds verified substation firm delivery (40 MW) by 25 MW.',
        },
      ],
    },
  ],
  all_findings: [
    {
      code: 'POWER_GAP_P2',
      domain: 'POWER',
      severity: 'WARNING',
      message: 'Phase 2 demand (65 MW) exceeds verified substation firm delivery (40 MW) by 25 MW.',
    },
  ],
};

describe('ResourceReadinessTimeline Component', () => {
  describe('legacy fallback mode', () => {
    it('renders capacity readiness timeline and correctly calculates power deficit', () => {
      render(<ResourceReadinessTimeline phases={MOCK_PHASES} assertions={MOCK_ASSERTIONS} />);

      expect(screen.getByText('Resource Readiness & Capacity Gap Timeline')).toBeInTheDocument();
      expect(screen.getByText(/Full Buildout Power Deficit:/i)).toBeInTheDocument();
      expect(screen.getByText('+64 MW Unbacked')).toBeInTheDocument();
    });

    it('renders water allocation comparison and calculates peak summer gap', () => {
      render(<ResourceReadinessTimeline phases={MOCK_PHASES} assertions={MOCK_ASSERTIONS} />);

      expect(screen.getByText(/Summer Water Gap:/i)).toBeInTheDocument();
      expect(screen.getByText('+1000 KLD Unbacked')).toBeInTheDocument();
    });

    it('detects PUE discrepancy when design PUE differs from implied peak ratio', () => {
      render(<ResourceReadinessTimeline phases={MOCK_PHASES} assertions={MOCK_ASSERTIONS} />);

      expect(screen.getByText(/Discrepancy \(1.15 vs 1.3\)/i)).toBeInTheDocument();
    });

    it('handles empty phase state gracefully', () => {
      render(<ResourceReadinessTimeline phases={[]} assertions={[]} />);
      expect(screen.getByText(/No development phases defined/i)).toBeInTheDocument();
    });
  });

  describe('backend readiness report mode', () => {
    it('renders backend calculated metrics, gaps and status badges', () => {
      render(<ResourceReadinessTimeline readinessReport={MOCK_BACKEND_REPORT} />);

      expect(screen.getByText('+25 MW Unbacked')).toBeInTheDocument();
      expect(screen.getAllByText('PARTIAL').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('MET').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Fully Covered')).toBeInTheDocument();
      expect(screen.getByText(/Qualifying Firm Ceiling: 40 MW/i)).toBeInTheDocument();
      expect(screen.getByText(/Qualifying Firm Ceiling: 1600 KLD/i)).toBeInTheDocument();
    });

    it('renders the commitment gap disclaimer note', () => {
      render(<ResourceReadinessTimeline readinessReport={MOCK_BACKEND_REPORT} />);

      expect(
        screen.getByText(/Capacity gaps reflect evidenced commitment status, not confirmed physical utility deficits/i)
      ).toBeInTheDocument();
    });

    it('renders backend findings ledger with severity and message', () => {
      render(<ResourceReadinessTimeline readinessReport={MOCK_BACKEND_REPORT} />);

      expect(screen.getByText('Readiness Findings & Epistemic Gaps (1)')).toBeInTheDocument();
      expect(screen.getByText('WARNING')).toBeInTheDocument();
      expect(
        screen.getByText('Phase 2 demand (65 MW) exceeds verified substation firm delivery (40 MW) by 25 MW.')
      ).toBeInTheDocument();
    });

    it('handles loading and error states', () => {
      const { rerender } = render(<ResourceReadinessTimeline loading={true} />);
      expect(screen.getByText(/Calculating evidence-backed resource readiness curves…/i)).toBeInTheDocument();

      rerender(<ResourceReadinessTimeline error="Network failure on commitments endpoint" />);
      expect(screen.getByText('Unable to load resource readiness report')).toBeInTheDocument();
      expect(screen.getByText('Network failure on commitments endpoint')).toBeInTheDocument();
    });
  });
});
