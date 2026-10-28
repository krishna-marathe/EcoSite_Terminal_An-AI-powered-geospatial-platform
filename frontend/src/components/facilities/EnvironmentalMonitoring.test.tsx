import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EnvironmentalCurrent } from './EnvironmentalCurrent';
import { EnvironmentalTimeSeries } from './EnvironmentalTimeSeries';
import { currentFixture, rangeFixture } from './facilityTestFixtures';

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
}));

describe('Environmental monitoring components', () => {
  it('shows current values, explicit missing coverage and station context', () => {
    render(<EnvironmentalCurrent data={currentFixture} />);
    expect(screen.getByText('41.2 ug/m3')).toBeInTheDocument();
    expect(screen.getByText('NOT COVERED')).toBeInTheDocument();
    expect(screen.getByText(/Powai monitoring station/)).toBeInTheDocument();
    expect(screen.getByText(/not an on-site facility measurement/i)).toBeInTheDocument();
  });

  it('changes the requested time range and retains missing intervals', () => {
    const onRangeChange = vi.fn();
    render(<EnvironmentalTimeSeries data={rangeFixture} range="24h" onRangeChange={onRangeChange} />);
    fireEvent.click(screen.getByRole('button', { name: '30d' }));
    expect(onRangeChange).toHaveBeenCalledWith('30d');
    expect(screen.getByLabelText('PM2.5 chart')).toBeInTheDocument();
  });
});

