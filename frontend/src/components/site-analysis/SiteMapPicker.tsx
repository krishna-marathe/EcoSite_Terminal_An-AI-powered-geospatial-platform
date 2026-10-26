import React, { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Target, Compass } from 'lucide-react';
import { useDashboardStore } from '../../stores/dashboardStore';
import { FACILITY_TYPE_COLORS, FACILITY_TYPE_LABELS, eco } from '../../theme/tokens';
import { IconButton } from '../ui/Button';
import { ErrorState } from '../ui/StateViews';
import type { Facility } from '../../types';

interface SiteMapPickerProps {
  latitude: number;
  longitude: number;
  siteName: string;
  onCoordinatesChange: (coords: { latitude: number; longitude: number; state?: string }) => void;
}

const formatLatitude = (value: number) => `${Math.abs(value).toFixed(4)}° ${value >= 0 ? 'N' : 'S'}`;
const formatLongitude = (value: number) => `${Math.abs(value).toFixed(4)}° ${value >= 0 ? 'E' : 'W'}`;

// Generate a 15km circular polygon buffer around a [lng, lat] coordinate
const createGeoJsonCircle = (center: [number, number], radiusKm: number, points = 48) => {
  const coords: [number, number][] = [];
  const km = radiusKm;
  const distanceX = km / (111.32 * Math.cos((center[1] * Math.PI) / 180));
  const distanceY = km / 110.574;

  for (let i = 0; i < points; i++) {
    const theta = (i / points) * (2 * Math.PI);
    const x = distanceX * Math.cos(theta);
    const y = distanceY * Math.sin(theta);
    coords.push([center[0] + x, center[1] + y]);
  }
  coords.push(coords[0]);

  return {
    type: 'Feature' as const,
    geometry: {
      type: 'Polygon' as const,
      coordinates: [coords],
    },
    properties: {},
  };
};

/**
 * One pin per city-scoped facility held in the store (demo and API mode alike);
 * pins are colored by facility type and explained in the on-map legend.
 */
const syncFacilityMarkers = (
  map: maplibregl.Map,
  facilities: Facility[],
  markers: Record<string, maplibregl.Marker>,
) => {
  const nextIds = new Set(facilities.map((facility) => facility.id));
  Object.entries(markers).forEach(([id, marker]) => {
    if (!nextIds.has(id)) {
      marker.remove();
      delete markers[id];
    }
  });
  facilities.forEach((facility) => {
    if (markers[facility.id]) return;
    const el = document.createElement('div');
    el.className = 'select-none';
    el.style.width = '14px';
    el.style.height = '14px';
    el.style.borderRadius = '9999px';
    el.style.backgroundColor = FACILITY_TYPE_COLORS[facility.type];
    el.style.border = `2px solid ${eco.bg}`;
    el.style.boxShadow = '0 2px 6px rgba(0,0,0,0.8)';
    el.title = `${facility.name} · ${FACILITY_TYPE_LABELS[facility.type]}`;

    markers[facility.id] = new maplibregl.Marker({ element: el, anchor: 'center' })
      .setLngLat(facility.coordinates)
      .addTo(map);
  });
};

