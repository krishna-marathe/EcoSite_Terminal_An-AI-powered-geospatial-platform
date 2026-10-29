import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DataCentreAiInsightsCard } from './DataCentreAiInsightsCard';
import { publicFacilityFixture } from './facilityTestFixtures';

describe('DataCentreAiInsightsCard Component', () => {
  it('renders AI situational briefing header, criticality badge, and recommendations', () => {
    render(<DataCentreAiInsightsCard facility={publicFacilityFixture} />);

    expect(screen.getByText('AI Situational Briefing & Advisory')).toBeInTheDocument();
    expect(screen.getByText('GROUNDED INSIGHTS')).toBeInTheDocument();
    expect(screen.getByText(/Campus Vulnerability & Resource Posture/i)).toBeInTheDocument();
    expect(screen.getByText(/Recommended Engineering Interventions/i)).toBeInTheDocument();
    expect(screen.getByText(/Statutory Clearances & Permitting Checklist/i)).toBeInTheDocument();
    expect(screen.getByText(/Advisory Notice:/i)).toBeInTheDocument();
  });

  it('filters interventions by category button click', () => {
    render(<DataCentreAiInsightsCard facility={publicFacilityFixture} />);

    // Click WATER filter
    const waterBtn = screen.getByRole('button', { name: 'WATER' });
    fireEvent.click(waterBtn);

    expect(screen.getAllByText(/Water Conservation/i).length).toBeGreaterThanOrEqual(1);
  });

  it('supports compact collapsible mode', () => {
    render(<DataCentreAiInsightsCard facility={publicFacilityFixture} compact />);

    expect(screen.getByText('AI Situational Briefing & Advisory')).toBeInTheDocument();
    // In compact mode initially collapsed
    const expandBtn = screen.getByRole('button', { name: 'Expand AI insights' });
    expect(expandBtn).toBeInTheDocument();

    fireEvent.click(expandBtn);
    expect(screen.getByText(/Campus Vulnerability & Resource Posture/i)).toBeInTheDocument();
  });
});

