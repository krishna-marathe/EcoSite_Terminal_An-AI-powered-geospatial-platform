import type { Facility, InfrastructureType, RiskIndicatorScore, RiskLevel } from '../types';

export interface SectorWeights {
  waterStress: number;
  gridPressure: number;
  airPollution: number;
  heatExposure: number;
  floodHazard: number;
  populationProximity: number;
  landSensitivity: number;
  biodiversityConstraint: number;
}

// Transparent default sector-specific risk weighting profiles
export const DEFAULT_SECTOR_WEIGHTS: Record<InfrastructureType, SectorWeights> = {
  data_centre: {
    waterStress: 0.22,
    gridPressure: 0.25,
    airPollution: 0.08,
    heatExposure: 0.18,
    floodHazard: 0.12,
    populationProximity: 0.05,
    landSensitivity: 0.05,
    biodiversityConstraint: 0.05,
  },
  thermal_power: {
    waterStress: 0.18,
    gridPressure: 0.06,
    airPollution: 0.28,
    heatExposure: 0.08,
    floodHazard: 0.06,
    populationProximity: 0.14,
    landSensitivity: 0.10,
    biodiversityConstraint: 0.10,
  },
  hydro_power: {
    waterStress: 0.10,
    gridPressure: 0.05,
    airPollution: 0.02,
    heatExposure: 0.03,
    floodHazard: 0.28,
    populationProximity: 0.12,
    landSensitivity: 0.20,
    biodiversityConstraint: 0.20,
  },
  solar_farm: {
    waterStress: 0.20, // Cleaning water in arid areas
    gridPressure: 0.10,
    airPollution: 0.02,
    heatExposure: 0.15,
    floodHazard: 0.08,
    populationProximity: 0.05,
    landSensitivity: 0.20,
    biodiversityConstraint: 0.20,
  },
  wind_farm: {
    waterStress: 0.02,
    gridPressure: 0.12,
    airPollution: 0.01,
    heatExposure: 0.05,
    floodHazard: 0.05,
    populationProximity: 0.15, // Acoustic shadow
    landSensitivity: 0.25,
    biodiversityConstraint: 0.35, // Avian flight corridors
  },
  substation: {
    waterStress: 0.05,
    gridPressure: 0.35,
    airPollution: 0.05,
    heatExposure: 0.20,
    floodHazard: 0.15,
    populationProximity: 0.10,
    landSensitivity: 0.05,
    biodiversityConstraint: 0.05,
  },
  industrial: {
    waterStress: 0.22,
    gridPressure: 0.18,
    airPollution: 0.20,
    heatExposure: 0.10,
    floodHazard: 0.10,
    populationProximity: 0.10,
    landSensitivity: 0.05,
    biodiversityConstraint: 0.05,
  },
};

export const getRiskLevel = (score: number): RiskLevel => {
  if (score >= 80) return 'critical';
  if (score >= 65) return 'high';
  if (score >= 45) return 'moderate';
  return 'low';
};

export const calculateWeightedRiskScore = (
  indicators: Facility['indicators'],
  weights: SectorWeights
): number => {
  const sumWeights = Object.values(weights).reduce((a, b) => a + b, 0);
  const normalizedWeights: Record<keyof SectorWeights, number> = {} as Record<keyof SectorWeights, number>;

  for (const k of Object.keys(weights) as (keyof SectorWeights)[]) {
    normalizedWeights[k] = sumWeights > 0 ? weights[k] / sumWeights : 1 / 8;
  }

  const score =
    indicators.waterStress * normalizedWeights.waterStress +
    indicators.gridPressure * normalizedWeights.gridPressure +
    indicators.airPollution * normalizedWeights.airPollution +
    indicators.heatExposure * normalizedWeights.heatExposure +
    indicators.floodHazard * normalizedWeights.floodHazard +
    indicators.populationProximity * normalizedWeights.populationProximity +
    indicators.landSensitivity * normalizedWeights.landSensitivity +
    indicators.biodiversityConstraint * normalizedWeights.biodiversityConstraint;

  return Math.round(score);
};

