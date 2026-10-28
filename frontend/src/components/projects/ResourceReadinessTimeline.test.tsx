import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ResourceReadinessTimeline } from './ResourceReadinessTimeline';
import type { ProjectPhase } from '../../services/phases';
import type { Assertion } from '../../types/evidence';

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

describe('ResourceReadinessTimeline Component', () => {
  it('renders capacity readiness timeline and correctly calculates power deficit', () => {
    render(<ResourceReadinessTimeline phases={MOCK_PHASES} assertions={MOCK_ASSERTIONS} />);

    expect(screen.getByText('Resource Readiness & Capacity Gap Timeline')).toBeInTheDocument();
    expect(screen.getByText(/Full Buildout Power Deficit:/i)).toBeInTheDocument();
    // 104 MW required vs 40 MW sanctioned = 64 MW deficit
    expect(screen.getByText('+64 MW Unbacked')).toBeInTheDocument();
  });

  it('renders water allocation comparison and calculates peak summer gap', () => {
    render(<ResourceReadinessTimeline phases={MOCK_PHASES} assertions={MOCK_ASSERTIONS} />);

    expect(screen.getByText(/Summer Water Gap:/i)).toBeInTheDocument();
    // 2800 KLD peak vs 1800 KLD allocated = 1000 KLD deficit
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
