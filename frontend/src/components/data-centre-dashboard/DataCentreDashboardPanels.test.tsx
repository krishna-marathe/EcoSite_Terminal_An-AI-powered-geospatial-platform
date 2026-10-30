import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { EnvironmentalStateSummaryResponse } from '../../types/environmentalMonitoring';
import type { MinistryOverview } from '../../types/ministryOperations';
import type { PublicFacility, PublicFacilitySummary } from '../../types/publicFacilities';
import { EnvironmentalCoveragePanel, MinistryOperationsPanel, RegistryDistribution, RegistryKpiSummary } from './index';

const summary: PublicFacilitySummary = {
  registryVersion: 'registry-1', asOf: '2026-10-29T08:30:00Z', operationalFacilityCount: 19, operatorCount: 8,
  byState: { 'IN-MH': 7, 'IN-TG': 5, 'IN-KA': 4, 'IN-TN': 3 },
  capacityAggregation: 'disabled_mixed_measurement_boundaries',
};

const facility: PublicFacility = {
  id: 'dc-1', name: 'Mumbai DC', operator: 'Operator One', ownershipCategory: 'private', facilityType: 'colocation',
  stateCode: 'IN-MH', state: 'Maharashtra', city: 'Mumbai', locality: 'Locality', publicCoordinates: [72.8, 19.1],
  locationPrecision: 'locality', capacityDisclosures: [],
  verification: { status: 'public_operator_confirmed', verifiedAt: '2026-10-20', expiresAt: '2027-01-18', source: { title: 'Facility page', publisher: 'Operator One', url: 'https://example.test', sourceClass: 'operator', retrievedAt: '2026-10-20' } },
};

describe('data-centre dashboard panels', () => {
  it('shows registry counts without inventing a capacity total', () => {
    render(<RegistryKpiSummary summary={summary} />);
    expect(screen.getByText('19')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText(/Capacity total not shown/)).toBeInTheDocument();
  });

  it('derives operator distribution only from supplied facilities', () => {
    render(<RegistryDistribution summary={summary} facilities={[facility, { ...facility, id: 'dc-2' }]} />);
    expect(screen.getByText('Maharashtra')).toBeInTheDocument();
    expect(screen.getByText('Operator One')).toBeInTheDocument();
    expect(screen.getAllByText('2')).toHaveLength(1);
  });

  it('makes missing environmental coverage explicit', () => {
    render(<EnvironmentalCoveragePanel states={[]} />);
    expect(screen.getByText(/NOT_COVERED/)).toBeInTheDocument();
    expect(screen.getByText(/not on-site facility telemetry/)).toBeInTheDocument();
  });

  it('summarises coverage as a total and keeps metric detail behind a disclosure', () => {
    const state: EnvironmentalStateSummaryResponse = {
      stateCode: 'IN-MH', range: '24h', generatedAt: '2026-10-29T08:30:00Z', facilityCount: 7, coveredFacilityCount: 2,
      metrics: [{ metric: 'aqi', displayName: 'Air quality index', unit: 'AQI', availability: 'PARTIAL', coveredFacilityCount: 2, currentFacilityCount: 1, staleFacilityCount: 1, unavailableFacilityCount: 0, minimum: 40, maximum: 80, mean: 60, aggregationMethod: 'station_context', contextNotice: 'Nearby station.' }],
      sourceHealth: [],
    };
    render(<EnvironmentalCoveragePanel states={[state]} />);
    expect(screen.getByText(/of 7 facilities have a linked public monitoring station/)).toBeInTheDocument();
    expect(screen.getByText('IN-MH')).toBeInTheDocument();
    expect(screen.getByText('Which metrics, and what is missing?')).toBeInTheDocument();
    expect(screen.getByText('PARTIAL')).toBeInTheDocument();
  });

  it('shows ministry freshness work and honest absent source coverage', () => {
    const overview: MinistryOverview = {
      generatedAt: '2026-10-29T08:30:00Z', facilityCount: 1, states: [], sourceHealth: [],
      freshnessQueue: [{ facilityId: 'dc-1', facilityName: 'Mumbai DC', stateCode: 'IN-MH', metric: 'aqi', status: 'STALE', observedAt: null, ageSeconds: null, sourceId: null, reason: 'Observation expired' }],
    };
    render(<MinistryOperationsPanel overview={overview} />);
    expect(screen.getByText('Mumbai DC')).toBeInTheDocument();
    expect(screen.getByText(/no environmental sources are configured/)).toBeInTheDocument();
  });

  it('exposes clear loading and error states', () => {
    const { rerender } = render(<RegistryKpiSummary isLoading summary={null} />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading current data');
    rerender(<RegistryKpiSummary error="Registry request failed" summary={null} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Registry request failed');
  });
});
