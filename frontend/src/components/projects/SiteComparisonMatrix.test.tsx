import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SiteComparisonMatrix } from './SiteComparisonMatrix';
import type { CandidateSite } from '../../services/projects';
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

describe('SiteComparisonMatrix Component', () => {
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
