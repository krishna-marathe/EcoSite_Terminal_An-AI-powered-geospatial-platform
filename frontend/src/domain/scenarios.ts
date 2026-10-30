/**
 * EcoSite India — Deterministic Energy & Water Scenario Engine
 *
 * Implements physics-informed data center resource scenario projections
 * based on OpenDC-LCA and Bureau of Indian Standards (BIS IS 15797:2008 / NBC 2016).
 *
 * Epistemic Rules:
 * 1. Outputs are strictly labelled SCENARIO_CALCULATIONS for pre-engineering planning.
 * 2. They must NEVER be presented as measured utility baseline observations or sanctioned water allocations.
 * 3. All formulas, units, sensitivities, and parameter assumptions are visibly exposed.
 */

export type CoolingArchitecture =
  | 'AIR_COOLED_DRY'
  | 'EVAPORATIVE_HYBRID'
  | 'LIQUID_DLC'
  | 'IMMERSION_COOLING';

export interface ScenarioParams {
  it_capacity_mw: number;
  capacity_factor?: number; // 0.5 to 1.0 (default 0.80)
  cooling_architecture: CoolingArchitecture;
  custom_pue?: number;
  parcel_area_ha?: number;
  annual_rainfall_mm?: number; // default 950 mm (typical Maharashtra/Karnataka industrial average)
}

export interface ScenarioResult {
  annual_it_energy_mwh: number;
  effective_pue: number;
  annual_facility_energy_mwh: number;
  annual_overhead_energy_mwh: number;
  wue_liters_per_kwh: number;
  annual_water_consumption_m3: number;
  daily_average_water_kld: number;
  peak_summer_water_kld: number;
  rainwater_harvest_potential_kld: number;
  rainwater_offset_percentage: number;
  sensitivity: {
    pue_min: number;
    pue_max: number;
    facility_energy_min_mwh: number;
    facility_energy_max_mwh: number;
    daily_water_min_kld: number;
    daily_water_max_kld: number;
  };
  formulas: {
    it_energy: string;
    facility_energy: string;
    water_consumption: string;
    rwh_potential: string;
  };
  assumptions: string[];
}

export const COOLING_PROFILES: Record<
  CoolingArchitecture,
  { label: string; defaultPue: number; defaultWue: number; description: string }
> = {
  AIR_COOLED_DRY: {
    label: 'Air-Cooled with Economizers',
    defaultPue: 1.42,
    defaultWue: 0.05,
    description: 'Chilled water air-handling with dry coolers. Eliminates evaporative water loss at the expense of higher warm-weather compressor energy.',
  },
  EVAPORATIVE_HYBRID: {
    label: 'Evaporative Hybrid Cooling Towers',
    defaultPue: 1.28,
    defaultWue: 1.20,
    description: 'Central wet cooling towers with plate heat exchangers. High thermal efficiency and lower PUE, but requires substantial continuous make-up water.',
  },
  LIQUID_DLC: {
    label: 'Direct-to-Chip Liquid Cooling (DLC)',
    defaultPue: 1.18,
    defaultWue: 0.25,
    description: 'Closed-loop warm-water cooling to server cold plates with dry-cooler heat rejection. Substantially reduces cooling overhead and water loss.',
  },
  IMMERSION_COOLING: {
    label: 'Immersion Liquid Cooling',
    defaultPue: 1.09,
    defaultWue: 0.02,
    description: 'Direct dielectric fluid immersion. Ultra-low mechanical overhead and virtually zero evaporative water consumption.',
  },
};

