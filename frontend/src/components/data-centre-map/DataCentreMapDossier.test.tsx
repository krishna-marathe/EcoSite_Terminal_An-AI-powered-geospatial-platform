import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { EnvironmentalCurrentResponse } from '../../types/environmentalMonitoring';
import type { PublicFacility } from '../../types/publicFacilities';
import { DataCentreMapDossier } from './DataCentreMapDossier';

const facility: PublicFacility = {
  id: 'dc-mh-1',
  name: 'Mumbai Public Data Centre',
  operator: 'Example Operator',
  ownershipCategory: 'private',
  facilityType: 'colocation',
  stateCode: 'IN-MH',
  state: 'Maharashtra',
  city: 'Mumbai',
  locality: 'Chandivali',
  publicCoordinates: [72.889991, 19.117771],
  locationPrecision: 'locality',
  operationalSince: 2018,
  capacityDisclosures: [
    { value: 12, unit: 'MW', capacityType: 'it_load', scope: 'Operational building' },
    { value: 20, unit: 'MVA', capacityType: 'total_power', scope: 'Campus intake' },
  ],
  verification: {
    status: 'public_operator_confirmed',
    verifiedAt: '2026-01-02T00:00:00Z',
    expiresAt: '2026-04-02T00:00:00Z',
    source: {
      title: 'Mumbai facility page',
      publisher: 'Example Operator',
      url: 'https://example.test/mumbai',
      sourceClass: 'operator',
      retrievedAt: '2026-01-02T00:00:00Z',
    },
  },
};

const environmentalCurrent: EnvironmentalCurrentResponse = {
  facilityId: facility.id,
  generatedAt: '2026-01-03T00:00:00Z',
  metrics: [{
    metric: 'aqi',
    displayName: 'Air quality index',
    value: 82,
    unit: 'AQI',
    originalValue: 82,
    originalUnit: 'AQI',
    availability: 'AVAILABLE',
    quality: 'validated',
    observedAt: '2026-01-03T00:00:00Z',
    publishedAt: '2026-01-03T00:01:00Z',
    retrievedAt: '2026-01-03T00:02:00Z',
    freshUntil: '2026-01-03T01:00:00Z',
    qualityFlags: [],
    station: {
      stationId: 'station-1',
      name: 'Powai monitoring station',
      provider: 'Public Authority',
      sourceId: 'source-1',
      publicCoordinates: [72.901234, 19.123456],
      stationType: 'air_quality',
      distanceKm: 4.2,
      selectionMethod: 'nearest_eligible',
      effectiveAt: '2026-01-03T00:00:00Z',
    },
    provenance: null,
    contextNotice: 'Nearby station context.',
  }],
};

describe('DataCentreMapDossier', () => {
  it('shows typed public disclosures and contextual observations without coordinates', () => {
    const onClose = vi.fn();
    const onOpenProfile = vi.fn();
    render(
      <DataCentreMapDossier
        facility={facility}
        environmentalCurrent={environmentalCurrent}
        onClose={onClose}
        onOpenProfile={onOpenProfile}
      />
    );

    expect(screen.getByText('Chandivali, Mumbai, Maharashtra')).toBeInTheDocument();
    expect(screen.getByText('IT load')).toBeInTheDocument();
    expect(screen.getByText('12 MW')).toBeInTheDocument();
    expect(screen.getByText('Total power')).toBeInTheDocument();
    expect(screen.getByText('20 MVA')).toBeInTheDocument();
    expect(screen.getByText(/measurement boundaries may differ/i)).toBeInTheDocument();
    expect(screen.getByText('Operator confirmed')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Mumbai facility page/i })).toHaveAttribute('href', facility.verification.source.url);
    expect(screen.getByText('82 AQI')).toBeInTheDocument();
    expect(screen.getByText(/Powai monitoring station.*4.2 km contextual distance/i)).toBeInTheDocument();
    expect(screen.getByText(/not facility telemetry/i)).toBeInTheDocument();

    expect(document.body.textContent).not.toContain('72.889991');
    expect(document.body.textContent).not.toContain('19.117771');
    expect(document.body.textContent).not.toContain('72.901234');
    expect(document.body.textContent).not.toContain('19.123456');

    fireEvent.click(screen.getByRole('button', { name: 'Open data-centre profile' }));
    expect(onOpenProfile).toHaveBeenCalledWith(facility);
    fireEvent.click(screen.getByRole('button', { name: 'Close data-centre dossier' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('renders nothing without a selection', () => {
    const { container } = render(<DataCentreMapDossier facility={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
