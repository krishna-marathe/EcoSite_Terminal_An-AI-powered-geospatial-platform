import type { WorldMonitorLayerKey } from '../../types';

export interface WorldMonitorLayerDef {
  key: WorldMonitorLayerKey;
  label: string;
  shortLabel: string;
  iconName: string;
  color: string;
  count: number;
  unit: string;
  description: string;
  source: string;
}

export const WM_LAYER_CATALOG: WorldMonitorLayerDef[] = [
  {
    key: 'hotspots',
    label: 'Critical Hotspots',
    shortLabel: 'Hotspots',
    iconName: 'Flame',
    color: '#EF4444', // Red
    count: 7,
    unit: 'Clusters >75 Risk',
    description: 'High-risk cumulative industrial stress zones requiring urgent statutory intervention.',
    source: 'EcoSite Terminal Risk Engine',
  },
  {
    key: 'conflicts',
    label: 'Aquifer Depletion Zones',
    shortLabel: 'Aquifers',
    iconName: 'Droplets',
    color: '#38BDF8', // Sky blue
    count: 14,
    unit: 'Over-Exploited Blocks',
    description: 'CGWB designated over-exploited and critical groundwater blocks with withdrawal curbs.',
    source: 'Central Ground Water Board (CGWB)',
  },
  {
    key: 'bases',
    label: 'Data Centres & Cloud Nodes',
    shortLabel: 'Data Centres',
    iconName: 'Server',
    color: '#0EA5E9', // Deep Sky
    count: 5,
    unit: '560 MW IT Load',
    description: 'Hyperscale digital infrastructure clusters and internet subsea cable landing stations.',
    source: 'National Data Centre Policy',
  },
  {
    key: 'nuclear',
    label: 'Thermal & Super Thermal Units',
    shortLabel: 'Thermal Power',
    iconName: 'Zap',
    color: '#F43F5E', // Rose
    count: 3,
    unit: '4,000 MW Installed',
    description: 'Coal and gas fired thermal generation complexes with stack emissions and cooling loops.',
    source: 'Central Electricity Authority (CEA)',
  },
  {
    key: 'military',
    label: '765/400kV HVDC Substations',
    shortLabel: 'Grid Hubs',
    iconName: 'Radio',
    color: '#F59E0B', // Amber
    count: 2,
    unit: '9,000 MW Transmission',
    description: 'National transmission backbone switching yards and high-voltage DC converter hubs.',
    source: 'PowerGrid / NLDC',
  },
  {
    key: 'weather',
    label: 'Ambient Air Quality (PM2.5)',
    shortLabel: 'Air Quality',
    iconName: 'Wind',
    color: '#FB923C', // Orange
    count: 18,
    unit: 'CAAQMS Stations',
    description: 'Continuous ambient air quality monitoring stations and satellite PM2.5 smoke plumes.',
    source: 'Central Pollution Control Board (CPCB)',
  },
  {
    key: 'canadaAlerts',
    label: 'Extreme Heat & Thermal LST',
    shortLabel: 'Heat Anomaly',
    iconName: 'Sun',
    color: '#DC2626', // Crimson
    count: 9,
    unit: 'Thermal Anomaly Areas',
    description: 'MODIS & Sentinel-3 Land Surface Temperature anomalies exceeding 42°C threshold.',
    source: 'ISRO Bhuvan / NASA MODIS',
  },
  {
    key: 'outages',
    label: 'Substation Load & Margin',
    shortLabel: 'Grid Pressure',
    iconName: 'Activity',
    color: '#EAB308', // Yellow
    count: 6,
    unit: '>80% Substation Load',
    description: 'Regional transmission substations operating near peak thermal contingency limits.',
    source: 'Regional Load Despatch Centres',
  },
  {
    key: 'natural',
    label: 'Flood & Inundation Hazard',
    shortLabel: 'Flood Zones',
    iconName: 'Waves',
    color: '#0284C7', // Ocean Blue
    count: 11,
    unit: '100-Year Flood Contours',
    description: 'Riverine flood plains, high tidal ingress zones, and coastal storm surge buffers.',
    source: 'National Disaster Management Authority (NDMA)',
  },
  {
    key: 'waterways',
    label: 'Surface Water & Reservoirs',
    shortLabel: 'Waterways',
    iconName: 'ShieldAlert',
    color: '#06B6D4', // Cyan
    count: 2,
    unit: 'Dam Basins Monitored',
    description: 'Major hydrological reservoir storage levels and downstream river discharge accounts.',
    source: 'Central Water Commission (CWC)',
  },
  {
    key: 'economic',
    label: 'Solar & Wind Megaparks',
    shortLabel: 'Renewables',
    iconName: 'Compass',
    color: '#22C55E', // Green
    count: 5,
    unit: '12,700 MW Clean Power',
    description: 'Ultra-mega solar complexes and wind energy corridors with high green yield.',
    source: 'Ministry of New & Renewable Energy (MNRE)',
  },
  {
    key: 'sanctions',
    label: 'Statutory ESZ & Wildlife Buffers',
    shortLabel: 'Eco-Buffers',
    iconName: 'TreePine',
    color: '#A855F7', // Purple
    count: 8,
    unit: '10km Statutory Buffers',
    description: 'Protected areas, national parks, and wildlife corridors requiring statutory NBWL clearances.',
    source: 'Wildlife Institute of India (WII)',
  },
];