export function calculateEnergyWaterScenario(params: ScenarioParams): ScenarioResult {
  const itMw = Math.max(0.1, params.it_capacity_mw);
  const cf = Math.max(0.2, Math.min(1.0, params.capacity_factor ?? 0.80));
  const profile = COOLING_PROFILES[params.cooling_architecture] || COOLING_PROFILES.EVAPORATIVE_HYBRID;

  const effectivePue = params.custom_pue !== undefined && params.custom_pue >= 1.0
    ? params.custom_pue
    : profile.defaultPue;
  const wue = profile.defaultWue;

  // 1. Energy Calculation (OpenDC-LCA formulation)
  // E_IT = P_IT * CF * 8760 h
  const annualItEnergyMwh = itMw * cf * 8760;
  // E_facility = E_IT * PUE
  const annualFacilityEnergyMwh = annualItEnergyMwh * effectivePue;
  const annualOverheadEnergyMwh = annualFacilityEnergyMwh - annualItEnergyMwh;

  // 2. Water Calculation
  // W_annual (m3) = (E_IT in MWh * 1000 kWh/MWh * WUE in L/kWh) / 1000 L/m3 = E_IT * WUE
  const annualWaterM3 = annualItEnergyMwh * wue;
  const dailyAverageWaterKld = annualWaterM3 / 365;
  // Peak summer surge multiplier: 1.45x for ambient wet-bulb extremes
  const peakSummerWaterKld = dailyAverageWaterKld * 1.45;

  // 3. Rainwater Harvesting Potential (Rational Method: Q = P * A * C)
  // A = parcel_area_ha * 10,000 m2/ha * 0.40 (40% building roof + hardscape catchment)
  const parcelHa = params.parcel_area_ha ?? 15.0;
  const catchmentAreaM2 = parcelHa * 10000 * 0.40;
  const rainfallMm = params.annual_rainfall_mm ?? 950;
  const runoffCoeff = 0.85; // Concrete roofs / paved hardscape (IS 15797)
  const annualRwhLitres = rainfallMm * catchmentAreaM2 * runoffCoeff;
  const annualRwhM3 = annualRwhLitres / 1000;
  const rainwaterHarvestKld = annualRwhM3 / 365;

  const rainwaterOffsetPercentage = annualWaterM3 > 0
    ? Math.min(100.0, (annualRwhM3 / annualWaterM3) * 100)
    : 100.0;

  // 4. Sensitivity Range
  const pueMin = Math.max(1.02, effectivePue - 0.05);
  const pueMax = effectivePue + 0.08;
  const facilityEnergyMinMwh = annualItEnergyMwh * pueMin;
  const facilityEnergyMaxMwh = annualItEnergyMwh * pueMax;
  const dailyWaterMinKld = dailyAverageWaterKld * 0.85;
  const dailyWaterMaxKld = peakSummerWaterKld * 1.15;

  return {
    annual_it_energy_mwh: Math.round(annualItEnergyMwh),
    effective_pue: Number(effectivePue.toFixed(2)),
    annual_facility_energy_mwh: Math.round(annualFacilityEnergyMwh),
    annual_overhead_energy_mwh: Math.round(annualOverheadEnergyMwh),
    wue_liters_per_kwh: wue,
    annual_water_consumption_m3: Math.round(annualWaterM3),
    daily_average_water_kld: Math.round(dailyAverageWaterKld),
    peak_summer_water_kld: Math.round(peakSummerWaterKld),
    rainwater_harvest_potential_kld: Math.round(rainwaterHarvestKld),
    rainwater_offset_percentage: Number(rainwaterOffsetPercentage.toFixed(1)),
    sensitivity: {
      pue_min: Number(pueMin.toFixed(2)),
      pue_max: Number(pueMax.toFixed(2)),
      facility_energy_min_mwh: Math.round(facilityEnergyMinMwh),
      facility_energy_max_mwh: Math.round(facilityEnergyMaxMwh),
      daily_water_min_kld: Math.round(dailyWaterMinKld),
      daily_water_max_kld: Math.round(dailyWaterMaxKld),
    },
    formulas: {
      it_energy: 'E_IT [MWh] = P_IT [MW] × Capacity Factor × 8,760 hours',
      facility_energy: 'E_facility [MWh] = E_IT × PUE',
      water_consumption: 'Water [m³/yr] = E_IT [MWh] × 1,000 [kWh/MWh] × WUE [L/kWh] ÷ 1,000 [L/m³]',
      rwh_potential: 'Q [L/yr] = Rainfall [mm] × Catchment [m²] × Runoff Coeff (0.85)',
    },
    assumptions: [
      `Capacity Factor modeled at ${(cf * 100).toFixed(0)}% steady-state operation.`,
      `Cooling architecture modeled as "${profile.label}" with baseline WUE ${wue.toFixed(2)} L/kWh.`,
      `Peak summer water reflects 1.45× ambient wet-bulb surge multiplier.`,
      `On-site rainwater harvesting assumes 40% campus parcel footprint (${(catchmentAreaM2 / 10000).toFixed(1)} ha) with 0.85 runoff coefficient (BIS IS 15797).`,
      'All calculations are hypothetical exploratory scenarios; not binding legal water sanctions or utility interconnection commitments.',
    ],
  };
}

