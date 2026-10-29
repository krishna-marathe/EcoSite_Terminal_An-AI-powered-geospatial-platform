/**
 * EcoSite India — Phase Resource Readiness, Comparison & Passport DTOs
 * Aligns with backend schemas in commitments.py and comparison.py.
 */

export type ReadinessStatus = 'MET' | 'PARTIAL' | 'UNCOMMITTED' | 'UNKNOWN' | 'INSUFFICIENT_DATA';

export interface PhaseReadinessFinding {
  code: string;
  domain: 'POWER' | 'WATER' | 'CROSS_CUTTING';
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  message: string;
}

export interface PhasePowerReadiness {
  phase_sequence: number;
  demand_mw: number | null;
  incremental_demand_mw: number | null;
  verified_capacity_mw: number;
  documented_capacity_mw: number;
  qualifying_firm_capacity_mw: number;
  proposed_capacity_mw: number;
  unverified_capacity_mw: number;
  power_gap_mw: number | null;
  power_surplus_mw: number;
  status: ReadinessStatus;
  qualifying_commitments_count: number;
  total_commitments_count: number;
}

export interface PhaseWaterReadiness {
  phase_sequence: number;
  peak_summer_demand_kld: number | null;
  average_demand_kld: number | null;
  verified_allocated_kld: number;
  documented_allocated_kld: number;
  qualifying_firm_allocated_kld: number;
  proposed_kld: number;
  unverified_kld: number;
  water_gap_kld: number | null;
  water_surplus_kld: number;
  status: ReadinessStatus;
  qualifying_commitments_count: number;
  total_commitments_count: number;
}

export interface PhaseReadinessSummary {
  phase_id: string;
  phase_sequence: number;
  phase_name: string;
  commissioning_date: string;
  cooling_type: string;
  design_pue: number;
  power: PhasePowerReadiness;
  water: PhaseWaterReadiness;
  findings: PhaseReadinessFinding[];
}

export interface CampusReadinessSummary {
  total_phases: number;
  total_cumulative_it_mw: number | null;
  total_cumulative_facility_peak_mw: number | null;
  total_qualifying_firm_power_mw: number;
  overall_power_gap_mw: number | null;
  overall_power_status: ReadinessStatus;
  total_peak_summer_water_kld: number | null;
  total_qualifying_firm_water_kld: number;
  overall_water_gap_kld: number | null;
  overall_water_status: ReadinessStatus;
  critical_findings_count: number;
  warning_findings_count: number;
}

export interface ProjectReadinessReport {
  project_id: string;
  project_name: string;
  evaluated_at: string;
  campus_summary: CampusReadinessSummary;
  phases: PhaseReadinessSummary[];
  all_findings: PhaseReadinessFinding[];
}

// ----------------- Three-Site Comparison -----------------

export type DimensionStatus = 'READY' | 'ATTENTION_REQUIRED' | 'HIGH_RISK' | 'UNKNOWN' | 'NOT_APPLICABLE';

export interface SiteComparisonDimension {
  title: string;
  metrics: Record<string, unknown>;
  status: DimensionStatus;
  notes: string[];
}

export interface CandidateSiteComparisonItem {
  site_id: string;
  site_name: string;
  area_ha: number;
  state_code: string;
  district: string | null;
  boundary_screening_status: string;
  resource_readiness: SiteComparisonDimension;
  environmental_exposure: SiteComparisonDimension;
  regulatory_readiness: SiteComparisonDimension;
  evidence_completeness: SiteComparisonDimension;
}

export interface SiteComparisonResponse {
  project_id: string;
  project_name: string;
  evaluated_at: string;
  sites: CandidateSiteComparisonItem[];
  epistemic_disclaimer: string;
}

// ----------------- Site Readiness Passport -----------------

export interface SitePassportSection {
  section_id: string;
  title: string;
  status: string;
  data: Record<string, unknown>;
  findings: PhaseReadinessFinding[];
}

export interface StatutoryChecklistItem {
  name: string;
  mandate: string;
  status: 'VERIFIED' | 'ATTENTION_REQUIRED' | 'EVIDENCE_REQUIRED' | string;
}

export interface SiteReadinessPassport {
  passport_id: string;
  generated_at: string;
  project_id: string;
  project_name: string;
  archetype: string;
  site_id: string;
  site_name: string;
  state_code: string;
  district: string | null;
  parcel_area_ha: number;
  boundary_source: string;
  boundary_screening_status: string;
  sections: SitePassportSection[];
  statutory_checklist: StatutoryChecklistItem[];
  epistemic_disclaimer: string;
}

