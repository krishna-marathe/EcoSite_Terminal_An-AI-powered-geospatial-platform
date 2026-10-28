import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { MinistryDashboard } from './MinistryDashboard';
import type { MinistryOverviewData } from '../components/workflows/types';

afterEach(cleanup);

const overview: MinistryOverviewData = {
  generatedAt: '2026-10-29T12:00:00Z', facilityCount: 19,
  states: [{ stateCode: 'IN-MH', facilityCount: 8, currentFacilityCount: 5, staleFacilityCount: 1, unavailableFacilityCount: 2 }],
  sourceHealth: [{ sourceId: 'cpcb_caaqms', provider: 'Central Pollution Control Board', status: 'NOT_CONNECTED', lastCheckedAt: null, lastSuccessAt: null, staleFacilityCount: 0, failedRunCount: 0 }],
  freshnessQueue: [{ facilityId: 'mumbai-01', facilityName: 'Mumbai 01', stateCode: 'IN-MH', metric: 'pm25', status: 'not_covered', observedAt: null, ageSeconds: null, sourceId: null, reason: 'No eligible station link' }],
};

it('shows ministry operational signals without describing them as enforcement', () => {
  render(<MinistryDashboard overview={overview} />);
  expect(screen.getByRole('heading', { name: 'Data-centre operations' })).toBeTruthy();
  expect(screen.getByText('Prototype identity only')).toBeTruthy();
  expect(screen.getByText('Central Pollution Control Board')).toBeTruthy();
  expect(screen.getByText('No eligible station link')).toBeTruthy();
  expect(screen.getByText(/does not trigger automatic enforcement/)).toBeTruthy();
});

it('renders an honest unavailable state without inventing data', () => {
  render(<MinistryDashboard error="Ministry service is unavailable." />);
  expect(screen.getAllByRole('alert').some((node) => node.textContent?.includes('Ministry service is unavailable'))).toBe(true);
  expect(screen.queryByText('19')).toBeNull();
});
