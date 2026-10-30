import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { InfrastructurePredictionsPanel } from './InfrastructurePredictionsPanel';

describe('InfrastructurePredictionsPanel', () => {
  it('renders situational forecast title and prediction questions', () => {
    render(<InfrastructurePredictionsPanel />);

    expect(screen.getByText('Infrastructure & risk predictions')).toBeInTheDocument();
    expect(screen.getByText(/Illustrative screening scenarios/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Chakan Taluka Groundwater Over-Extraction/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Peak Summer 230kV Substation N-1 Transmission Curtailment/i)
    ).toBeInTheDocument();
  });

  it('filters predictions by category', () => {
    render(<InfrastructurePredictionsPanel />);

    // Click WATER filter
    fireEvent.click(screen.getByRole('button', { name: 'WATER' }));

    expect(
      screen.getByText(/Chakan Taluka Groundwater Over-Extraction/i)
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Peak Summer 230kV Substation N-1 Transmission Curtailment/i)
    ).toBeNull();

    // Click POWER_GRID filter
    fireEvent.click(screen.getByRole('button', { name: 'POWER_GRID' }));

    expect(
      screen.getByText(/Peak Summer 230kV Substation N-1 Transmission Curtailment/i)
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Chakan Taluka Groundwater Over-Extraction/i)
    ).toBeNull();
  });
});

