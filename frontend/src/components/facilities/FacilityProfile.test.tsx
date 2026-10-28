import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FacilityProfile } from './FacilityProfile';
import { publicFacilityFixture } from './facilityTestFixtures';

describe('FacilityProfile', () => {
  it('keeps unlike capacity disclosures separate and shows provenance', () => {
    render(<FacilityProfile facility={publicFacilityFixture} />);
    expect(screen.getByText('12 MW')).toBeInTheDocument();
    expect(screen.getByText('20 MVA')).toBeInTheDocument();
    expect(screen.getByText(/never added together/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /open source/i })).toHaveAttribute('href', 'https://example.com/facility');
    expect(screen.getByText(/Generalised locality/i)).toBeInTheDocument();
  });

  it('calls out capacity that is not publicly disclosed', () => {
    render(<FacilityProfile facility={{ ...publicFacilityFixture, capacityDisclosures: [] }} />);
    expect(screen.getByText(/has not been publicly disclosed/i)).toBeInTheDocument();
  });
});

