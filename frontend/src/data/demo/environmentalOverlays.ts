import type { FeatureCollection, Polygon, LineString, GeoJsonProperties } from 'geojson';

// 1. CGWB Groundwater Stress Zones across India
export const GROUNDWATER_ZONES_GEOJSON: FeatureCollection<Polygon, GeoJsonProperties> = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {
        id: 'gw-punjab-haryana',
        name: 'Indo-Gangetic Upper Aquifer (Punjab-Haryana-West UP)',
        status: 'Over-Exploited',
        extractionStage: 164,
        color: '#EF4444', // Red
        description: 'Critical tubewell overdraft for paddy-wheat cycle. Water table dropping > 1m/year.',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [74.5, 31.8],
            [77.8, 30.8],
            [78.5, 28.5],
            [76.8, 27.8],
            [75.0, 29.2],
            [74.5, 31.8],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        id: 'gw-rajasthan-shekhawati',
        name: 'Western Arid & Shekhawati Hardrock Basin',
        status: 'Over-Exploited',
        extractionStage: 148,
        color: '#EF4444',
        description: 'Hyper-arid crystalline aquifer with deep saline water interface.',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [71.5, 28.2],
            [75.5, 28.0],
            [75.2, 25.8],
            [72.0, 25.5],
            [71.5, 28.2],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        id: 'gw-tamil-nadu-cauvery',
        name: 'Tamil Nadu Crystalline & Cauvery Delta',
        status: 'Critical',
        extractionStage: 94,
        color: '#F59E0B', // Amber
        description: 'Hard-rock fissure aquifers with erratic northeast monsoon recharge.',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [77.2, 12.2],
            [80.0, 12.8],
            [79.8, 10.2],
            [77.5, 10.5],
            [77.2, 12.2],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        id: 'gw-bengaluru-urban',
        name: 'Bengaluru Urban & Arkavathi Watershed',
        status: 'Over-Exploited',
        extractionStage: 138,
        color: '#EF4444',
        description: 'Severe commercial and IT park borewell extraction, localized contamination.',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [77.2, 13.4],
            [78.2, 13.3],
            [78.1, 12.6],
            [77.1, 12.7],
            [77.2, 13.4],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        id: 'gw-maharashtra-vidarbha',
        name: 'Central Deccan Basaltic Trap (Vidarbha & Marathwada)',
        status: 'Semi-Critical',
        extractionStage: 78,
        color: '#3B82F6', // Blue
        description: 'Low-porosity vesicular basalt with rapid summer depletion.',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [74.5, 20.8],
            [79.5, 21.2],
            [79.8, 18.8],
            [75.2, 18.5],
            [74.5, 20.8],
          ],
        ],
      },
    },
  ],
};

// 2. CPCB Ambient Air Quality (PM2.5) Pollution Zones
export const AIR_QUALITY_ZONES_GEOJSON: FeatureCollection<Polygon, GeoJsonProperties> = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {
        id: 'air-indo-gangetic-plain',
        name: 'Indo-Gangetic Airshed (Severe PM2.5 Belt)',
        status: 'Severe Hazard',
        pm25Value: 142,
        color: '#DC2626', // Deep Red
        description: 'Persistent winter temperature inversion, crop residue burning, and coal power emissions.',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [75.2, 30.5],
            [84.5, 26.8],
            [88.2, 24.5],
            [87.0, 23.2],
            [81.5, 24.8],
            [76.0, 27.5],
            [75.2, 30.5],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        id: 'air-mumbai-pune-airshed',
        name: 'Mumbai Metropolitan & Pune Industrial Basin',
        status: 'Poor Air Quality',
        pm25Value: 74,
        color: '#F97316', // Orange
        description: 'Vehicular emissions, marine aerosol trap, and petrochemical refining corridors.',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [72.6, 19.5],
            [74.2, 19.2],
            [74.0, 18.2],
            [72.7, 18.4],
            [72.6, 19.5],
          ],
        ],
      },
    },
  ],
};

// 3. Surface Temperature & Urban Heat Island Zones
export const HEAT_ANOMALY_ZONES_GEOJSON: FeatureCollection<Polygon, GeoJsonProperties> = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {
        id: 'heat-thar-rajasthan',
        name: 'Thar Desert Summer Thermal Peak',
        status: 'Extreme Heat (>45°C)',
        anomaly: '+4.2°C above baseline',
        color: '#EA580C',
        description: 'High dry-bulb temperature reducing solar PV inverter efficiency by 12-18%.',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [70.0, 28.5],
            [73.5, 28.2],
            [73.2, 25.0],
            [69.8, 25.2],
            [70.0, 28.5],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        id: 'heat-telangana-rayalaseema',
        name: 'Deccan Interior Heat Corridor',
        status: 'High Heat Wave Exposure',
        anomaly: '+2.8°C above baseline',
        color: '#F59E0B',
        description: 'Extended dry heat spells straining data center chiller condensing temperatures.',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [77.5, 18.5],
            [80.2, 18.2],
            [79.8, 15.0],
            [77.2, 15.2],
            [77.5, 18.5],
          ],
        ],
      },
    },
  ],
};

