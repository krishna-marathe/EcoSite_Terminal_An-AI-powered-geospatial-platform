import { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { PublicFacility } from '../../types/publicFacilities';

const PUBLIC_MAP_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    carto: {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    },
  },
  layers: [{ id: 'carto-dark', type: 'raster', source: 'carto' }],
};

export interface PublicFacilityMapProps {
  facilities: PublicFacility[];
  selectedFacilityId?: string | null;
  onSelectFacility?: (facility: PublicFacility) => void;
  className?: string;
}

function createMarkerElement(facility: PublicFacility, selected: boolean): HTMLButtonElement {
  const marker = document.createElement('button');
  marker.type = 'button';
  marker.className = [
    'public-facility-marker',
    'flex h-5 w-5 items-center justify-center rounded-full border border-eco-bg',
    'bg-eco-primary text-eco-bg shadow-lg transition-transform hover:scale-110',
    selected ? 'ring-4 ring-eco-primary/30 scale-110' : '',
  ].join(' ');
  marker.dataset.facilityId = facility.id;
  marker.setAttribute('aria-label', `Open public profile for ${facility.name}`);

  const icon = document.createElement('span');
  icon.setAttribute('aria-hidden', 'true');
  // Server-rack SVG — two rack units with status LED, consistent with map dashboard markers
  icon.innerHTML = '<svg style="width:10px;height:10px;flex-shrink:0;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="8" x="2" y="2" rx="2" ry="2"/><rect width="20" height="8" x="2" y="14" rx="2" ry="2"/><line x1="6" x2="6.01" y1="6" y2="6"/><line x1="6" x2="6.01" y1="18" y2="18"/></svg>';
  marker.append(icon);
  return marker;
}

/**
 * Public-only map. Coordinates are rendered exactly as supplied by the public
 * contract and are always labelled as generalised locality/district positions.
 */
export function PublicFacilityMap({
  facilities,
  selectedFacilityId = null,
  onSelectFacility,
  className = '',
}: PublicFacilityMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: PUBLIC_MAP_STYLE,
      center: [78.5, 17.5],
      zoom: 4.2,
      minZoom: 3,
      attributionControl: false,
    });
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
    mapRef.current = map;
    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((marker) => marker.remove());

    const coordGroups = new Map<string, PublicFacility[]>();
    facilities.forEach((facility) => {
      const key = `${facility.publicCoordinates[0].toFixed(4)},${facility.publicCoordinates[1].toFixed(4)}`;
      const list = coordGroups.get(key) || [];
      list.push(facility);
      coordGroups.set(key, list);
    });

    markersRef.current = facilities.map((facility) => {
      const key = `${facility.publicCoordinates[0].toFixed(4)},${facility.publicCoordinates[1].toFixed(4)}`;
      const group = coordGroups.get(key) || [facility];
      let renderCoords: [number, number] = facility.publicCoordinates;
      if (group.length > 1) {
        const index = group.findIndex((f) => f.id === facility.id);
        const angle = (2 * Math.PI * index) / group.length;
        const lngOffset = Math.cos(angle) * 0.02;
        const latOffset = Math.sin(angle) * 0.016;
        renderCoords = [
          Number((facility.publicCoordinates[0] + lngOffset).toFixed(4)),
          Number((facility.publicCoordinates[1] + latOffset).toFixed(4)),
        ];
      }

      const element = createMarkerElement(facility, facility.id === selectedFacilityId);
      element.addEventListener('click', () => onSelectFacility?.(facility));
      return new maplibregl.Marker({ element, anchor: 'center' })
        .setLngLat(renderCoords)
        .addTo(map);
    });
  }, [facilities, onSelectFacility, selectedFacilityId]);

  return (
    <section className={`relative min-h-[360px] overflow-hidden rounded-md border border-eco-border bg-eco-surface ${className}`}>
      <div ref={containerRef} className="absolute inset-0" aria-label="Generalised public facility map" />
      <div className="absolute left-3 top-3 z-10 rounded border border-eco-border bg-eco-surface/95 px-2 py-1 text-micro text-eco-muted shadow-lg">
        Generalised public locations &middot; not exact campus coordinates
      </div>
      <div className="absolute bottom-3 left-3 z-10 rounded border border-eco-border bg-eco-surface/95 px-2 py-1 font-mono text-micro uppercase tracking-wide text-eco-text shadow-lg">
        {facilities.length} operating {facilities.length === 1 ? 'facility' : 'facilities'}
      </div>
    </section>
  );
}

