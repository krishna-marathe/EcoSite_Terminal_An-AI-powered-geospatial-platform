import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RiskScorePanel } from './RiskScorePanel';
import { riskFixture } from './facilityTestFixtures';

describe('RiskScorePanel', () => {
  it('shows the score, band and coverage', () => {
    render(<RiskScorePanel data={riskFixture} />);
    expect(screen.getByText('Environmental risk score')).toBeInTheDocument();
    expect(screen.getByText('Moderate')).toBeInTheDocument();
    expect(screen.getByText('78%')).toBeInTheDocument();
    expect(screen.getByText('27.8')).toBeInTheDocument();
  });

  it('keeps unavailable parameters visible with their reason instead of a zero', () => {
    render(<RiskScorePanel data={riskFixture} />);
    expect(screen.getByText('Groundwater depth below ground')).toBeInTheDocument();
    expect(screen.getByText('No keyless groundwater feed is connected.')).toBeInTheDocument();
    expect(screen.getAllByText('Unavailable').length).toBeGreaterThan(0);
    expect(screen.getByText(/excluded from the score, not scored as zero/i)).toBeInTheDocument();
  });

  it('renders an unscored band without inventing a number', () => {
    render(
      <RiskScorePanel
        data={{ ...riskFixture, score: null, band: 'unknown', coverage: 0, confidence: 'low' }}
      />
    );
    expect(screen.getByText('Not scored')).toBeInTheDocument();
    expect(screen.queryByText('42.5')).not.toBeInTheDocument();
  });
});
