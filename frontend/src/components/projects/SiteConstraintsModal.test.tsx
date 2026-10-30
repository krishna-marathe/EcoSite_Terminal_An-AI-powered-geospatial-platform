import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SiteConstraintsModal } from './SiteConstraintsModal';
import type { CandidateSite } from '../../services/projects';

const mockSite: CandidateSite = {
  id: 'site-1',
  project_id: 'proj-1',
  name: 'Chakan Greenfield Parcel A',
  state_code: 'IN-MH',
  district: 'Pune',
  area_ha: 15.0,
  geometry: {
    type: 'Polygon',
    coordinates: [[[73.5, 18.7], [73.6, 18.7], [73.6, 18.8], [73.5, 18.8], [73.5, 18.7]]],
  },
  boundary_source: 'geoBoundaries gbOpen IND ADM1',
  boundary_sha256: 'sha-sample',
  geometry_hash: 'geom-sample',
  boundary_screening: {
    status: 'inside_screening_boundary',
    version: '1.0',
    licence: 'Screening',
  },
  revision: 1,
  status: 'active',
  created_at: '2026-10-20T00:00:00Z',
  updated_at: '2026-10-20T00:00:00Z',
};

describe('SiteConstraintsModal', () => {
  it('renders modal with gate evaluation, input values and epistemic rationale', () => {
    const handleClose = vi.fn();
    render(
      <SiteConstraintsModal
        isOpen={true}
        onClose={handleClose}
        site={mockSite}
        observations={[]}
        assertions={[]}
      />
    );

    expect(screen.getByText(/Explainable Hard Constraints: Chakan Greenfield Parcel A/i)).toBeInTheDocument();
    expect(screen.getByText('Focus State ADM1 Screening Boundary')).toBeInTheDocument();
    expect(screen.getByText('Historical Surface Water Overlap')).toBeInTheDocument();
    expect(screen.getByText('Grid Headroom & Sanction Verification')).toBeInTheDocument();

    // Rationale checking proximity != capacity
    expect(
      screen.getByText(/Substation proximity does NOT establish spare grid capacity/i)
    ).toBeInTheDocument();

    // Close button
    const closeBtn = screen.getByRole('button', { name: /^Close$/i });
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalled();
  });

  it('does not render when isOpen is false', () => {
    render(
      <SiteConstraintsModal
        isOpen={false}
        onClose={vi.fn()}
        site={mockSite}
      />
    );

    expect(screen.queryByText(/Explainable Hard Constraints/i)).not.toBeInTheDocument();
  });
});