export const getExplainableIndicators = (
  facility: Facility,
  customWeights?: SectorWeights
): RiskIndicatorScore[] => {
  const weights = customWeights || DEFAULT_SECTOR_WEIGHTS[facility.type] || DEFAULT_SECTOR_WEIGHTS.data_centre;

  return [
    {
      name: 'Water Stress & Depletion',
      key: 'waterStress',
      category: 'water',
      score: facility.indicators.waterStress,
      weight: weights.waterStress,
      status: getRiskLevel(facility.indicators.waterStress),
      valueDescription: `Stage of Extraction: ${facility.indicators.waterStress}% (CGWB classification)`,
      provenance: {
        sourceOrganization: 'Central Ground Water Board (CGWB)',
        publicationDate: '2024-03-01',
        lastUpdated: '2024-10-15',
        geographicResolution: 'Assessment Unit / Tehsil',
        dataStatus: 'observed',
        confidenceScore: 92,
      },
      explanation:
        facility.type === 'data_centre'
          ? 'Data hall evaporative chiller loops require continuous high-purity water. Over-exploited aquifers elevate regulatory shutdown risk.'
          : facility.type === 'thermal_power'
          ? 'Thermal cooling circuits withdraw significant freshwater volumes; dry season reservoir depletion poses curtailment risks.'
          : 'Reflects groundwater overdraft and surface water competition within the watershed basin.',
      mitigationPrompt: 'Evaluate transition to adiabatic closed-loop cooling or municipal recycled wastewater supply.',
    },
    {
      name: 'Energy & Grid Pressure',
      key: 'gridPressure',
      category: 'energy',
      score: facility.indicators.gridPressure,
      weight: weights.gridPressure,
      status: getRiskLevel(facility.indicators.gridPressure),
      valueDescription: `Transmission Substation Loading: ${facility.indicators.gridPressure}% Peak Capacity`,
      provenance: {
        sourceOrganization: 'PowerGrid / Regional Load Despatch Centre',
        publicationDate: '2024-04-10',
        lastUpdated: '2024-09-25',
        geographicResolution: '400kV Substation Node',
        dataStatus: 'observed',
        confidenceScore: 94,
      },
      explanation:
        'Measures local substation N-1 contingency headroom, transmission line thermal loading, and feeder saturation during peak hours.',
      mitigationPrompt: 'Negotiate dedicated dual-feed HT line and integrate on-site Battery Energy Storage System (BESS).',
    },
    {
      name: 'Air Pollution & Emissions',
      key: 'airPollution',
      category: 'air',
      score: facility.indicators.airPollution,
      weight: weights.airPollution,
      status: getRiskLevel(facility.indicators.airPollution),
      valueDescription: `Annual PM2.5 Exposure: ${facility.indicators.airPollution} µg/m³ (NAAQS Benchmark: 40 µg/m³)`,
      provenance: {
        sourceOrganization: 'Central Pollution Control Board (CPCB)',
        publicationDate: '2024-02-15',
        lastUpdated: '2024-10-01',
        geographicResolution: '10km Spatial Grid',
        dataStatus: 'observed',
        confidenceScore: 89,
      },
      explanation:
        facility.type === 'thermal_power'
          ? 'Primary SO₂, NOₓ, and fly ash stack emissions exacerbate regional non-attainment airshed compliance burdens.'
          : 'High ambient particulate load fouls air filtration systems and increases HVAC maintenance cycles.',
      mitigationPrompt: 'Deploy continuous particulate monitoring and upgraded MERV 14 / HEPA intake filtration.',
    },
    {
      name: 'Surface Heat Exposure',
      key: 'heatExposure',
      category: 'heat',
      score: facility.indicators.heatExposure,
      weight: weights.heatExposure,
      status: getRiskLevel(facility.indicators.heatExposure),
      valueDescription: `Summer Land Surface Temp Anomaly: +${(facility.indicators.heatExposure * 0.08).toFixed(1)}°C`,
      provenance: {
        sourceOrganization: 'ISRO Bhuvan / NASA MODIS LST',
        publicationDate: '2024-05-20',
        lastUpdated: '2024-08-15',
        geographicResolution: '1km Thermal Satellite Grid',
        dataStatus: 'estimated',
        confidenceScore: 86,
      },
      explanation:
        'Elevated ambient temperatures degrade mechanical chiller efficiency, increase Power Usage Effectiveness (PUE), and cause PV panel thermal derating.',
      mitigationPrompt: 'Implement high-albedo cool roofs and microclimate green buffers around transformer yards.',
    },
    {
      name: 'Flood & Inundation Hazard',
      key: 'floodHazard',
      category: 'flood',
      score: facility.indicators.floodHazard,
      weight: weights.floodHazard,
      status: getRiskLevel(facility.indicators.floodHazard),
      valueDescription: `Flood Return Period Hazard Index: ${facility.indicators.floodHazard}/100`,
      provenance: {
        sourceOrganization: 'National Disaster Management Authority (NDMA)',
        publicationDate: '2023-09-12',
        lastUpdated: '2024-06-18',
        geographicResolution: 'Riverine & Coastal Hazard Contours',
        dataStatus: 'estimated',
        confidenceScore: 88,
      },
      explanation:
        'Evaluates proximity to 1-in-100 year flood plains, coastal cyclone storm surge zones, and urban drainage bottlenecks.',
      mitigationPrompt: 'Raise critical electrical switchgear above 100-year high flood level (HFL) + 1.5m freeboard.',
    },
    {
      name: 'Population Proximity Exposure',
      key: 'populationProximity',
      category: 'population',
      score: facility.indicators.populationProximity,
      weight: weights.populationProximity,
      status: getRiskLevel(facility.indicators.populationProximity),
      valueDescription: `${facility.nearbyPopulation.radius5km.toLocaleString()} persons within 5km perimeter`,
      provenance: {
        sourceOrganization: 'Census of India & WorldPop 100m Model',
        publicationDate: '2023-06-30',
        lastUpdated: '2024-03-20',
        geographicResolution: '100m Spatial Population Grid',
        dataStatus: 'observed',
        confidenceScore: 95,
      },
      explanation:
        'Dense adjacent populations increase public health exposure to industrial emissions, backup diesel generator fumes, and acoustic disturbances.',
      mitigationPrompt: 'Install acoustic attenuation enclosures and hospital-grade D.G. exhaust scrubbers.',
    },
    {
      name: 'Land-Use Sensitivity',
      key: 'landSensitivity',
      category: 'land',
      score: facility.indicators.landSensitivity,
      weight: weights.landSensitivity,
      status: getRiskLevel(facility.indicators.landSensitivity),
      valueDescription: `NRSC Land Thematic Sensitivity: ${facility.indicators.landSensitivity}/100`,
      provenance: {
        sourceOrganization: 'National Remote Sensing Centre (NRSC) LULC',
        publicationDate: '2023-11-05',
        lastUpdated: '2024-04-12',
        geographicResolution: '30m Satellite Classification',
        dataStatus: 'observed',
        confidenceScore: 91,
      },
      explanation:
        'Identifies prime agricultural land diversion, wetland encroachment, or high-slope instability within site boundaries.',
      mitigationPrompt: 'Conduct topsoil preservation and stormwater percolation pond integration.',
    },
    {
      name: 'Biodiversity Constraints',
      key: 'biodiversityConstraint',
      category: 'biodiversity',
      score: facility.indicators.biodiversityConstraint,
      weight: weights.biodiversityConstraint,
      status: getRiskLevel(facility.indicators.biodiversityConstraint),
      valueDescription: `Ecological Sensitivity Index: ${facility.indicators.biodiversityConstraint}/100`,
      provenance: {
        sourceOrganization: 'Wildlife Institute of India (WII) & MoEFCC',
        publicationDate: '2024-01-18',
        lastUpdated: '2024-07-22',
        geographicResolution: 'Gazetted ESZ Vector Boundaries',
        dataStatus: 'observed',
        confidenceScore: 96,
      },
      explanation:
        'Evaluates statutory Eco-Sensitive Zone (ESZ) 10km buffers, migratory bird flyways, and tiger/elephant wildlife corridors.',
      mitigationPrompt: 'Verify statutory National Board for Wildlife (NBWL) clearance and install bird flight diverters.',
    },
  ];
};