// 4. NDMA Flood Susceptibility & Coastal Surge Corridors
export const FLOOD_HAZARD_ZONES_GEOJSON: FeatureCollection<Polygon, GeoJsonProperties> = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {
        id: 'flood-mumbai-thane-creek',
        name: 'Thane Creek & Konkan Lowland Basin',
        status: 'High Surge / Flash Flood Tier',
        color: '#0284C7', // Sky Blue
        description: 'High-tide storm surge and monsoon flash-flood vulnerability for coastal data parks.',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [72.7, 19.4],
            [73.3, 19.4],
            [73.2, 18.8],
            [72.7, 18.8],
            [72.7, 19.4],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        id: 'flood-odisha-coastal',
        name: 'Mahanadi Delta & Coastal Odisha Surge Corridor',
        status: 'Bay of Bengal Cyclone Inundation',
        color: '#0369A1',
        description: 'Category 4/5 cyclone landfall corridor with saline intrusion risk.',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [85.5, 20.8],
            [87.2, 21.2],
            [86.8, 19.5],
            [85.0, 19.8],
            [85.5, 20.8],
          ],
        ],
      },
    },
  ],
};

// 5. Protected Forests & Western Ghats Eco-Sensitive Zones (ESZ)
export const PROTECTED_AREAS_GEOJSON: FeatureCollection<Polygon, GeoJsonProperties> = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {
        id: 'prot-western-ghats',
        name: 'Western Ghats UNESCO Biosphere Reserve',
        status: 'Strict Eco-Sensitive Zone (ESZ 1)',
        color: '#10B981', // Emerald
        description: 'Statutory 10km buffer constraint for heavy power lines and thermal emissions.',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [73.5, 19.2],
            [74.2, 19.0],
            [75.5, 14.5],
            [77.0, 10.0],
            [76.2, 9.8],
            [74.5, 14.2],
            [73.5, 19.2],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        id: 'prot-sundarbans',
        name: 'Sundarbans Mangrove Tiger Reserve',
        status: 'Ramsar Wetland & Critical Wildlife Habitat',
        color: '#059669',
        description: 'Tidal mangrove barrier with zero industrial effluent allowance.',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [88.2, 22.4],
            [89.2, 22.3],
            [89.1, 21.6],
            [88.3, 21.7],
            [88.2, 22.4],
          ],
        ],
      },
    },
  ],
};

// 6. National 765kV / 400kV High-Voltage Transmission Grid Corridors
export const TRANSMISSION_GRID_GEOJSON: FeatureCollection<LineString, GeoJsonProperties> = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {
        id: 'line-singrauli-delhi',
        name: 'Singrauli Thermal to Delhi-NCR 765kV HVDC Highway',
        voltage: '765 kV AC / 800 kV DC',
        operator: 'PGCIL Northern Corridor',
        color: '#EAB308', // Gold
      },
      geometry: {
        type: 'LineString',
        coordinates: [
          [82.6844, 24.1033], // Singrauli Super Thermal
          [81.5647, 24.4754], // Rewa Hub
          [79.8500, 26.4500], // Kanpur Grid
          [77.3629, 28.6258], // Noida Sector 62
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        id: 'line-korba-champa-western',
        name: 'Korba - Champa - Raigarh 765kV Western Evacuation Link',
        voltage: '765 kV',
        operator: 'PGCIL Western Grid',
        color: '#EAB308',
      },
      geometry: {
        type: 'LineString',
        coordinates: [
          [82.6806, 22.3595], // Korba Thermal
          [82.6517, 22.0463], // Champa Hub
          [83.3956, 21.8974], // Raigarh HVDC Terminal
          [79.0882, 21.1458], // Nagpur Grid
          [73.0169, 19.1075], // Navi Mumbai DC Cluster
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        id: 'line-bhadla-western-green',
        name: 'Bhadla Solar Green Energy Corridor (Rajasthan -> Gujarat)',
        voltage: '765 kV Green Energy Corridor',
        operator: 'PGCIL Renewable Highway',
        color: '#22C55E', // Green Link
      },
      geometry: {
        type: 'LineString',
        coordinates: [
          [71.9167, 27.5333], // Bhadla Solar Park
          [70.9167, 26.9157], // Jaisalmer Wind Hub
          [69.7562, 23.8549], // Khavda Megapark
          [72.1944, 22.2472], // Dholera Industrial
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        id: 'line-southern-grid-link',
        name: 'Pavagada - Bengaluru - Siruseri 400kV Southern Corridor',
        voltage: '400 kV Synchronous Ring',
        operator: 'SRLDC Interconnect',
        color: '#EAB308',
      },
      geometry: {
        type: 'LineString',
        coordinates: [
          [77.2797, 14.2818], // Pavagada Solar
          [77.7499, 12.9698], // Whitefield Hub
          [79.1500, 12.9200], // Vellore Substation
          [80.2185, 12.8258], // Siruseri DC Landing
        ],
      },
    },
  ],
};
