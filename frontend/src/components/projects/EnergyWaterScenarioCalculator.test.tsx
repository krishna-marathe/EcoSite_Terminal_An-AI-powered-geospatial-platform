import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EnergyWaterScenarioCalculator } from './EnergyWaterScenarioCalculator';

describe('EnergyWaterScenarioCalculator', () => {
  it('renders default scenario projections and epistemic honesty disclaimer', () => {
    render(<EnergyWaterScenarioCalculator initialItMw={40} initialParcelAreaHa={15} siteName="Navi Mumbai Campus" />);

    expect(
      screen.getByText(/Energy & Water Scenario Exploration \(OpenDC-LCA Physics\)/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Grounded engineering scenarios for Navi Mumbai Campus/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Hypothetical Exploratory Scenarios — Not Binding Sanctions/i)
    ).toBeInTheDocument();

    // Default calculations for 40 MW at CF 0.8:
    // IT Energy = 40 * 0.8 * 8760 = 280,320 MWh/yr (or 2,80,320 in en-IN locale)
    // Facility Energy (PUE 1.28) = 280,320 * 1.28 = 358,810 MWh/yr
    // Water = 280,320,000 * 1.20 / 1000 = 336,384 m3/yr -> daily = 922 KLD
    expect(screen.getByText(/2[,\s]?80[,\s]?320\s+MWh\/yr/i)).toBeInTheDocument();
    expect(screen.getByText(/3[,\s]?58[,\s]?810\s+MWh\/yr/i)).toBeInTheDocument();
    expect(screen.getByText(/922\s+KLD/i)).toBeInTheDocument();
  });

  it('updates projections when cooling architecture is changed to air cooled', () => {
    render(<EnergyWaterScenarioCalculator initialItMw={40} />);

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'AIR_COOLED_DRY' } });

    // Air cooled has PUE 1.42 and WUE 0.05
    // Facility Energy = 280,320 * 1.42 = 398,054 MWh/yr (or 3,98,054)
    // Water = 280,320,000 * 0.05 / 1000 = 14,016 m3/yr -> daily = 38 KLD
    expect(screen.getByText(/3[,\s]?98[,\s]?054\s+MWh\/yr/i)).toBeInTheDocument();
    expect(screen.getByText(/38\s+KLD/i)).toBeInTheDocument();
    expect(screen.getByText(/WUE\s+0\.05\s+L\/kWh/i)).toBeInTheDocument();
  });

  it('toggles explainable formulas and assumptions accordion', () => {
    render(<EnergyWaterScenarioCalculator />);

    const toggleButton = screen.getByRole('button', { name: /Show Explainable Formulas & Scientific Assumptions/i });
    expect(screen.queryByText(/OpenDC-LCA & BIS IS 15797:2008/i)).not.toBeInTheDocument();

    fireEvent.click(toggleButton);
    expect(screen.getByText(/OpenDC-LCA & BIS IS 15797:2008/i)).toBeInTheDocument();
    expect(screen.getByText(/E_IT \[MWh\] = P_IT \[MW\] × Capacity Factor × 8,760 hours/i)).toBeInTheDocument();
    expect(screen.getByText(/Q \[L\/yr\] = Rainfall \[mm\] × Catchment \[m²\] × Runoff Coeff/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Hide Explainable Formulas & Scientific Assumptions/i }));
    expect(screen.queryByText(/OpenDC-LCA & BIS IS 15797:2008/i)).not.toBeInTheDocument();
  });
});
