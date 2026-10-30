import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Dashboard } from './Dashboard';
import { useDashboardStore } from '../stores/dashboardStore';
import * as publicFacilitiesService from '../services/publicFacilities';
import * as environmentalService from '../services/environmentalMonitoring';
import * as ministryService from '../services/ministryOperations';
import type { PublicFacility, PublicStateCode } from '../types/publicFacilities';

vi.mock('../services/publicFacilities', () => ({
  getPublicFacilities: vi.fn(),
  getPublicFacilitySummary: vi.fn(),
}));
vi.mock('../services/environmentalMonitoring', () => ({
  getEnvironmentalStateSummary: vi.fn(),
  getFacilityEnvironmentalCurrent: vi.fn(),
}));
vi.mock('../services/ministryOperations', () => ({ getMinistryOverview: vi.fn() }));
vi.mock('../components/layout/LeftSidebar', () => ({ LeftSidebar: () => <div data-testid="left-sidebar" /> }));
vi.mock('../components/map/MainMap', () => ({
  MainMap: ({
    publicDataCentres,
    publicDataCentresStatus,
    suppressLegacyFacilities,
    onSelectPublicFacility,
  }: {
    publicDataCentres?: PublicFacility[];
    publicDataCentresStatus?: string;
    suppressLegacyFacilities?: boolean;
    onSelectPublicFacility?: (facility: PublicFacility) => void;
  }) => <div data-testid="main-map">
    Map status: {publicDataCentresStatus}; legacy suppressed: {String(suppressLegacyFacilities)}
    {publicDataCentres?.map((facility) => <button key={facility.id} onClick={() => onSelectPublicFacility?.(facility)}>Select {facility.name}</button>)}
  </div>,
}));

const facility: PublicFacility = {
  id: 'dc-mh-1',
  name: 'Mumbai Public DC',
  operator: 'Example Operator',
  ownershipCategory: 'private',
  facilityType: 'colocation',
  stateCode: 'IN-MH',
  state: 'Maharashtra',
  city: 'Mumbai',
  locality: 'Navi Mumbai',
  publicCoordinates: [73.02, 19.03],
  locationPrecision: 'locality',
  operationalSince: 2022,
  capacityDisclosures: [{ value: 20, unit: 'MW', capacityType: 'it_load', scope: 'facility' }],
  verification: {
    status: 'public_operator_confirmed',
    verifiedAt: '2026-10-01T00:00:00Z',
    expiresAt: '2027-01-01T00:00:00Z',
    source: {
      title: 'Facility page',
      publisher: 'Example Operator',
      url: 'https://example.com/facility',
      sourceClass: 'operator',
      retrievedAt: '2026-10-01T00:00:00Z',
    },
  },
};

const summaryFor = (stateCode: PublicStateCode) => ({
  stateCode,
  range: '24h' as const,
  generatedAt: '2026-10-29T00:00:00Z',
  facilityCount: stateCode === 'IN-MH' ? 1 : 0,
  coveredFacilityCount: 0,
  metrics: [],
  sourceHealth: [],
});

function mount(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}><Dashboard /></MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  useDashboardStore.setState({ viewMode: 'split', isLeftSidebarOpen: false, typeFilter: 'all' });
  vi.mocked(publicFacilitiesService.getPublicFacilities).mockResolvedValue({
    items: [facility], page: 1, pageSize: 100, total: 1, registryVersion: 'test-v1', asOf: '2026-10-29T00:00:00Z',
  });
  vi.mocked(publicFacilitiesService.getPublicFacilitySummary).mockResolvedValue({
    registryVersion: 'test-v1', asOf: '2026-10-29T00:00:00Z', operationalFacilityCount: 1, operatorCount: 1,
    byState: { 'IN-MH': 1, 'IN-TG': 0, 'IN-KA': 0, 'IN-TN': 0 }, capacityAggregation: 'disabled_mixed_measurement_boundaries',
  });
  vi.mocked(environmentalService.getEnvironmentalStateSummary).mockImplementation(async ({ state }) => summaryFor(state));
  vi.mocked(environmentalService.getFacilityEnvironmentalCurrent).mockResolvedValue({ facilityId: facility.id, generatedAt: '2026-10-29T00:00:00Z', metrics: [] });
  vi.mocked(ministryService.getMinistryOverview).mockResolvedValue({ generatedAt: '2026-10-29T00:00:00Z', facilityCount: 1, states: [], sourceHealth: [], freshnessQueue: [] });
});

describe('Dashboard integration', () => {
  it('renders real API panels in grid mode without mounting the map', async () => {
    mount('/dashboard?view=grid');
    expect(await screen.findByRole('main', { name: 'Data-centre operations dashboard' })).toBeInTheDocument();
    expect(await screen.findByText('Operational registry')).toBeInTheDocument();
    expect(screen.getByText('Environmental coverage')).toBeInTheDocument();
    // The action queue moved to the ministry workspace; the dashboard links to it instead.
    expect(screen.queryByText('Action queue and source health')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Ministry workspace/ })).toHaveAttribute('href', '/ministry');
    expect(screen.queryByTestId('main-map')).not.toBeInTheDocument();
  });

  it('mounts a real-only map and opens a selected facility dossier', async () => {
    mount('/dashboard?view=global');
    const map = await screen.findByTestId('main-map');
    expect(map).toHaveTextContent('legacy suppressed: true');
    const selectFacility = await screen.findByRole('button', { name: `Select ${facility.name}` });
    expect(map).toHaveTextContent('Map status: ready');
    fireEvent.click(selectFacility);
    expect(await screen.findByRole('complementary', { name: 'Selected data-centre details' })).toHaveTextContent(facility.name);
    expect(screen.getByText(/exact coordinates are not displayed/i)).toBeInTheDocument();
  });

  it('keeps successful state summaries visible when one state request fails', async () => {
    vi.mocked(environmentalService.getEnvironmentalStateSummary).mockImplementation(async ({ state }) => {
      if (state === 'IN-TG') throw new Error('Telangana source unavailable');
      return summaryFor(state);
    });
    mount('/dashboard?view=grid');
    expect(await screen.findByText('IN-MH')).toBeInTheDocument();
    expect(screen.getByText('IN-KA')).toBeInTheDocument();
    expect(screen.queryByText('Telangana source unavailable')).not.toBeInTheDocument();
    await waitFor(() => expect(environmentalService.getEnvironmentalStateSummary).toHaveBeenCalledTimes(4));
  });

  it('renders map and operational sidebar together in split mode', async () => {
    mount('/dashboard?view=split');
    expect(await screen.findByRole('main', { name: 'Data-centre map and operations dashboard' })).toBeInTheDocument();
    expect(await screen.findByTestId('main-map')).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Registry and operational status' })).toHaveTextContent('Operational registry');
  });
});
