import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { EvidenceWorkspace } from './EvidenceWorkspace';
import { INITIAL_MOCK_ARTIFACTS, INITIAL_MOCK_ASSERTIONS } from '../../services/evidence';

describe('EvidenceWorkspace Component', () => {
  it('renders assertions with correct status indicators', () => {
    render(
      <EvidenceWorkspace
        projectId="proj-pune"
        artifacts={INITIAL_MOCK_ARTIFACTS}
        assertions={INITIAL_MOCK_ASSERTIONS}
        onUpload={vi.fn()}
      />
    );

    expect(screen.getByText('Project Evidence & Document Vault')).toBeInTheDocument();
    expect(screen.getByText('Sanctioned Grid Power')).toBeInTheDocument();
    expect(screen.getByText('40 MW')).toBeInTheDocument();
    expect(screen.getAllByText(/Verified within Scope/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Conflicting/i).length).toBeGreaterThanOrEqual(1);
  });

  it('renders uploaded artifact cards with metadata and synthetic demo badges', () => {
    render(
      <EvidenceWorkspace
        projectId="proj-pune"
        artifacts={INITIAL_MOCK_ARTIFACTS}
        assertions={INITIAL_MOCK_ASSERTIONS}
        onUpload={vi.fn()}
      />
    );

    expect(screen.getByText('MSEDCL_Grid_Sanction_Phase1_40MW.pdf')).toBeInTheDocument();
    expect(screen.getByText('MIDC_Industrial_Water_Allocation_1800KLD.pdf')).toBeInTheDocument();
    const demoBadges = screen.getAllByText('SYNTHETIC_DEMO');
    expect(demoBadges.length).toBeGreaterThanOrEqual(1);
  });

  it('opens the upload modal on clicking + Upload Evidence', async () => {
    render(
      <EvidenceWorkspace
        projectId="proj-pune"
        artifacts={INITIAL_MOCK_ARTIFACTS}
        assertions={INITIAL_MOCK_ASSERTIONS}
        onUpload={vi.fn()}
      />
    );

    const uploadBtn = screen.getByRole('button', { name: /\+ Upload Evidence/i });
    fireEvent.click(uploadBtn);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Upload Project Evidence Artifact/i)).toBeInTheDocument();
  });

  it('triggers assertion verification action', async () => {
    const handleReview = vi.fn().mockResolvedValue(undefined);
    render(
      <EvidenceWorkspace
        projectId="proj-pune"
        artifacts={INITIAL_MOCK_ARTIFACTS}
        assertions={INITIAL_MOCK_ASSERTIONS}
        onUpload={vi.fn()}
        onReviewAssertion={handleReview}
      />
    );

    const verifyBtns = screen.getAllByRole('button', { name: /^Verify$/i });
    expect(verifyBtns.length).toBeGreaterThan(0);
    fireEvent.click(verifyBtns[0]);

    expect(handleReview).toHaveBeenCalledWith(expect.any(String), 'VERIFIED_WITHIN_SCOPE');
  });
});
