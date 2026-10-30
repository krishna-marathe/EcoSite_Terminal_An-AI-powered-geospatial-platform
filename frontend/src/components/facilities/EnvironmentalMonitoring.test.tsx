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
    expect(screen.getByText('Official CPCB & IMD station network · Surrounding ambient baseline')).toBeInTheDocument();
    expect(screen.getByText('41.2 ug/m3')).toBeInTheDocument();
    expect(screen.getByText('NOT COVERED')).toBeInTheDocument();
    expect(screen.getByText(/Powai monitoring station/)).toBeInTheDocument();
    expect(screen.getByText(/not an on-site facility measurement/i)).toBeInTheDocument();
  });

  it('changes the requested time range and retains missing intervals', () => {
    const onRangeChange = vi.fn();
    render(<EnvironmentalTimeSeries data={rangeFixture} range="24h" onRangeChange={onRangeChange} />);
    expect(screen.getByText('Official CPCB & IMD station network · Surrounding ambient baseline')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '30d' }));
    expect(onRangeChange).toHaveBeenCalledWith('30d');
    expect(screen.getByLabelText('PM2.5 chart')).toBeInTheDocument();
  });

  it('renders official CPCB & IMD institutional subtitle in EnvironmentalCurrent', () => {
    render(<EnvironmentalCurrent data={currentFixture} />);
    expect(
      screen.getByText('Official CPCB & IMD station network · Surrounding ambient baseline')
    ).toBeInTheDocument();
  });

  it('renders official CPCB & IMD institutional subtitle in EnvironmentalTimeSeries', () => {
    const onRangeChange = vi.fn();
    render(<EnvironmentalTimeSeries data={rangeFixture} range="24h" onRangeChange={onRangeChange} />);
    expect(
      screen.getByText('Official CPCB & IMD station network · Surrounding ambient baseline')
    ).toBeInTheDocument();
  });

  it('retains institutional subtitle during loading or empty states in both components', () => {
    const onRangeChange = vi.fn();
    const institutionalSubtitle = 'Official CPCB & IMD station network · Surrounding ambient baseline';

    // Current component empty state
    const { unmount: unmountCurrent } = render(<EnvironmentalCurrent data={null} loading={false} />);
    expect(screen.getByText(institutionalSubtitle)).toBeInTheDocument();
    unmountCurrent();

    // Time-series component empty state
    render(<EnvironmentalTimeSeries data={null} range="24h" onRangeChange={onRangeChange} loading={false} />);
    expect(screen.getByText(institutionalSubtitle)).toBeInTheDocument();
  });
});

