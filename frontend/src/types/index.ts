export type InfrastructureType =
  | 'data_centre'
  | 'thermal_power'
  | 'hydro_power'
  | 'solar_farm'
  | 'wind_farm'
  | 'substation'
  | 'industrial';

export type RiskLevel = 'low' | 'moderate' | 'high' | 'critical';

export type TimeRange = '1h' | '24h' | '7d' | '30d' | 'all';
export type DashboardViewMode = 'split' | 'map_only' | 'grid_only';

export type ScenarioType = 'water_reduction' | 'heatwave' | 'grid_curtailment' | 'flood_event';

export type WorldMonitorLayerKey =
  | 'hotspots'
  | 'conflicts'
  | 'bases'
  | 'nuclear'
  | 'military'
  | 'weather'
  | 'canadaAlerts'
  | 'outages'
  | 'natural'
  | 'waterways'
  | 'economic'
  | 'sanctions';

export interface IntelligenceSignal {
  id: string;
  timestamp: string;
  timeAgo: string;
  severity: 'critical' | 'high' | 'elevated' | 'nominal';
  facilityId: string;
  facilityName: string;
  category: InfrastructureType;
  message: string;
  coordinates: [number, number];
  agency: string;
  metricValue?: string;
}

export type DataStatus = 'observed' | 'estimated' | 'synthetic' | 'unavailable';

export interface DataProvenance {
  sourceOrganization: string;
  sourceUrl?: string;
  publicationDate: string;
  lastUpdated: string;
  geographicResolution: string;
  dataStatus: DataStatus;
  confidenceScore: number; // 0 - 100
}

export interface RiskIndicatorScore {
  name: string;
  key: string;
  score: number; // 0 - 100
  weight: number; // e.g. 0.15
  category: 'water' | 'energy' | 'air' | 'heat' | 'flood' | 'population' | 'land' | 'biodiversity';
  status: RiskLevel;
  valueDescription: string;
  provenance: DataProvenance;
  explanation: string;
  mitigationPrompt: string;
}

export interface Facility {
  id: string;
  name: string;
  type: InfrastructureType;
  state: string;
  district: string;
  coordinates: [number, number]; // [lng, lat]
  capacityMw?: number;
  operator?: string;
  yearCommissioned?: number;
  overallRiskScore: number; // 0 - 100
  riskLevel: RiskLevel;
  indicators: {
    waterStress: number;
    gridPressure: number;
    airPollution: number;
    heatExposure: number;
    floodHazard: number;
    populationProximity: number;
    landSensitivity: number;
    biodiversityConstraint: number;
  };
  keyRiskFactors: string[];
  nearbyPopulation: {
    radius5km: number;
    radius15km: number;
    radius25km: number;
  };
  historicalTrends: {
    year: number;
    riskScore: number;
    waterDemandKld: number;
    powerConsumptionMwh?: number;
  }[];
  provenance: DataProvenance;
}

export interface EnvironmentalLayer {
  id: string;
  name: string;
  category: 'infrastructure' | 'environmental' | 'predictive';
  description: string;
  active: boolean;
  opacity: number;
  color: string;
  unit?: string;
  isAvailable: boolean;
  provenance: DataProvenance;
}

export interface ForecastPoint {
  date: string;
  prediction: number;
  lower_bound: number;
  upper_bound: number;
  historical?: number;
}

export interface ForecastResponse {
  metric: string;
  locationId: string;
  locationName: string;
  unit: string;
  model: string;
  modelVersion: string;
  horizonMonths: number;
  dataStatus: DataStatus;
  forecast: ForecastPoint[];
  methodologyNotes: string;
}

export interface ProposedSite {
  id: string;
  name: string;
  type: InfrastructureType;
  coordinates: [number, number]; // [lng, lat]
  state: string;
  district: string;
  capacityMw: number;
  waterDemandKld: number;
  powerDemandMw: number;
  groundwaterZone: 'Safe' | 'Semi-Critical' | 'Critical' | 'Over-Exploited';
  substationDistanceKm: number;
  protectedAreaDistanceKm: number;
  population5km: number;
  suitabilityScore: number; // 0 - 100
  suitabilityStatus: 'Highly Suitable' | 'Favorable with Mitigation' | 'High Risk / Unfavorable';
  flags: string[];
}

export interface MitigationRecommendation {
  id: string;
  title: string;
  category: 'Water Conservation' | 'Renewable Energy' | 'Energy Efficiency' | 'Waste & Emissions' | 'Ecology & Community';
  facilityType: InfrastructureType | 'all';
  priority: 'High' | 'Medium' | 'Low';
  implementationComplexity: 'Low' | 'Moderate' | 'High';
  timeframe: string;
  responsibleStakeholder: string;
  supportingEvidence: string;
  expectedBenefit: string;
  verificationRequirements: string;
}
