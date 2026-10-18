import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Compass, Layers, Sparkles, X, ZoomIn, ZoomOut } from 'lucide-react';
import { useDashboardStore } from '../../stores/dashboardStore';
import { getPilotCity } from '../../data/pilotCities';
import {
  GROUNDWATER_ZONES_GEOJSON,
  AIR_QUALITY_ZONES_GEOJSON,
  HEAT_ANOMALY_ZONES_GEOJSON,
  FLOOD_HAZARD_ZONES_GEOJSON,
  PROTECTED_AREAS_GEOJSON,
  TRANSMISSION_GRID_GEOJSON,
} from '../../data/demo/environmentalOverlays';
import { FACILITY_TYPE_COLORS, FACILITY_TYPE_LABELS } from '../../theme/tokens';
import type { Facility, InfrastructureType } from '../../types';

// Dynamic style generator: uses Mapbox HD tiles when a token is provided, otherwise falls back to Carto/ESRI
const getMapStyle = (
  styleKey: 'dark' | 'satellite' | 'streets',
  mapboxToken?: string
): maplibregl.StyleSpecification => {
  if (mapboxToken) {
    if (styleKey === 'satellite') {
      return {
        version: 8,
        sources: {
          'mapbox-satellite': {
            type: 'raster',
            tiles: [
              `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/256/{z}/{x}/{y}@2x?access_token=${mapboxToken}`,
            ],
            tileSize: 256,
            attribution: '&copy; Mapbox &copy; Maxar &copy; OpenStreetMap',
          },
        },
        layers: [
          {
            id: 'mapbox-satellite-layer',
            type: 'raster',
            source: 'mapbox-satellite',
            minzoom: 0,
            maxzoom: 22,
          },
        ],
      };
    }

    if (styleKey === 'streets') {
      return {
        version: 8,
        sources: {
          'mapbox-light': {
            type: 'raster',
            tiles: [
              `https://api.mapbox.com/styles/v1/mapbox/light-v11/tiles/256/{z}/{x}/{y}@2x?access_token=${mapboxToken}`,
            ],
            tileSize: 256,
            attribution: '&copy; Mapbox &copy; OpenStreetMap',
          },
        },
        layers: [
          {
            id: 'mapbox-light-layer',
            type: 'raster',
            source: 'mapbox-light',
            minzoom: 0,
            maxzoom: 22,
          },
        ],
      };
    }

    // Default to Mapbox Dark v11
    return {
      version: 8,
      sources: {
        'mapbox-dark': {
          type: 'raster',
          tiles: [
            `https://api.mapbox.com/styles/v1/mapbox/dark-v11/tiles/256/{z}/{x}/{y}@2x?access_token=${mapboxToken}`,
          ],
          tileSize: 256,
          attribution: '&copy; Mapbox &copy; OpenStreetMap',
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
    };
  }

  // Open-source Fallback Styles
  if (styleKey === 'satellite') {
    return {
      version: 8,
      sources: {
        'esri-satellite': {
          type: 'raster',
          tiles: [
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          ],
          tileSize: 256,
          attribution: '&copy; Esri World Imagery',
        },
      },
      layers: [
        {
          id: 'satellite-tiles',
          type: 'raster',
          source: 'esri-satellite',
          minzoom: 0,
          maxzoom: 19,
        },
      ],
    };
  }

  if (styleKey === 'streets') {
    return {
      version: 8,
      sources: {
        'carto-light': {
          type: 'raster',
          tiles: [
            'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
            'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
            'https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
            'https://d.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
          ],
          tileSize: 256,
          attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        },
      },
      layers: [
        {
          id: 'carto-light-layer',
          type: 'raster',
          source: 'carto-light',
          minzoom: 0,
          maxzoom: 20,
        },
      ],
    };
  }

  return {
    version: 8,
    sources: {
      'carto-dark': {
        type: 'raster',
        tiles: [
          'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
          'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
          'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
          'https://d.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        ],
        tileSize: 256,
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
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
};

const setupEnvironmentalLayers = (
  map: maplibregl.Map,
  activeLayers: Record<string, boolean>,
  layerOpacities: Record<string, number>
) => {
  // 1. Groundwater Stress
  if (!map.getSource('src-gw-stress')) {
    map.addSource('src-gw-stress', { type: 'geojson', data: GROUNDWATER_ZONES_GEOJSON });
    map.addLayer({
      id: 'layer-gw-stress-fill',
      type: 'fill',
      source: 'src-gw-stress',
      paint: {
        'fill-color': ['get', 'color'],
        'fill-opacity': activeLayers['env-groundwater-stress'] ? (layerOpacities['env-groundwater-stress'] ?? 0.45) : 0,
      },
    });
    map.addLayer({
      id: 'layer-gw-stress-line',
      type: 'line',
      source: 'src-gw-stress',
      paint: {
        'line-color': ['get', 'color'],
        'line-width': 1.5,
        'line-opacity': activeLayers['env-groundwater-stress'] ? 0.8 : 0,
      },
    });
  }

  // 2. Air Quality Zones
  if (!map.getSource('src-air-quality')) {
    map.addSource('src-air-quality', { type: 'geojson', data: AIR_QUALITY_ZONES_GEOJSON });
    map.addLayer({
      id: 'layer-air-quality-fill',
      type: 'fill',
      source: 'src-air-quality',
      paint: {
        'fill-color': ['get', 'color'],
        'fill-opacity': activeLayers['env-air-quality'] ? (layerOpacities['env-air-quality'] ?? 0.4) : 0,
      },
    });
    map.addLayer({
      id: 'layer-air-quality-line',
      type: 'line',
      source: 'src-air-quality',
      paint: {
        'line-color': ['get', 'color'],
        'line-width': 1.5,
        'line-opacity': activeLayers['env-air-quality'] ? 0.8 : 0,
      },
    });
  }

  // 3. Surface Heat Anomaly
  if (!map.getSource('src-heat-anomaly')) {
    map.addSource('src-heat-anomaly', { type: 'geojson', data: HEAT_ANOMALY_ZONES_GEOJSON });
    map.addLayer({
      id: 'layer-heat-anomaly-fill',
      type: 'fill',
      source: 'src-heat-anomaly',
      paint: {
        'fill-color': ['get', 'color'],
        'fill-opacity': activeLayers['env-surface-temp'] ? (layerOpacities['env-surface-temp'] ?? 0.4) : 0,
      },
    });
    map.addLayer({
      id: 'layer-heat-anomaly-line',
      type: 'line',
      source: 'src-heat-anomaly',
      paint: {
        'line-color': ['get', 'color'],
        'line-width': 1.5,
        'line-opacity': activeLayers['env-surface-temp'] ? 0.8 : 0,
      },
    });
  }

  // 4. Flood Susceptibility
  if (!map.getSource('src-flood-hazard')) {
    map.addSource('src-flood-hazard', { type: 'geojson', data: FLOOD_HAZARD_ZONES_GEOJSON });
    map.addLayer({
      id: 'layer-flood-hazard-fill',
      type: 'fill',
      source: 'src-flood-hazard',
      paint: {
        'fill-color': ['get', 'color'],
        'fill-opacity': activeLayers['env-flood-susceptibility'] ? (layerOpacities['env-flood-susceptibility'] ?? 0.45) : 0,
      },
    });
    map.addLayer({
      id: 'layer-flood-hazard-line',
      type: 'line',
      source: 'src-flood-hazard',
      paint: {
        'line-color': ['get', 'color'],
        'line-width': 1.5,
        'line-opacity': activeLayers['env-flood-susceptibility'] ? 0.8 : 0,
      },
    });
  }

  // 5. Protected Forest ESZ
  if (!map.getSource('src-protected-areas')) {
    map.addSource('src-protected-areas', { type: 'geojson', data: PROTECTED_AREAS_GEOJSON });
    map.addLayer({
      id: 'layer-protected-areas-fill',
      type: 'fill',
      source: 'src-protected-areas',
      paint: {
        'fill-color': ['get', 'color'],
        'fill-opacity': activeLayers['env-protected-areas'] ? (layerOpacities['env-protected-areas'] ?? 0.4) : 0,
      },
    });
    map.addLayer({
      id: 'layer-protected-areas-line',
      type: 'line',
      source: 'src-protected-areas',
      paint: {
        'line-color': ['get', 'color'],
        'line-width': 1.5,
        'line-opacity': activeLayers['env-protected-areas'] ? 0.8 : 0,
      },
    });
  }

  // 6. 765kV High-Voltage Transmission Grid
  if (!map.getSource('src-transmission-grid')) {
    map.addSource('src-transmission-grid', { type: 'geojson', data: TRANSMISSION_GRID_GEOJSON });
    map.addLayer({
      id: 'layer-transmission-grid-line',
      type: 'line',
      source: 'src-transmission-grid',
      paint: {
        'line-color': ['get', 'color'],
        'line-width': 2.5,
        'line-dasharray': [3, 1.5],
        'line-opacity': activeLayers['layer-transmission-lines'] ? (layerOpacities['layer-transmission-lines'] ?? 0.85) : 0,
      },
    });
  }
};

const getFacilityIconSvg = (type: InfrastructureType): string => {
  switch (type) {
    case 'data_centre':
      return `<svg style="width:14px;height:14px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="8" x="2" y="2" rx="2" ry="2"/><rect width="20" height="8" x="2" y="14" rx="2" ry="2"/><line x1="6" x2="6.01" y1="6" y2="6"/><line x1="6" x2="6.01" y1="18" y2="18"/></svg>`;
    case 'thermal_power':
      return `<svg style="width:14px;height:14px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>`;
    case 'solar_farm':
      return `<svg style="width:14px;height:14px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/></svg>`;
    case 'wind_farm':
      return `<svg style="width:14px;height:14px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2"/><path d="M9.6 4.6A2 2 0 1 1 11 8H2"/><path d="M12.6 19.4A2 2 0 1 0 14 16H2"/></svg>`;
    case 'hydro_power':
      return `<svg style="width:14px;height:14px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>`;
    case 'substation':
      return `<svg style="width:14px;height:14px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`;
    case 'industrial':
    default:
      return `<svg style="width:14px;height:14px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/></svg>`;
  }
};

export const MainMap: React.FC = () => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [mapInstance, setMapInstance] = useState<maplibregl.Map | null>(null);
  const markersRef = useRef<{ [key: string]: maplibregl.Marker }>({});
  const prevStyleRef = useRef<string>('dark');
  const [mapError, setMapError] = useState<string | null>(null);

  const mapboxToken =
    localStorage.getItem('ECOSITE_MAPBOX_TOKEN') ||
    import.meta.env.VITE_MAPBOX_TOKEN ||
    '';

  const {
    selectedFacilityId,
    setSelectedFacilityId,
    searchQuery,
    typeFilter,
    riskFilter,
    activeLayers,
    layerOpacities,
    wmLayers,
    facilities,
    facilitiesStatus,
    cityId,
    mapStyle,
    setMapStyle,
    viewport,
    setViewport,
    fitToIndia,
    toggleLeftSidebar,
  } = useDashboardStore();

  const [hoveredFacility, setHoveredFacility] = useState<Facility | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [hoveredEnvZone, setHoveredEnvZone] = useState<{
    name: string;
    status: string;
    description: string;
    x: number;
    y: number;
  } | null>(null);
  const [styleMenuOpen, setStyleMenuOpen] = useState(false);

  // Initialize MapLibre
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const styleDef = getMapStyle(mapStyle, mapboxToken);

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: styleDef,
      center: [viewport.longitude, viewport.latitude],
      zoom: viewport.zoom,
      minZoom: 3,
      maxZoom: 18,
      attributionControl: false,
    });

    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

    const loadTimer = window.setTimeout(() => {
      if (!map.loaded()) {
        setMapError(
          'Basemap tiles are slow to respond — the network may be offline or the basemap provider unreachable.'
        );
      }
    }, 10000);

    map.on('error', (e) => {
      console.warn('MapLibre event error:', e);
      const message = String(
        (e as unknown as { error?: { message?: string } }).error?.message ?? ''
      );
      if (/401|403|unauthorized|forbidden|token|style/i.test(message)) {
        setMapError(message || 'The basemap style failed to load.');
      }
    });

    map.on('moveend', () => {
      const center = map.getCenter();
      setViewport({
        longitude: center.lng,
        latitude: center.lat,
        zoom: map.getZoom(),
      });
    });

    // ResizeObserver ensures map adjusts whenever container dimensions change
    const resizeObserver = new ResizeObserver(() => {
      map.resize();
    });
    resizeObserver.observe(mapContainerRef.current);

    const onMapLoaded = () => {
      window.clearTimeout(loadTimer);
      setMapError(null);
      map.resize();
      setupEnvironmentalLayers(map, activeLayers, layerOpacities);
      setMapInstance(map);

      // Register hover events on environmental hazard layers
      const registerEnvHover = (layerId: string) => {
        map.on('mousemove', layerId, (e) => {
          if (e.features && e.features[0]) {
            const props = e.features[0].properties as { name?: string; status?: string; description?: string };
            if (props?.name) {
              map.getCanvas().style.cursor = 'help';
              const rect = mapContainerRef.current?.getBoundingClientRect();
              setHoveredEnvZone({
                name: props.name,
                status: props.status || 'Demo overlay',
                description: props.description || '',
                x: (rect?.left || 0) + e.point.x,
                y: (rect?.top || 0) + e.point.y,
              });
            }
          }
        });
        map.on('mouseleave', layerId, () => {
          map.getCanvas().style.cursor = '';
          setHoveredEnvZone(null);
        });
      };

      const envFillLayers = [
        'layer-gw-stress-fill',
        'layer-air-quality-fill',
        'layer-heat-anomaly-fill',
        'layer-flood-hazard-fill',
        'layer-protected-areas-fill',
        'layer-transmission-grid-line',
      ];
      envFillLayers.forEach((l) => registerEnvHover(l));
    };

    map.on('load', onMapLoaded);
    setMapInstance(map);

    return () => {
      window.clearTimeout(loadTimer);
      resizeObserver.disconnect();
      Object.values(markersRef.current).forEach((marker) => marker.remove());
      markersRef.current = {};
      map.remove();
      setMapInstance(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle map style changes & re-add environmental overlays
  useEffect(() => {
    if (!mapInstance) return;
    if (prevStyleRef.current !== mapStyle) {
      prevStyleRef.current = mapStyle;
      const styleDef = getMapStyle(mapStyle, mapboxToken);
      mapInstance.setStyle(styleDef);

      mapInstance.once('style.load', () => {
        setupEnvironmentalLayers(mapInstance, activeLayers, layerOpacities);
      });
    }
  }, [mapStyle, mapboxToken, mapInstance, activeLayers, layerOpacities]);

  // Synchronize environmental layers visibility and opacity with left sidebar
  useEffect(() => {
    if (!mapInstance) return;

    const syncLayer = (fillId: string, lineId: string, storeKey: string, defaultOpacity: number, isLineOnly = false) => {
      const isActive = !!activeLayers[storeKey];
      const opacity = layerOpacities[storeKey] ?? defaultOpacity;

      if (!isLineOnly) {
        if (mapInstance.getLayer(fillId)) {
          mapInstance.setPaintProperty(fillId, 'fill-opacity', isActive ? opacity : 0);
        }
        if (mapInstance.getLayer(lineId)) {
          mapInstance.setPaintProperty(lineId, 'line-opacity', isActive ? 0.8 : 0);
        }
      } else {
        if (mapInstance.getLayer(lineId)) {
          mapInstance.setPaintProperty(lineId, 'line-opacity', isActive ? opacity : 0);
        }
      }
    };

    syncLayer('layer-gw-stress-fill', 'layer-gw-stress-line', 'env-groundwater-stress', 0.45);
    syncLayer('layer-air-quality-fill', 'layer-air-quality-line', 'env-air-quality', 0.4);
    syncLayer('layer-heat-anomaly-fill', 'layer-heat-anomaly-line', 'env-surface-temp', 0.4);
    syncLayer('layer-flood-hazard-fill', 'layer-flood-hazard-line', 'env-flood-susceptibility', 0.45);
    syncLayer('layer-protected-areas-fill', 'layer-protected-areas-line', 'env-protected-areas', 0.4);
    syncLayer('', 'layer-transmission-grid-line', 'layer-transmission-lines', 0.85, true);
  }, [activeLayers, layerOpacities, mapInstance]);

  // Synchronize viewport from store
  useEffect(() => {
    if (!mapInstance) return;
    const currentCenter = mapInstance.getCenter();
    const currentZoom = mapInstance.getZoom();

    if (
      Math.abs(currentCenter.lng - viewport.longitude) > 0.05 ||
      Math.abs(currentCenter.lat - viewport.latitude) > 0.05 ||
      Math.abs(currentZoom - viewport.zoom) > 0.3
    ) {
      mapInstance.flyTo({
        center: [viewport.longitude, viewport.latitude],
        zoom: viewport.zoom,
        essential: true,
        duration: 1000,
      });
    }
  }, [mapInstance, viewport.longitude, viewport.latitude, viewport.zoom]);

  // Facilities are city-scoped and mode-scoped by the store loader; this memo
  // applies only the view filters (layer toggles, type, risk, search).
  const filteredFacilities = useMemo(
    () =>
      facilities.filter((f) => {
        // 1. Check GIS layer visibility from LeftSidebar if toggled off
        const typeLayerMap: Record<string, string> = {
          data_centre: 'layer-data-centres',
          thermal_power: 'layer-thermal-power',
          hydro_power: 'layer-hydro-power',
          solar_farm: 'layer-solar-farms',
          wind_farm: 'layer-wind-farms',
          substation: 'layer-substations',
          industrial: 'layer-industrial',
        };
        const layerId = typeLayerMap[f.type];
        if (layerId && activeLayers && activeLayers[layerId] === false) {
          return false;
        }

        // 2. World Monitor Tactical Layers matching logic
        const matchesWmLayer =
          wmLayers.hotspots ||
          (wmLayers.conflicts && f.riskLevel === 'critical') ||
          (wmLayers.bases && f.type === 'data_centre') ||
          (wmLayers.nuclear && f.type === 'thermal_power') ||
          (wmLayers.military && f.type === 'substation') ||
          (wmLayers.weather && f.indicators.airPollution >= 55) ||
          (wmLayers.canadaAlerts && f.indicators.heatExposure >= 65) ||
          (wmLayers.outages && f.indicators.gridPressure >= 70) ||
          (wmLayers.natural && f.indicators.floodHazard >= 60) ||
          (wmLayers.waterways && f.type === 'hydro_power') ||
          (wmLayers.economic && (f.type === 'solar_farm' || f.type === 'wind_farm')) ||
          (wmLayers.sanctions && (f.indicators.biodiversityConstraint >= 60 || f.type === 'industrial'));

        if (!matchesWmLayer) return false;

        // 3. Type filter
        if (typeFilter !== 'all' && f.type !== typeFilter) return false;

        // 4. Risk filter
        if (riskFilter !== 'all' && f.riskLevel !== riskFilter) return false;

        // 5. Search query
        if (searchQuery.trim().length > 0) {
          const q = searchQuery.toLowerCase().trim();
          const match =
            f.name.toLowerCase().includes(q) ||
            f.state.toLowerCase().includes(q) ||
            f.district.toLowerCase().includes(q) ||
            f.operator?.toLowerCase().includes(q);
          if (!match) return false;
        }

        return true;
      }),
    [facilities, activeLayers, wmLayers, typeFilter, riskFilter, searchQuery]
  );

  const city = getPilotCity(cityId);

  // Keep the hover card anchored to the marker's projected screen position.
  useEffect(() => {
    if (!mapInstance || !hoveredFacility || !mapContainerRef.current) return;

    const syncTooltipPosition = () => {
      const point = mapInstance.project(hoveredFacility.coordinates);
      const rect = mapContainerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setTooltipPos({ x: rect.left + point.x, y: rect.top + point.y });
    };

    syncTooltipPosition();
    mapInstance.on('move', syncTooltipPosition);
    mapInstance.on('zoom', syncTooltipPosition);
    mapInstance.on('resize', syncTooltipPosition);
    mapInstance.on('rotate', syncTooltipPosition);
    mapInstance.on('pitch', syncTooltipPosition);

    return () => {
      mapInstance.off('move', syncTooltipPosition);
      mapInstance.off('zoom', syncTooltipPosition);
      mapInstance.off('resize', syncTooltipPosition);
      mapInstance.off('rotate', syncTooltipPosition);
      mapInstance.off('pitch', syncTooltipPosition);
    };
  }, [mapInstance, hoveredFacility]);

  // Render facility markers, diffed by facility id so pins never jump between
  // renders. MapLibre's stylesheet positions each marker element absolutely and
  // its per-frame transform keeps the pin anchored to its exact coordinate at
  // every zoom level — the element must never override `position` or set its
  // own `transform`, or pins drift away from their real location.
  useEffect(() => {
    if (!mapInstance) return;

    const buildFacilityElement = (facility: Facility, isSelected: boolean) => {
      const color = FACILITY_TYPE_COLORS[facility.type] || '#39f58b';
      const isCritical = facility.riskLevel === 'critical';
      const size = isSelected ? 34 : 26;

      const el = document.createElement('div');
      el.className = 'facility-marker-pin';
      el.dataset.id = facility.id;
      el.style.width = `${size}px`;
      el.style.height = `${size}px`;
      el.style.cursor = 'pointer';
      el.style.userSelect = 'none';
      el.style.zIndex = isSelected ? '100' : isCritical ? '40' : '20';
      el.setAttribute('role', 'button');
      el.setAttribute('tabindex', '0');
      el.setAttribute('aria-label', `Open facility dossier for ${facility.name}`);

      el.innerHTML = `
        <div style="position: relative; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;">
          ${
            isCritical || isSelected
              ? `<div style="position: absolute; inset: -6px; border-radius: 9999px; background-color: ${
                  isCritical ? '#ff5d68' : color
                }; opacity: 0.3; pointer-events: none;"></div>`
              : ''
          }
          <div class="marker-core" style="width: 100%; height: 100%; border-radius: 9999px; background-color: ${color}; border: 2.5px solid #0b0d0c; display: flex; align-items: center; justify-content: center; color: #0b0d0c; box-shadow: 0 4px 14px rgba(0,0,0,0.85); transition: transform 0.15s ease;">
            ${getFacilityIconSvg(facility.type)}
          </div>
          ${
            isSelected
              ? `<div style="position: absolute; top: -3px; right: -3px; width: 14px; height: 14px; border-radius: 9999px; background-color: #e7f1e8; color: #0b0d0c; border: 1.5px solid #0b0d0c; display: flex; align-items: center; justify-content: center; font-size: 8px; font-weight: 900;">✓</div>`
              : isCritical
              ? `<div style="position: absolute; top: -3px; right: -3px; width: 13px; height: 13px; border-radius: 9999px; background-color: #ff5d68; color: #0b0d0c; border: 1.5px solid #0b0d0c; display: flex; align-items: center; justify-content: center; font-size: 8px; font-weight: 800;">!</div>`
              : ''
          }
          <div class="facility-name-tag" style="position: absolute; top: calc(100% + 4px); left: 50%; transform: translateX(-50%); background-color: rgba(17, 21, 20, 0.95); border: 1px solid #29362f; border-radius: 4px; padding: 2px 6px; font-size: 12px; font-weight: 500; color: #e7f1e8; white-space: nowrap; pointer-events: none; box-shadow: 0 4px 10px rgba(0,0,0,0.6); opacity: 0; transition: opacity 0.15s ease; z-index: 1000;">
            ${facility.name}
          </div>
        </div>
      `;

      const selectFacility = () => {
        setHoveredFacility(null);
        setTooltipPos(null);
        setSelectedFacilityId(facility.id);
      };

      el.addEventListener('mouseenter', () => {
        const core = el.querySelector('.marker-core') as HTMLElement | null;
        if (core) core.style.transform = 'scale(1.25)';
        const tag = el.querySelector('.facility-name-tag') as HTMLElement | null;
        if (tag) tag.style.opacity = '1';
        setHoveredFacility(facility);
      });

      el.addEventListener('mouseleave', () => {
        const core = el.querySelector('.marker-core') as HTMLElement | null;
        if (core) core.style.transform = 'scale(1)';
        const tag = el.querySelector('.facility-name-tag') as HTMLElement | null;
        if (tag) tag.style.opacity = '0';
        setHoveredFacility(null);
        setTooltipPos(null);
      });

      el.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
      });

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        selectFacility();
      });

      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectFacility();
        }
      });

      return el;
    };

    const desired = new Map(filteredFacilities.map((facility) => [facility.id, facility]));

    // Drop markers whose facility is no longer visible.
    Object.entries(markersRef.current).forEach(([id, marker]) => {
      if (!desired.has(id)) {
        marker.remove();
        delete markersRef.current[id];
      }
    });

    desired.forEach((facility, id) => {
      const isSelected = facility.id === selectedFacilityId;
      const existing = markersRef.current[id];

      if (existing && existing.getElement().dataset.selected === String(isSelected)) {
        // Same pin state — just re-assert the exact coordinate.
        existing.setLngLat(facility.coordinates);
        return;
      }
      if (existing) {
        existing.remove();
        delete markersRef.current[id];
      }

      const el = buildFacilityElement(facility, isSelected);
      el.dataset.selected = String(isSelected);

      markersRef.current[id] = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat(facility.coordinates)
        .addTo(mapInstance);
    });

    // Teardown of all markers happens in the map-initialisation effect cleanup.
  }, [mapInstance, filteredFacilities, selectedFacilityId, setSelectedFacilityId]);

  return (
    <div className="relative w-full h-full min-h-[300px] overflow-hidden bg-eco-bg">
      {/* Map Container - absolute inset-0 guarantees it fills the full container dimensions */}
      <div
        ref={mapContainerRef}
        className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing"
      />

      {/* Top-left floating controls */}
      <div className="absolute top-3.5 left-3.5 z-20 flex items-center gap-2 select-none">
        <button
          type="button"
          onClick={toggleLeftSidebar}
          className="flex items-center gap-2 px-3 py-1.5 bg-eco-surface/90 hover:bg-eco-surface-secondary border border-eco-border text-eco-text rounded-lg shadow-lg backdrop-blur-md text-xs font-medium transition-colors cursor-pointer"
        >
          <Layers className="w-3.5 h-3.5 text-eco-primary" />
          <span>Layers &amp; filters</span>
        </button>

        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-eco-surface/80 border border-eco-border text-eco-muted rounded-lg shadow-lg backdrop-blur-md text-xs">
          <span className="w-2 h-2 rounded-full bg-eco-primary" />
          <span className="font-semibold text-eco-text">
            {facilitiesStatus === 'loading'
              ? 'Loading facilities…'
              : facilitiesStatus === 'error'
              ? 'Facilities unavailable'
              : `${filteredFacilities.length} ${
                  filteredFacilities.length === 1 ? 'facility' : 'facilities'
                } · ${city.name}`}
          </span>
          {mapboxToken && (
            <span className="text-micro text-eco-primary bg-eco-primary/10 px-1.5 py-0.5 rounded border border-eco-primary/30 font-mono uppercase tracking-wide">
              Mapbox HD
            </span>
          )}
        </div>
      </div>

      {/* Floating map controls (top-right) */}
      <div className="absolute top-3.5 right-3.5 flex flex-col gap-1.5 z-20 select-none">
        {/* Basemap selector */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setStyleMenuOpen(!styleMenuOpen)}
            className="w-8 h-8 rounded-lg bg-eco-surface/90 border border-eco-border text-eco-text flex items-center justify-center hover:bg-eco-surface-secondary shadow-lg backdrop-blur-md transition-colors"
            title="Switch basemap"
          >
            <Layers className="w-4 h-4 text-eco-primary" />
          </button>

          {styleMenuOpen && (
            <div className="absolute right-0 top-10 w-44 bg-eco-surface border border-eco-border rounded-lg shadow-2xl p-1.5 space-y-1 text-xs">
              <div className="px-2 py-1 text-micro text-eco-muted border-b border-eco-border flex items-center justify-between font-mono uppercase tracking-wide">
                <span>Basemap</span>
                {mapboxToken && (
                  <span className="text-eco-primary flex items-center gap-0.5">
                    <Sparkles className="w-2.5 h-2.5" />
                    <span>Mapbox</span>
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setMapStyle('dark');
                  setStyleMenuOpen(false);
                }}
                className={`w-full text-left px-2 py-1.5 rounded flex items-center justify-between ${
                  mapStyle === 'dark'
                    ? 'bg-eco-surface-secondary text-eco-primary font-semibold'
                    : 'text-eco-text hover:bg-eco-surface-secondary/60'
                }`}
              >
                <span>{mapboxToken ? 'Mapbox Dark v11' : 'Dark Matter'}</span>
                {mapStyle === 'dark' && <span className="text-micro">●</span>}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMapStyle('satellite');
                  setStyleMenuOpen(false);
                }}
                className={`w-full text-left px-2 py-1.5 rounded flex items-center justify-between ${
                  mapStyle === 'satellite'
                    ? 'bg-eco-surface-secondary text-eco-primary font-semibold'
                    : 'text-eco-text hover:bg-eco-surface-secondary/60'
                }`}
              >
                <span>{mapboxToken ? 'Mapbox Satellite' : 'ESRI Satellite'}</span>
                {mapStyle === 'satellite' && <span className="text-micro">●</span>}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMapStyle('streets');
                  setStyleMenuOpen(false);
                }}
                className={`w-full text-left px-2 py-1.5 rounded flex items-center justify-between ${
                  mapStyle === 'streets'
                    ? 'bg-eco-surface-secondary text-eco-primary font-semibold'
                    : 'text-eco-text hover:bg-eco-surface-secondary/60'
                }`}
              >
                <span>{mapboxToken ? 'Mapbox Light v11' : 'Positron Light'}</span>
                {mapStyle === 'streets' && <span className="text-micro">●</span>}
              </button>
            </div>
          )}
        </div>

        {/* Zoom in */}
        <button
          type="button"
          onClick={() => mapInstance?.zoomIn()}
          className="w-8 h-8 rounded-lg bg-eco-surface/90 border border-eco-border text-eco-text flex items-center justify-center hover:bg-eco-surface-secondary shadow-lg backdrop-blur-md transition-colors cursor-pointer"
          title="Zoom in"
        >
          <ZoomIn className="w-4 h-4" />
        </button>

        {/* Zoom out */}
        <button
          type="button"
          onClick={() => mapInstance?.zoomOut()}
          className="w-8 h-8 rounded-lg bg-eco-surface/90 border border-eco-border text-eco-text flex items-center justify-center hover:bg-eco-surface-secondary shadow-lg backdrop-blur-md transition-colors cursor-pointer"
          title="Zoom out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>

        {/* Recenter on the selected city */}
        <button
          type="button"
          onClick={() => fitToIndia()}
          className="w-8 h-8 rounded-lg bg-eco-surface/90 border border-eco-border text-eco-text flex items-center justify-center hover:bg-eco-surface-secondary shadow-lg backdrop-blur-md transition-colors cursor-pointer"
          title={`Recenter on ${city.name}`}
        >
          <Compass className="w-4 h-4 text-eco-primary" />
        </button>
      </div>

      {/* Basemap failure notice */}
      {mapError && (
        <div className="absolute top-3.5 right-14 z-30 max-w-sm flex items-start gap-2 bg-eco-surface/95 border border-eco-critical/50 text-eco-text rounded-lg shadow-2xl backdrop-blur-md px-3 py-2 text-xs">
          <div className="flex-1 min-w-0">
            <span className="font-semibold text-eco-critical">Basemap issue. </span>
            <span className="text-eco-muted">{mapError}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setMapError(null);
              if (!mapInstance) return;
              mapInstance.setStyle(getMapStyle(mapStyle, mapboxToken));
              mapInstance.once('style.load', () => {
                setupEnvironmentalLayers(mapInstance, activeLayers, layerOpacities);
              });
            }}
            className="shrink-0 text-eco-primary hover:underline"
          >
            Retry
          </button>
          <button
            type="button"
            onClick={() => setMapError(null)}
            aria-label="Dismiss basemap notice"
            className="shrink-0 text-eco-muted hover:text-eco-text"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Facility type legend */}
      <div className="absolute bottom-4 left-4 z-20 hidden lg:flex flex-wrap items-center gap-x-3 gap-y-1 max-w-[75%] px-3 py-2 bg-eco-surface/90 border border-eco-border rounded-lg shadow-2xl backdrop-blur-md text-xs text-eco-text select-none">
        <span className="text-micro uppercase tracking-wider text-eco-muted font-mono">
          Legend
        </span>
        {(Object.keys(FACILITY_TYPE_COLORS) as InfrastructureType[]).map((type) => (
          <div key={type} className="flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-full border border-eco-bg shadow"
              style={{ backgroundColor: FACILITY_TYPE_COLORS[type] }}
            />
            <span>{FACILITY_TYPE_LABELS[type]}</span>
          </div>
        ))}
      </div>

      {/* Hover tooltip */}
      {hoveredFacility && tooltipPos && (
        <div
          className="fixed z-50 pointer-events-none bg-eco-surface/95 border border-eco-border text-eco-text rounded-lg p-3 shadow-2xl backdrop-blur-md text-xs w-64 -translate-x-1/2 -translate-y-full mb-3"
          style={{
            left: `${tooltipPos.x}px`,
            top: `${tooltipPos.y - 10}px`,
          }}
        >
          <div className="flex items-center justify-between gap-2 border-b border-eco-border pb-1.5 mb-2">
            <span className="font-semibold text-eco-text truncate text-xs">{hoveredFacility.name}</span>
            <span
              className="text-micro uppercase px-1.5 py-0.5 rounded font-mono shrink-0"
              style={{
                backgroundColor: `${FACILITY_TYPE_COLORS[hoveredFacility.type]}20`,
                color: FACILITY_TYPE_COLORS[hoveredFacility.type],
              }}
            >
              {FACILITY_TYPE_LABELS[hoveredFacility.type]}
            </span>
          </div>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between gap-2">
              <span className="text-eco-muted">Location</span>
              <span className="text-eco-text truncate">
                {hoveredFacility.district}, {hoveredFacility.state}
              </span>
            </div>
            {hoveredFacility.capacityMw && (
              <div className="flex justify-between">
                <span className="text-eco-muted">Capacity</span>
                <span className="text-eco-primary font-mono font-semibold">
                  {hoveredFacility.capacityMw.toLocaleString()} MW
                </span>
              </div>
            )}
            <div className="flex justify-between items-center pt-1.5 border-t border-eco-border">
              <span className="text-eco-muted">Risk score</span>
              <span
                className="font-mono font-semibold"
                style={{ color: scoreColor(hoveredFacility.overallRiskScore) }}
              >
                {hoveredFacility.overallRiskScore}/100
              </span>
            </div>
          </div>
          <div className="text-micro text-eco-muted pt-1.5 text-center">
            Click marker to open facility dossier
          </div>
        </div>
      )}

      {/* Environmental overlay hover tooltip */}
      {hoveredEnvZone && (
        <div
          className="fixed z-50 pointer-events-none bg-eco-surface/95 border border-eco-border text-eco-text rounded-lg p-3 shadow-2xl backdrop-blur-md text-xs max-w-xs -translate-x-1/2 -translate-y-full mb-3"
          style={{
            left: `${hoveredEnvZone.x}px`,
            top: `${hoveredEnvZone.y - 12}px`,
          }}
        >
          <div className="flex items-center justify-between gap-2 border-b border-eco-border pb-1 mb-1.5">
            <span className="font-semibold text-eco-text text-xs">{hoveredEnvZone.name}</span>
            <span className="text-micro uppercase font-mono px-1.5 py-0.5 rounded bg-eco-warning/10 text-eco-warning border border-eco-warning/30 shrink-0">
              {hoveredEnvZone.status}
            </span>
          </div>
          <p className="text-meta text-eco-muted leading-relaxed">{hoveredEnvZone.description}</p>
          <p className="text-micro text-eco-muted/80 pt-1.5">
            Demo environmental overlay — not live monitoring data.
          </p>
        </div>
      )}
    </div>
  );
};
