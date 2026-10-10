import React, { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Target, Compass } from 'lucide-react';
import { DEMO_FACILITIES } from '../../data/demo/facilities';

interface SiteMapPickerProps {
  latitude: number;
  longitude: number;
  siteName: string;
  onCoordinatesChange: (coords: { latitude: number; longitude: number; state?: string }) => void;
}

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

export const SiteMapPicker: React.FC<SiteMapPickerProps> = ({
  latitude,
  longitude,
  siteName,
  onCoordinatesChange,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const targetMarkerRef = useRef<maplibregl.Marker | null>(null);
  const facilityMarkersRef = useRef<{ [key: string]: maplibregl.Marker }>({});

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

    map.on('error', (e) => console.warn('SiteMapPicker error:', e));

    map.on('load', () => {
      map.resize();

      // Add 15km Screening Radius Buffer Source & Layers
      const circleData = createGeoJsonCircle([longitude, latitude], 15);
      map.addSource('screening-buffer', {
        type: 'geojson',
        data: circleData,
      });

      map.addLayer({
        id: 'screening-buffer-fill',
        type: 'fill',
        source: 'screening-buffer',
        paint: {
          'fill-color': '#38BDF8',
          'fill-opacity': 0.15,
        },
      });

      map.addLayer({
        id: 'screening-buffer-line',
        type: 'line',
        source: 'screening-buffer',
        paint: {
          'line-color': '#38BDF8',
          'line-width': 2,
          'line-dasharray': [3, 2],
          'line-opacity': 0.8,
        },
      });

      // Render Nearby Facility Pins
      DEMO_FACILITIES.forEach((fac) => {
        const el = document.createElement('div');
        el.className = 'nearby-facility-dot cursor-pointer select-none';
        el.style.width = '14px';
        el.style.height = '14px';
        el.style.borderRadius = '9999px';
        el.style.backgroundColor = fac.type === 'data_centre' ? '#38BDF8' : '#F59E0B';
        el.style.border = '2px solid #080D16';
        el.style.boxShadow = '0 2px 6px rgba(0,0,0,0.8)';
        el.title = `${fac.name} (${fac.type})`;

        const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat(fac.coordinates)
          .addTo(map);

        facilityMarkersRef.current[fac.id] = marker;
      });
    });

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
      resizeObserver.disconnect();
      if (targetMarkerRef.current) targetMarkerRef.current.remove();
      Object.values(facilityMarkersRef.current).forEach((m) => m.remove());
      facilityMarkersRef.current = {};
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update Target Marker & Screening Buffer when Coordinates Change
  useEffect(() => {
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
        <div class="absolute -inset-2 rounded-full animate-ping opacity-75 bg-sky-400 pointer-events-none"></div>
        <div class="w-7 h-7 rounded-full bg-sky-500 border-2 border-white flex items-center justify-center text-black font-black text-xs shadow-2xl">
          <svg style="width:16px;height:16px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="22" y1="12" x2="18" y2="12"/>
            <line x1="6" y1="12" x2="2" y2="12"/>
            <line x1="12" y1="6" x2="12" y2="2"/>
            <line x1="12" y1="22" x2="12" y2="18"/>
          </svg>
        </div>
        <div class="site-label-tag absolute top-full left-1/2 -translate-x-1/2 mt-1 px-2 py-0.5 rounded bg-[#0B1220]/95 border border-sky-400 text-[10px] text-sky-300 font-bold whitespace-nowrap shadow-xl">
          ${siteName || 'Candidate Site'}
        </div>
      `;

      targetMarkerRef.current = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([longitude, latitude])
        .addTo(map);
    } else {
      targetMarkerRef.current.setLngLat([longitude, latitude]);
      const label = targetMarkerRef.current.getElement().querySelector('.site-label-tag');
      if (label) label.textContent = siteName || 'Candidate Site';
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

  return (
    <div className="relative w-full h-72 sm:h-80 rounded-lg overflow-hidden border border-[#263447] bg-[#080D16]">
      {/* MapLibre Canvas Container */}
      <div ref={mapContainerRef} className="absolute inset-0 w-full h-full cursor-crosshair" />

      {/* Top Floating Overlay Notice */}
      <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-2 select-none">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#0F172A]/90 border border-sky-500/50 backdrop-blur-md shadow-lg text-[11px] text-sky-300 font-mono">
          <Target className="w-3.5 h-3.5 text-sky-400 animate-pulse" />
          <span>Click anywhere on map to pin coordinates</span>
        </div>
      </div>

      {/* Floating Center Badge with Current Coordinates */}
      <div className="absolute bottom-2.5 right-2.5 z-10 select-none">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-[#0F172A]/90 border border-[#263447] backdrop-blur-md shadow-lg text-[11px] font-mono text-slate-200">
          <span className="text-emerald-400 font-bold">{latitude.toFixed(4)}° N, {longitude.toFixed(4)}° E</span>
          <span className="text-slate-400 border-l border-[#263447] pl-2 text-[10px]">15 km Buffer</span>
        </div>
      </div>

      {/* Reset Map Center Button */}
      <div className="absolute top-2.5 right-2.5 z-10 flex flex-col gap-1.5 select-none">
        <button
          type="button"
          onClick={() => {
            mapRef.current?.flyTo({ center: [longitude, latitude], zoom: 8, duration: 600 });
          }}
          className="w-7 h-7 rounded bg-[#0F172A]/90 border border-[#263447] text-slate-300 hover:text-white flex items-center justify-center hover:bg-[#1E293B] shadow backdrop-blur-md transition-colors"
          title="Recenter on Candidate Pin"
        >
          <Compass className="w-3.5 h-3.5 text-sky-400" />
        </button>
      </div>
    </div>
  );
};
