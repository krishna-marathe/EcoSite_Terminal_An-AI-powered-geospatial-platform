import React, { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  Compass,
  Layers,
  ZoomIn,
  ZoomOut,
  Sparkles,
  Grid,
} from 'lucide-react';
import { useDashboardStore } from '../../stores/dashboardStore';
import { DEMO_FACILITIES } from '../../data/demo/facilities';
import {
  GROUNDWATER_ZONES_GEOJSON,
  AIR_QUALITY_ZONES_GEOJSON,
  HEAT_ANOMALY_ZONES_GEOJSON,
  FLOOD_HAZARD_ZONES_GEOJSON,
  PROTECTED_AREAS_GEOJSON,
  TRANSMISSION_GRID_GEOJSON,
} from '../../data/demo/environmentalOverlays';
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

const TYPE_COLORS: Record<InfrastructureType, string> = {
  data_centre: '#38BDF8', // Blue
  thermal_power: '#EF4444', // Red
  solar_farm: '#22C55E', // Green
  wind_farm: '#10B981', // Emerald
  hydro_power: '#06B6D4', // Cyan
  substation: '#F59E0B', // Yellow
  industrial: '#A855F7', // Purple
};

interface RegionalCluster {
  id: string;
  name: string;
  coordinates: [number, number];
  facilityIds: string[];
}

