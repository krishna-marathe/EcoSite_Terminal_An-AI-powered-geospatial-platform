import type { DataStatus, InfrastructureType, RiskLevel } from '../types';

/**
 * Single source of truth for chart and map palettes.
 * Class-based UI must use the `eco-*` Tailwind tokens from index.css instead;
 * SVG/chart/MapLibre paint values cannot resolve Tailwind classes, so they live here.
 */
export const eco = {
  bg: '#0b0d0c',
  surface: '#111514',
  surfaceSecondary: '#171c19',
  border: '#29362f',
  primary: '#39f58b',
  secondary: '#71e6a0',
  warning: '#ffad24',
  critical: '#ff5d68',
  text: '#e7f1e8',
  muted: '#85998d',
} as const;

export const chartColors = {
  primary: eco.primary,
  muted: eco.muted,
  warning: eco.warning,
  critical: eco.critical,
  grid: eco.border,
  text: eco.text,
} as const;

/** Categorical facility-type colors shared by the map markers and every legend. */
export const FACILITY_TYPE_COLORS: Record<InfrastructureType, string> = {
  data_centre: '#39f58b',
  thermal_power: '#ff5d68',
  hydro_power: '#56b8f0',
  solar_farm: '#ffad24',
  wind_farm: '#9d8df1',
  substation: '#b8c4bb',
  industrial: '#e0b27a',
};

export const FACILITY_TYPE_LABELS: Record<InfrastructureType, string> = {
  data_centre: 'Data centre',
  thermal_power: 'Thermal power',
  hydro_power: 'Hydro power',
  solar_farm: 'Solar farm',
  wind_farm: 'Wind farm',
  substation: 'Substation',
  industrial: 'Industrial',
};

export const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  low: 'Low',
  moderate: 'Moderate',
  high: 'High',
  critical: 'Critical',
};

/** Risk ladder: low → primary, moderate → warning, high/critical → critical. */
export const riskColor = (level: RiskLevel): string => {
  if (level === 'low') return eco.primary;
  if (level === 'moderate') return eco.warning;
  return eco.critical;
};

/** Score ladder for bars/numbers (0–100). Unknown scores render muted, never 0. */
export const scoreColor = (score: number | null): string => {
  if (score === null || score === undefined || Number.isNaN(score)) return eco.muted;
  if (score >= 70) return eco.critical;
  if (score >= 45) return eco.warning;
  return eco.primary;
};

export const DATA_STATUS_LABELS: Record<DataStatus, string> = {
  observed: 'Observed',
  estimated: 'Estimated',
  synthetic: 'Synthetic demo',
  unavailable: 'Unavailable',
};
