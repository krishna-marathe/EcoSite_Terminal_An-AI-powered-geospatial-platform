import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ExtractionReviewDrawer } from './ExtractionReviewDrawer';
import { INITIAL_MOCK_EXTRACTIONS } from '../../services/evidence';

describe('ExtractionReviewDrawer Component', () => {
  it('renders extraction candidate facts and raw snippet bounding box', () => {
    render(
      <ExtractionReviewDrawer
        isOpen={true}
        onClose={vi.fn()}
        extractions={INITIAL_MOCK_EXTRACTIONS}
        onConfirm={vi.fn()}
      />
    );

    expect(screen.getByText(/Document Intelligence Extraction Review/i)).toBeInTheDocument();
    expect(screen.getAllByText('Sanctioned Grid Power').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/contract demand of 40.0 MW/i)).toBeInTheDocument();
    expect(screen.getAllByText('40').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('MW').length).toBeGreaterThanOrEqual(1);
  });

  it('triggers confirmation decision on clicking Confirm & Verify Field', async () => {
    const handleConfirm = vi.fn().mockResolvedValue(undefined);
    render(
      <ExtractionReviewDrawer
        isOpen={true}
        onClose={vi.fn()}
        extractions={INITIAL_MOCK_EXTRACTIONS}
        onConfirm={handleConfirm}
      />
    );

    const confirmBtn = screen.getByRole('button', { name: /✓ Confirm & Verify Field/i });
    fireEvent.click(confirmBtn);

    expect(handleConfirm).toHaveBeenCalledWith('ext-001', 'ACCEPTED', undefined);
  });

  it('allows editing extraction value before confirmation', async () => {
    const handleConfirm = vi.fn().mockResolvedValue(undefined);
    render(
      <ExtractionReviewDrawer
        isOpen={true}
        onClose={vi.fn()}
        extractions={INITIAL_MOCK_EXTRACTIONS}
        onConfirm={handleConfirm}
      />
    );

    const editBtn = screen.getByRole('button', { name: /^Edit$/i });
    fireEvent.click(editBtn);

    const input = screen.getByDisplayValue('40');
    fireEvent.change(input, { target: { value: '45' } });

    const confirmBtn = screen.getByRole('button', { name: /✓ Confirm & Verify Field/i });
    fireEvent.click(confirmBtn);

    expect(handleConfirm).toHaveBeenCalledWith('ext-001', 'ACCEPTED', 45);
  });
});
