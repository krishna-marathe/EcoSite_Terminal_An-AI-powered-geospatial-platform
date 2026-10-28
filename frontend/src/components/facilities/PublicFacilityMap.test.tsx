import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PublicFacilityMap } from './PublicFacilityMap';
import { publicFacilityFixture } from './facilityTestFixtures';

vi.mock('maplibre-gl', () => ({
  Map: class {
    container: HTMLElement;
    constructor(options: { container: HTMLElement }) { this.container = options.container; }
    addControl() {}
    remove() {}
  },
  Marker: class {
    element: HTMLElement;
    constructor(options: { element: HTMLElement }) { this.element = options.element; }
    setLngLat() { return this; }
    addTo(map: { container: HTMLElement }) { map.container.append(this.element); return this; }
    remove() { this.element.remove(); }
  },
  AttributionControl: class {},
}));

describe('PublicFacilityMap', () => {
  it('labels generalized coordinates and selects the public facility marker', () => {
    const onSelect = vi.fn();
    render(<PublicFacilityMap facilities={[publicFacilityFixture]} onSelectFacility={onSelect} />);
    expect(screen.getByText(/Generalised public locations/)).toBeInTheDocument();
    const marker = screen.getByRole('button', { name: `Open public profile for ${publicFacilityFixture.name}` });
    fireEvent.click(marker);
    expect(onSelect).toHaveBeenCalledWith(publicFacilityFixture);
    expect(marker).toHaveAttribute('data-facility-id', publicFacilityFixture.id);
  });
});

