import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useDashboardStore } from '../../stores/dashboardStore';
import { StatusBar } from './StatusBar';

beforeEach(() => {
  useDashboardStore.setState(useDashboardStore.getInitialState(), true);
  useDashboardStore.setState({ facilitiesStatus: 'ready' });
});
afterEach(cleanup);

describe('StatusBar data-centre scope', () => {
  it('shows only the data-centre legend and public registry status on ministry routes', () => {
    render(<MemoryRouter initialEntries={['/ministry/review']}><StatusBar /></MemoryRouter>);

    expect(screen.getByText('Public data-centre registry ready')).toBeTruthy();
    expect(screen.getByText('Data centre')).toBeTruthy();
    expect(screen.queryByText('Thermal power')).toBeNull();
    expect(screen.queryByText('Synthetic demo')).toBeNull();
  });

  it('keeps the explicit evidence-mode badge for local candidate screening', () => {
    render(<MemoryRouter initialEntries={['/site-analysis']}><StatusBar /></MemoryRouter>);

    expect(screen.getByText('Candidate evidence ready')).toBeTruthy();
    expect(screen.getByText('Synthetic demo')).toBeTruthy();
  });
});