const REGIONAL_CLUSTERS: RegionalCluster[] = [
  {
    id: 'cluster-chhattisgarh-coal',
    name: 'Central Energy & HVDC Terminal Hub',
    coordinates: [82.8, 22.8],
    facilityIds: ['thermal-singrauli-01', 'thermal-korba-02', 'substation-raigarh-01', 'substation-champa-02', 'solar-rewa-02'],
  },
  {
    id: 'cluster-gujarat-megapark',
    name: 'Gujarat Clean Energy & Chip Corridor',
    coordinates: [71.5, 23.0],
    facilityIds: ['hydro-sardar-sarovar-02', 'industrial-dholera-01', 'solar-khavda-01'],
  },
  {
    id: 'cluster-thar-clean',
    name: 'Thar Desert Renewable Complex',
    coordinates: [71.4, 27.2],
    facilityIds: ['solar-bhadla-01', 'wind-jaisalmer-02'],
  },
  {
    id: 'cluster-tamilnadu-corridor',
    name: 'Tamil Nadu Coastal Power & DC Corridor',
    coordinates: [79.0, 11.0],
    facilityIds: ['dc-chennai-05', 'thermal-ennore-03', 'wind-muppandal-01'],
  },
  {
    id: 'cluster-bengaluru-tech',
    name: 'Karnataka High-Tech & Solar Basin',
    coordinates: [77.5, 13.6],
    facilityIds: ['dc-bangalore-03', 'solar-pavagada-03'],
  },
];

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
  const [clusterMode, setClusterMode] = useState<'auto' | 'expanded'>('auto');

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

    map.on('error', (e) => {
      console.warn('MapLibre event error:', e);
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
                status: props.status || 'Active Hazard Tier',
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

  // Filter facilities based on active layers and filters
  const filteredFacilities = DEMO_FACILITIES.filter((f) => {
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
  });

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

  // Render facility markers and high-altitude clusters with robust lifecycle synchronization
  useEffect(() => {
    if (!mapInstance) return;

    const renderMarkers = () => {
      // Clean up previous markers
      Object.values(markersRef.current).forEach((marker) => marker.remove());
      markersRef.current = {};

      const currentZoom = mapInstance.getZoom();
      const shouldCluster = clusterMode === 'auto' && currentZoom < 5.8;

      const clusteredFacilityIds = new Set<string>();

      if (shouldCluster) {
        REGIONAL_CLUSTERS.forEach((cluster) => {
          const matchingFacilities = filteredFacilities.filter((f) =>
            cluster.facilityIds.includes(f.id)
          );

          if (matchingFacilities.length >= 2) {
            matchingFacilities.forEach((f) => clusteredFacilityIds.add(f.id));

            // Create Cluster Marker Node
            const el = document.createElement('div');
            el.className = 'facility-cluster-node group cursor-pointer select-none';
            el.style.width = '42px';
            el.style.height = '42px';
            el.style.position = 'relative';
            el.style.display = 'flex';
            el.style.alignItems = 'center';
            el.style.justifyContent = 'center';
            el.style.zIndex = '35';

            const hasCritical = matchingFacilities.some((f) => f.riskLevel === 'critical');

            el.innerHTML = `
              <div class="relative w-full h-full flex items-center justify-center">
                ${
                  hasCritical
                    ? `<div class="absolute -inset-2 rounded-full animate-ping opacity-60 bg-rose-500 pointer-events-none"></div>`
                    : `<div class="absolute -inset-1 rounded-full animate-pulse opacity-40 bg-sky-400 pointer-events-none"></div>`
                }
                <div class="w-full h-full rounded-full bg-[#0B1220] border-2 border-sky-400 flex flex-col items-center justify-center shadow-2xl transition-transform duration-200 group-hover:scale-115">
                  <span class="font-black text-xs font-mono text-sky-300 leading-none">${matchingFacilities.length}</span>
                  <span class="text-[7px] font-bold text-slate-400 uppercase tracking-tighter leading-none mt-0.5">SITES</span>
                </div>
                <div class="cluster-tooltip opacity-0 group-hover:opacity-100 transition-opacity duration-150 absolute top-full left-1/2 -translate-x-1/2 mt-1.5 px-2.5 py-1 rounded bg-[#0B1220]/95 border border-[#1E293B] text-[10px] text-slate-100 font-semibold whitespace-nowrap shadow-2xl pointer-events-none z-50">
                  <div class="font-bold text-sky-400">${cluster.name}</div>
                  <div class="text-[9px] text-slate-400">${matchingFacilities.length} facilities • Click to zoom & expand</div>
                </div>
              </div>
            `;

            el.addEventListener('click', (e) => {
              e.stopPropagation();
              mapInstance.flyTo({
                center: cluster.coordinates,
                zoom: 7.2,
                duration: 800,
              });
            });

            const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
              .setLngLat(cluster.coordinates)
              .addTo(mapInstance);

            markersRef.current[cluster.id] = marker;
          }
        });
      }

      // Render individual markers for unclustered facilities
      filteredFacilities.forEach((facility) => {
        if (clusteredFacilityIds.has(facility.id)) return;

        const isSelected = facility.id === selectedFacilityId;
        const color = TYPE_COLORS[facility.type] || '#38BDF8';
        const isCritical = facility.riskLevel === 'critical';
        const size = isSelected ? 34 : 26;

        const el = document.createElement('div');
        el.className = 'facility-marker-pin';
        el.setAttribute('data-id', facility.id);
        el.style.width = `${size}px`;
        el.style.height = `${size}px`;
        el.style.position = 'relative';
        el.style.cursor = 'pointer';
        el.style.userSelect = 'none';
        el.style.zIndex = isSelected ? '100' : isCritical ? '40' : '20';
        el.setAttribute('role', 'button');
        el.setAttribute('tabindex', '0');
        el.setAttribute('aria-label', `Open facility dossier for ${facility.name}`);

        const iconSvg = getFacilityIconSvg(facility.type);

        el.innerHTML = `
          <div style="position: relative; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;">
            ${
              isCritical || isSelected
                ? `<div style="position: absolute; inset: -6px; border-radius: 9999px; background-color: ${
                    isCritical ? '#EF4444' : color
                  }; opacity: 0.55; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite; pointer-events: none;"></div>`
                : ''
            }
            <div class="marker-core" style="width: 100%; height: 100%; border-radius: 9999px; background-color: ${color}; border: 2.5px solid #080D16; display: flex; align-items: center; justify-content: center; color: white; box-shadow: 0 4px 14px rgba(0,0,0,0.85), 0 0 10px ${color}80; transition: transform 0.15s ease;">
              ${iconSvg}
            </div>
            ${
              isSelected
                ? `<div style="position: absolute; top: -3px; right: -3px; width: 14px; height: 14px; border-radius: 9999px; background-color: #FFFFFF; color: #080D16; border: 1.5px solid #080D16; display: flex; align-items: center; justify-content: center; font-size: 8px; font-weight: 900; box-shadow: 0 2px 4px rgba(0,0,0,0.5);">✓</div>`
                : isCritical
                ? `<div style="position: absolute; top: -3px; right: -3px; width: 13px; height: 13px; border-radius: 9999px; background-color: #EF4444; color: #FFFFFF; border: 1.5px solid #080D16; display: flex; align-items: center; justify-content: center; font-size: 8px; font-weight: 800; box-shadow: 0 2px 4px rgba(0,0,0,0.5);">!</div>`
                : ''
            }
            <div class="facility-name-tag" style="position: absolute; top: calc(100% + 4px); left: 50%; transform: translateX(-50%); background-color: rgba(11, 18, 32, 0.95); border: 1px solid #1E293B; border-radius: 4px; padding: 2px 6px; font-size: 10px; font-weight: 600; color: #F1F5F9; white-space: nowrap; pointer-events: none; box-shadow: 0 4px 10px rgba(0,0,0,0.6); opacity: 0; transition: opacity 0.15s ease; z-index: 1000;">
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

        const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat(facility.coordinates)
          .addTo(mapInstance);

        markersRef.current[facility.id] = marker;
      });
    };

    renderMarkers();

    mapInstance.on('style.load', renderMarkers);
    mapInstance.on('zoomend', renderMarkers);

    return () => {
      mapInstance.off('style.load', renderMarkers);
      mapInstance.off('zoomend', renderMarkers);
      Object.values(markersRef.current).forEach((marker) => marker.remove());
      markersRef.current = {};
    };
  }, [mapInstance, filteredFacilities, selectedFacilityId, setSelectedFacilityId, clusterMode]);

  return (
    <div className="relative w-full h-full min-h-[300px] overflow-hidden bg-[#060A10]">
      {/* Map Container - absolute inset-0 guarantees it fills the full container dimensions */}
      <div
        ref={mapContainerRef}
        className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing"
      />

      {/* Clean Top-Left Floating Controls */}
      <div className="absolute top-3.5 left-3.5 z-20 flex items-center gap-2 select-none">
        <button
          type="button"
          onClick={toggleLeftSidebar}
          className="flex items-center gap-2 px-3 py-1.5 bg-[#0F172A]/90 hover:bg-[#1E293B] border border-[#1E293B] text-slate-200 rounded-lg shadow-lg backdrop-blur-md text-xs font-medium transition-colors cursor-pointer"
        >
          <Layers className="w-3.5 h-3.5 text-sky-400" />
          <span>Layers & Filters</span>
        </button>

        {/* Clustering Mode Toggle */}
        <button
          type="button"
          onClick={() => setClusterMode(clusterMode === 'auto' ? 'expanded' : 'auto')}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#0F172A]/90 hover:bg-[#1E293B] border border-[#1E293B] text-slate-200 rounded-lg shadow-lg backdrop-blur-md text-xs font-mono transition-colors cursor-pointer"
          title="Toggle High-Altitude Regional Clustering (Zoom < 5.8)"
        >
          <Grid className="w-3.5 h-3.5 text-emerald-400" />
          <span>{clusterMode === 'auto' ? 'Cluster: Auto' : 'Cluster: Off'}</span>
        </button>

        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-[#0F172A]/80 border border-[#1E293B] text-slate-300 rounded-lg shadow-lg backdrop-blur-md text-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-semibold text-slate-100">{filteredFacilities.length} Facilities</span>
          {mapboxToken ? (
            <span className="text-[10px] text-sky-400 bg-sky-950/80 px-1.5 py-0.2 rounded border border-sky-800/80 font-mono">
              Mapbox HD
            </span>
          ) : (
            <span className="text-slate-500">Active</span>
          )}
        </div>
      </div>

      {/* Floating Map Controls (Top-Right) */}
      <div className="absolute top-3.5 right-3.5 flex flex-col gap-1.5 z-20 select-none">
        {/* Style Selector */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setStyleMenuOpen(!styleMenuOpen)}
            className="w-8 h-8 rounded-lg bg-[#0F172A]/90 border border-[#1E293B] text-slate-200 flex items-center justify-center hover:bg-[#1E293B] shadow-lg backdrop-blur-md transition-colors"
            title="Switch Map Basemap Style"
          >
            <Layers className="w-4 h-4 text-sky-400" />
          </button>

          {styleMenuOpen && (
            <div className="absolute right-0 top-10 w-44 bg-[#0F172A] border border-[#1E293B] rounded-lg shadow-2xl p-1.5 space-y-1 text-xs">
              <div className="px-2 py-1 text-[10px] text-slate-400 border-b border-[#1E293B] flex items-center justify-between font-mono">
                <span>BASEMAP ENGINE</span>
                {mapboxToken && (
                  <span className="text-sky-400 flex items-center gap-0.5">
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
                  mapStyle === 'dark' ? 'bg-[#15202E] text-sky-400 font-bold' : 'text-slate-300 hover:bg-[#15202E]/60'
                }`}
              >
                <span>{mapboxToken ? 'Mapbox Dark v11' : 'Dark Matter'}</span>
                {mapStyle === 'dark' && <span className="text-[10px]">●</span>}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMapStyle('satellite');
                  setStyleMenuOpen(false);
                }}
                className={`w-full text-left px-2 py-1.5 rounded flex items-center justify-between ${
                  mapStyle === 'satellite' ? 'bg-[#15202E] text-sky-400 font-bold' : 'text-slate-300 hover:bg-[#15202E]/60'
                }`}
              >
                <span>{mapboxToken ? 'Mapbox Satellite' : 'ESRI Satellite'}</span>
                {mapStyle === 'satellite' && <span className="text-[10px]">●</span>}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMapStyle('streets');
                  setStyleMenuOpen(false);
                }}
                className={`w-full text-left px-2 py-1.5 rounded flex items-center justify-between ${
                  mapStyle === 'streets' ? 'bg-[#15202E] text-sky-400 font-bold' : 'text-slate-300 hover:bg-[#15202E]/60'
                }`}
              >
                <span>{mapboxToken ? 'Mapbox Light v11' : 'Positron Light'}</span>
                {mapStyle === 'streets' && <span className="text-[10px]">●</span>}
              </button>
            </div>
          )}
        </div>

        {/* Zoom In */}
        <button
          type="button"
          onClick={() => mapInstance?.zoomIn()}
          className="w-8 h-8 rounded-lg bg-[#0F172A]/90 border border-[#1E293B] text-slate-200 flex items-center justify-center hover:bg-[#1E293B] shadow-lg backdrop-blur-md transition-colors cursor-pointer"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>

        {/* Zoom Out */}
        <button
          type="button"
          onClick={() => mapInstance?.zoomOut()}
          className="w-8 h-8 rounded-lg bg-[#0F172A]/90 border border-[#1E293B] text-slate-200 flex items-center justify-center hover:bg-[#1E293B] shadow-lg backdrop-blur-md transition-colors cursor-pointer"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>

        {/* Fit to India */}
        <button
          type="button"
          onClick={() => {
            fitToIndia();
            mapInstance?.flyTo({ center: [78.9629, 22.5937], zoom: 4.5, duration: 1000 });
          }}
          className="w-8 h-8 rounded-lg bg-[#0F172A]/90 border border-[#1E293B] text-slate-200 flex items-center justify-center hover:bg-[#1E293B] shadow-lg backdrop-blur-md transition-colors cursor-pointer"
          title="Fit View to India"
        >
          <Compass className="w-4 h-4 text-emerald-400" />
        </button>
      </div>

      {/* Floating Tactical Map Legend */}
      <div className="absolute bottom-4 left-4 z-20 hidden md:flex items-center gap-3 px-3 py-2 bg-[#0F172A]/90 border border-[#1E293B] rounded-lg shadow-2xl backdrop-blur-md text-[11px] text-slate-300 select-none">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
          Legend:
        </span>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#38BDF8] border border-black shadow" />
          <span>Data Centre</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444] border border-black shadow" />
          <span>Thermal Power</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#22C55E] border border-black shadow" />
          <span>Solar / Wind</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#06B6D4] border border-black shadow" />
          <span>Hydro</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B] border border-black shadow" />
          <span>Substation</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#A855F7] border border-black shadow" />
          <span>Industrial</span>
        </div>
      </div>

      {/* Hover Tooltip */}
      {hoveredFacility && tooltipPos && (
        <div
          className="fixed z-50 pointer-events-none bg-[#0F172A]/95 border border-[#1E293B] text-slate-100 rounded-lg p-3 shadow-2xl backdrop-blur-md text-xs font-sans w-64 -translate-x-1/2 -translate-y-full mb-3"
          style={{
            left: `${tooltipPos.x}px`,
            top: `${tooltipPos.y - 10}px`,
          }}
        >
          <div className="flex items-center justify-between border-b border-[#1E293B] pb-1.5 mb-2">
            <span className="font-semibold text-slate-100 truncate text-xs">{hoveredFacility.name}</span>
            <span
              className="text-[10px] uppercase px-1.5 py-0.2 rounded font-semibold"
              style={{
                backgroundColor: `${TYPE_COLORS[hoveredFacility.type]}20`,
                color: TYPE_COLORS[hoveredFacility.type],
              }}
            >
              {hoveredFacility.type.replace('_', ' ')}
            </span>
          </div>
          <div className="space-y-1 text-xs text-slate-300">
            <div className="flex justify-between">
              <span className="text-slate-400">Location:</span>
              <span>{hoveredFacility.district}, {hoveredFacility.state}</span>
            </div>
            {hoveredFacility.capacityMw && (
              <div className="flex justify-between">
                <span className="text-slate-400">Capacity:</span>
                <span className="text-emerald-400 font-mono font-semibold">{hoveredFacility.capacityMw.toLocaleString()} MW</span>
              </div>
            )}
            <div className="flex justify-between items-center pt-1.5 border-t border-[#1E293B]">
              <span className="text-slate-400">Risk Score:</span>
              <div className="flex items-center gap-1 font-bold font-mono">
                <span
                  className={
                    hoveredFacility.overallRiskScore >= 80
                      ? 'text-rose-400'
                      : hoveredFacility.overallRiskScore >= 65
                      ? 'text-amber-400'
                      : hoveredFacility.overallRiskScore >= 45
                      ? 'text-sky-400'
                      : 'text-emerald-400'
                  }
                >
                  {hoveredFacility.overallRiskScore}/100
                </span>
              </div>
            </div>
          </div>
          <div className="text-[10px] text-slate-400 pt-1.5 text-center">
            Click marker to inspect facility dossier
          </div>
        </div>
      )}

      {/* Environmental Hazard Zone Hover Tooltip */}
      {hoveredEnvZone && (
        <div
          className="fixed z-50 pointer-events-none bg-[#0F172A]/95 border border-sky-500/60 text-slate-100 rounded-lg p-3 shadow-2xl backdrop-blur-md text-xs font-sans max-w-xs -translate-x-1/2 -translate-y-full mb-3"
          style={{
            left: `${hoveredEnvZone.x}px`,
            top: `${hoveredEnvZone.y - 12}px`,
          }}
        >
          <div className="flex items-center justify-between border-b border-[#1E293B] pb-1 mb-1.5">
            <span className="font-bold text-sky-300 text-xs">{hoveredEnvZone.name}</span>
            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-sky-950 text-sky-400 border border-sky-800">
              {hoveredEnvZone.status}
            </span>
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed font-sans">{hoveredEnvZone.description}</p>
        </div>
      )}
    </div>
  );
};
