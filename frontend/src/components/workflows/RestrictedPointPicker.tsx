import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import { MapPin } from 'lucide-react';
import type { ExactPointGeometry } from '../../types/submissions';

interface Props {
  value: ExactPointGeometry;
  onChange: (value: ExactPointGeometry) => void;
  disabled?: boolean;
}

const mapStyle: maplibregl.StyleSpecification = {
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
  layers: [{ id: 'carto-dark-layer', type: 'raster', source: 'carto-dark', minzoom: 0, maxzoom: 20 }],
};

/** Restricted operator-only point picker. Coordinates remain in the private submission contract. */
export function RestrictedPointPicker({ value, onChange, disabled = false }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const onChangeRef = useRef(onChange);
  const disabledRef = useRef(disabled);
  const [mapUnavailable, setMapUnavailable] = useState(false);

  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  useEffect(() => { disabledRef.current = disabled; }, [disabled]);

  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: mapStyle,
      center: value.coordinates,
      zoom: 10,
      minZoom: 3.5,
      maxZoom: 17,
      attributionControl: false,
    });
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
    const selectPoint = (event: maplibregl.MapMouseEvent) => {
      if (disabledRef.current) return;
      onChangeRef.current({
        type: 'Point',
        coordinates: [Number(event.lngLat.lng.toFixed(6)), Number(event.lngLat.lat.toFixed(6))],
      });
    };
    map.on('click', selectPoint);
    map.on('error', () => setMapUnavailable(true));
    const observer = new ResizeObserver(() => map.resize());
    observer.observe(containerRef.current);
    mapRef.current = map;
    return () => {
      map.off('click', selectPoint);
      observer.disconnect();
      markerRef.current?.remove();
      markerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
    // The map is intentionally created once; marker position is synchronized below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markerRef.current?.remove();
    const element = document.createElement('div');
    element.className = 'flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-eco-primary text-white shadow-lg';
    element.setAttribute('aria-hidden', 'true');
    element.innerHTML = '<span style="font-size:11px;font-weight:700">DC</span>';
    markerRef.current = new maplibregl.Marker({ element }).setLngLat(value.coordinates).addTo(map);
    map.easeTo({ center: value.coordinates, duration: 300 });
  }, [value]);

  return (
    <div className="relative h-52 overflow-hidden rounded-sm border border-eco-border bg-eco-surface-secondary" aria-label="Restricted exact location map">
      <div ref={containerRef} className="absolute inset-0" />
      <div className="pointer-events-none absolute left-2 top-2 flex items-center gap-1 rounded-sm border border-eco-border bg-eco-surface/95 px-2 py-1 text-meta text-eco-text shadow">
        <MapPin className="h-3.5 w-3.5 text-eco-primary" /> Click the map to set the private point
      </div>
      {mapUnavailable && <p role="status" className="absolute bottom-2 left-2 right-2 rounded-sm bg-eco-surface/95 px-2 py-1 text-meta text-eco-warning">Basemap unavailable. Enter coordinates below; the restricted point will still be saved.</p>}
    </div>
  );
}