export const SiteMapPicker: React.FC<SiteMapPickerProps> = ({
  latitude,
  longitude,
  siteName,
  onCoordinatesChange,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const targetMarkerRef = useRef<maplibregl.Marker | null>(null);
  const facilityMarkersRef = useRef<Record<string, maplibregl.Marker>>({});
  const facilitiesRef = useRef<Facility[]>([]);
  const coordsRef = useRef<[number, number]>([longitude, latitude]);
  const facilities = useDashboardStore((state) => state.facilities);
  const [tileError, setTileError] = useState(false);

  const mapboxToken =
    localStorage.getItem('ECOSITE_MAPBOX_TOKEN') ||
    import.meta.env.VITE_MAPBOX_TOKEN ||
    '';

  const mapStyle: maplibregl.StyleSpecification = mapboxToken
    ? {
        version: 8,
        sources: {
          'mapbox-dark': {
            type: 'raster',
            tiles: [
              `https://api.mapbox.com/styles/v1/mapbox/dark-v11/tiles/256/{z}/{x}/{y}@2x?access_token=${mapboxToken}`,
            ],
            tileSize: 256,
          },
        },
        layers: [
          {
            id: 'mapbox-dark-layer',
            type: 'raster',
            source: 'mapbox-dark',
            minzoom: 0,
            maxzoom: 22,
          },
        ],
      }
    : {
        version: 8,
        sources: {
          'carto-dark': {
            type: 'raster',
            tiles: [
              'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
              'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
            ],
            tileSize: 256,
          },
        },
        layers: [
          {
            id: 'carto-dark-layer',
            type: 'raster',
            source: 'carto-dark',
            minzoom: 0,
            maxzoom: 20,
          },
        ],
      };

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: mapStyle,
      center: [longitude, latitude],
      zoom: 7,
      minZoom: 3.5,
      maxZoom: 16,
      attributionControl: false,
    });

    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

    // Teardown aborts in-flight tile requests, which would otherwise surface as
    // false tile failures (e.g. StrictMode remounts).
    let destroyed = false;
    map.on('error', () => {
      console.warn('SiteMapPicker could not load a map resource.');
      if (!destroyed) setTileError(true);
    });

    // Add the 15km screening buffer once for the current style; idempotent so it
    // survives a tile/style retry and the initial 'style.load'.
    const ensureScreeningBuffer = () => {
      if (map.getSource('screening-buffer')) return;
      map.addSource('screening-buffer', {
        type: 'geojson',
        data: createGeoJsonCircle(coordsRef.current, 15),
      });
      map.addLayer({
        id: 'screening-buffer-fill',
        type: 'fill',
        source: 'screening-buffer',
        paint: {
          'fill-color': eco.primary,
          'fill-opacity': 0.15,
        },
      });
      map.addLayer({
        id: 'screening-buffer-line',
        type: 'line',
        source: 'screening-buffer',
        paint: {
          'line-color': eco.primary,
          'line-width': 2,
          'line-dasharray': [3, 2],
          'line-opacity': 0.8,
        },
      });
    };

    map.on('load', () => {
      map.resize();
      ensureScreeningBuffer();
      syncFacilityMarkers(map, facilitiesRef.current, facilityMarkersRef.current);
    });

    map.on('style.load', ensureScreeningBuffer);

    // Handle Click anywhere to Pick New Coordinates
    map.on('click', (e) => {
      const clickedLng = parseFloat(e.lngLat.lng.toFixed(4));
      const clickedLat = parseFloat(e.lngLat.lat.toFixed(4));

      // Attempt state approximation based on latitude/longitude
      let approxState: string | undefined;
      if (clickedLat > 27 && clickedLng < 78) approxState = 'Rajasthan';
      else if (clickedLat > 26 && clickedLng >= 78) approxState = 'Uttar Pradesh';
      else if (clickedLat >= 18 && clickedLat <= 22 && clickedLng <= 75) approxState = 'Maharashtra';
      else if (clickedLat >= 20 && clickedLat <= 24 && clickedLng < 74) approxState = 'Gujarat';
      else if (clickedLat >= 12 && clickedLat < 18 && clickedLng >= 74 && clickedLng <= 78) approxState = 'Karnataka';
      else if (clickedLat < 14 && clickedLng >= 77) approxState = 'Tamil Nadu';

      onCoordinatesChange({
        latitude: clickedLat,
        longitude: clickedLng,
        state: approxState,
      });
    });

    // ResizeObserver
    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(mapContainerRef.current);

    mapRef.current = map;

    return () => {
      destroyed = true;
      resizeObserver.disconnect();
      if (targetMarkerRef.current) targetMarkerRef.current.remove();
      Object.values(facilityMarkersRef.current).forEach((m) => m.remove());
      facilityMarkersRef.current = {};
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the store-scoped facility list in sync with the pins.
  useEffect(() => {
    facilitiesRef.current = facilities;
    if (mapRef.current) syncFacilityMarkers(mapRef.current, facilities, facilityMarkersRef.current);
  }, [facilities]);

  // Update Target Marker & Screening Buffer when Coordinates Change
  useEffect(() => {
    coordsRef.current = [longitude, latitude];
    if (!mapRef.current) return;
    const map = mapRef.current;

    // Update or create target marker
    if (!targetMarkerRef.current) {
      const el = document.createElement('div');
      el.className = 'site-target-beacon select-none pointer-events-none';
      el.style.width = '36px';
      el.style.height = '36px';
      el.style.position = 'relative';
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';

      el.innerHTML = `
        <div class="absolute -inset-2 rounded-full bg-eco-primary/20 pointer-events-none"></div>
        <div class="flex h-7 w-7 items-center justify-center rounded-full border-2 border-eco-bg bg-eco-primary text-eco-bg shadow-2xl">
          <svg style="width:16px;height:16px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="22" y1="12" x2="18" y2="12"/>
            <line x1="6" y1="12" x2="2" y2="12"/>
            <line x1="12" y1="6" x2="12" y2="2"/>
            <line x1="12" y1="22" x2="12" y2="18"/>
          </svg>
        </div>
        <div class="site-label-tag absolute top-full left-1/2 -translate-x-1/2 mt-1 px-2 py-0.5 rounded-sm border border-eco-primary bg-eco-surface/95 font-mono text-meta text-eco-primary whitespace-nowrap shadow-xl"></div>
      `;
      const label = el.querySelector('.site-label-tag');
      if (label) label.textContent = siteName || 'Candidate site';

      targetMarkerRef.current = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([longitude, latitude])
        .addTo(map);
    } else {
      targetMarkerRef.current.setLngLat([longitude, latitude]);
      const label = targetMarkerRef.current.getElement().querySelector('.site-label-tag');
      if (label) label.textContent = siteName || 'Candidate site';
    }

    // Update 15km GeoJSON circle buffer
    const source = map.getSource('screening-buffer') as maplibregl.GeoJSONSource | undefined;
    if (source) {
      source.setData(createGeoJsonCircle([longitude, latitude], 15));
    }

    // Pan map to new coordinates
    const currentCenter = map.getCenter();
    if (
      Math.abs(currentCenter.lng - longitude) > 0.05 ||
      Math.abs(currentCenter.lat - latitude) > 0.05
    ) {
      map.easeTo({
        center: [longitude, latitude],
        duration: 600,
      });
    }
  }, [latitude, longitude, siteName]);

  const renderedTypes = Array.from(new Set(facilities.map((facility) => facility.type)));

  return (
    <div className="relative w-full h-72 sm:h-80 rounded-lg overflow-hidden border border-eco-border bg-eco-bg">
      {/* MapLibre Canvas Container */}
      <div ref={mapContainerRef} className="absolute inset-0 w-full h-full cursor-crosshair" />

      {/* Top Floating Overlay Notice */}
      <div className="absolute top-2.5 left-2.5 z-10 max-w-[calc(100%-1.25rem)] select-none">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-sm border border-eco-border bg-eco-surface/90 backdrop-blur-md shadow-lg text-meta text-eco-text">
          <Target className="w-3.5 h-3.5 shrink-0 text-eco-primary" />
          <span>Click anywhere on map to pin coordinates</span>
        </div>
      </div>

      {/* Facility type legend — city-scoped pins from the store */}
      {renderedTypes.length > 0 && (
        <div className="absolute bottom-2.5 left-2.5 z-10 select-none rounded-sm border border-eco-border bg-eco-surface/90 px-2 py-1.5 backdrop-blur-md shadow-lg">
          <p className="text-meta font-medium text-eco-text">Facility pins</p>
          <ul className="mt-0.5 space-y-0.5">
            {renderedTypes.map((type) => (
              <li key={type} className="flex items-center gap-1.5 text-meta text-eco-muted">
                <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: FACILITY_TYPE_COLORS[type] }} />
                {FACILITY_TYPE_LABELS[type]}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Floating Coordinate Readout */}
      <div className="absolute bottom-2.5 right-2.5 z-10 select-none">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-sm border border-eco-border bg-eco-surface/90 backdrop-blur-md shadow-lg font-mono text-meta text-eco-text">
          <span className="font-medium text-eco-primary">{formatLatitude(latitude)}, {formatLongitude(longitude)}</span>
          <span className="hidden border-l border-eco-border pl-2 text-eco-muted sm:inline">15 km buffer</span>
        </div>
      </div>

      {/* Recenter Map Button */}
      <div className="absolute top-2.5 right-2.5 z-10 select-none">
        <IconButton
          label="Recenter on candidate pin"
          icon={<Compass className="w-4 h-4" />}
          onClick={() => {
            mapRef.current?.flyTo({ center: [longitude, latitude], zoom: 8, duration: 600 });
          }}
          className="border-eco-border bg-eco-surface/90 backdrop-blur-md shadow-lg hover:bg-eco-surface-secondary"
        />
      </div>

      {/* Tile / basemap failure */}
      {tileError && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-eco-bg/85 backdrop-blur-sm">
          <ErrorState
            title="Map tiles unavailable"
            cause="Check network or basemap token."
            onRetry={() => {
              setTileError(false);
              mapRef.current?.setStyle(mapStyle);
            }}
            className="max-w-xs"
          />
        </div>
      )}
    </div>
  );
};
