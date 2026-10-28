import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PublicFacilityDetail } from './PublicFacilityDetail';
import { currentFixture, publicFacilityFixture, rangeFixture } from '../components/facilities/facilityTestFixtures';

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
}));

describe('PublicFacilityDetail', () => {
  it('composes profile and environmental context without fetching', () => {
    const onBack = vi.fn();
    render(<PublicFacilityDetail facility={publicFacilityFixture} current={currentFixture} trend={rangeFixture} range="24h" onRangeChange={() => {}} onBack={onBack} />);
    expect(screen.getByRole('heading', { level: 1, name: publicFacilityFixture.name })).toBeInTheDocument();
    expect(screen.getByText('Current environmental context')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /registry/i }));
    expect(onBack).toHaveBeenCalledOnce();
  });
});

