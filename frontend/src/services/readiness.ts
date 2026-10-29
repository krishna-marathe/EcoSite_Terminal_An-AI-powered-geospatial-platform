/**
 * EcoSite India — Readiness, Comparison & Passport Service
 * Genuine FastAPI integration with offline mock fallback.
 */

import axios from 'axios';
import { apiClient } from './api';
import { useDashboardStore } from '../stores/dashboardStore';
import type {
  ProjectReadinessReport,
  SiteComparisonResponse,
  SiteReadinessPassport,
} from '../types/readiness';

// Force flag for testing
let apiModeOverride: boolean | null = null;

export function setReadinessApiMode(enabled: boolean | null): void {
  apiModeOverride = enabled;
}

export function isReadinessApiMode(): boolean {
  if (apiModeOverride !== null) {
    return apiModeOverride;
  }
  try {
    return useDashboardStore.getState().dataMode === 'api';
  } catch {
    return false;
  }
}

export function formatReadinessError(error: unknown): string {
  const isHttpErr = axios.isAxiosError(error) || (error && typeof error === 'object' && 'response' in error);
  if (isHttpErr) {
    const errObj = error as { response?: { status?: number; data?: { detail?: unknown } } };
    const detail = errObj.response?.data?.detail;
    if (detail && typeof detail === 'object' && 'message' in detail && typeof (detail as { message?: unknown }).message === 'string') {
      return (detail as { message: string }).message;
    }
    if (detail && typeof detail === 'string') {
      return detail;
    }
    if (errObj.response?.status === 404) {
      return 'The requested project or site readiness record was not found.';
    }
    if (errObj.response?.status === 422) {
      return 'Invalid request parameters for readiness calculation.';
    }
    if (!errObj.response) {
      return 'Local backend unavailable. Please ensure the EcoSite backend is running.';
    }
  }
  return error instanceof Error ? error.message : 'Readiness service request failed.';
}

// ----------------- Mock Data Generators for Offline/Demo -----------------

export function createMockProjectReadiness(projectId: string): ProjectReadinessReport {
  return {
    project_id: projectId,
    project_name: 'Pune Hyperscale Campus (Demo)',
    evaluated_at: new Date().toISOString(),
    campus_summary: {
      total_phases: 3,
      total_cumulative_it_mw: 80,
      total_cumulative_facility_peak_mw: 104,
      total_qualifying_firm_power_mw: 40,
      overall_power_gap_mw: 64,
      overall_power_status: 'PARTIAL',
      total_peak_summer_water_kld: 2800,
      total_qualifying_firm_water_kld: 1800,
      overall_water_gap_kld: 1000,
      overall_water_status: 'PARTIAL',
      critical_findings_count: 1,
      warning_findings_count: 2,
    },
    phases: [
      {
        phase_id: 'phase-01',
        phase_sequence: 1,
        phase_name: 'Phase 1 - Initial Buildout',
        commissioning_date: '2027-06-01',
        cooling_type: 'Evaporative Hybrid',
        design_pue: 1.3,
        power: {
          phase_sequence: 1,
          demand_mw: 26,
          incremental_demand_mw: 26,
          verified_capacity_mw: 40,
          documented_capacity_mw: 0,
          qualifying_firm_capacity_mw: 26,
          proposed_capacity_mw: 0,
          unverified_capacity_mw: 0,
          power_gap_mw: 0,
          power_surplus_mw: 14,
          status: 'MET',
          qualifying_commitments_count: 1,
          total_commitments_count: 1,
        },
        water: {
          phase_sequence: 1,
          peak_summer_demand_kld: 700,
          average_demand_kld: 400,
          verified_allocated_kld: 1800,
          documented_allocated_kld: 0,
          qualifying_firm_allocated_kld: 700,
          proposed_kld: 0,
          unverified_kld: 0,
          water_gap_kld: 0,
          water_surplus_kld: 1100,
          status: 'MET',
          qualifying_commitments_count: 1,
          total_commitments_count: 1,
        },
        findings: [],
      },
      {
        phase_id: 'phase-02',
        phase_sequence: 2,
        phase_name: 'Phase 2 - Campus Expansion',
        commissioning_date: '2029-06-01',
        cooling_type: 'Evaporative Hybrid',
        design_pue: 1.3,
        power: {
          phase_sequence: 2,
          demand_mw: 65,
          incremental_demand_mw: 39,
          verified_capacity_mw: 40,
          documented_capacity_mw: 0,
          qualifying_firm_capacity_mw: 40,
          proposed_capacity_mw: 25,
          unverified_capacity_mw: 0,
          power_gap_mw: 25,
          power_surplus_mw: 0,
          status: 'PARTIAL',
          qualifying_commitments_count: 1,
          total_commitments_count: 2,
        },
        water: {
          phase_sequence: 2,
          peak_summer_demand_kld: 1600,
          average_demand_kld: 900,
          verified_allocated_kld: 1800,
          documented_allocated_kld: 0,
          qualifying_firm_allocated_kld: 1600,
          proposed_kld: 0,
          unverified_kld: 0,
          water_gap_kld: 0,
          water_surplus_kld: 200,
          status: 'MET',
          qualifying_commitments_count: 1,
          total_commitments_count: 1,
        },
        findings: [
          {
            code: 'POWER_DEFICIT_PHASE_2',
            domain: 'POWER',
            severity: 'WARNING',
            message: 'Phase 2 peak facility demand (65 MW) exceeds verified substation firm delivery (40 MW) by 25 MW.',
          },
        ],
      },
      {
        phase_id: 'phase-03',
        phase_sequence: 3,
        phase_name: 'Phase 3 - Full Buildout',
        commissioning_date: '2032-06-01',
        cooling_type: 'Liquid + Air Hybrid',
        design_pue: 1.15,
        power: {
          phase_sequence: 3,
          demand_mw: 104,
          incremental_demand_mw: 39,
          verified_capacity_mw: 40,
          documented_capacity_mw: 0,
          qualifying_firm_capacity_mw: 40,
          proposed_capacity_mw: 64,
          unverified_capacity_mw: 0,
          power_gap_mw: 64,
          power_surplus_mw: 0,
          status: 'PARTIAL',
          qualifying_commitments_count: 1,
          total_commitments_count: 2,
        },
        water: {
          phase_sequence: 3,
          peak_summer_demand_kld: 2800,
          average_demand_kld: 1400,
          verified_allocated_kld: 1800,
          documented_allocated_kld: 0,
          qualifying_firm_allocated_kld: 1800,
          proposed_kld: 1000,
          unverified_kld: 0,
          water_gap_kld: 1000,
          water_surplus_kld: 0,
          status: 'PARTIAL',
          qualifying_commitments_count: 1,
          total_commitments_count: 2,
        },
        findings: [
          {
            code: 'CRITICAL_POWER_DEFICIT',
            domain: 'POWER',
            severity: 'CRITICAL',
            message: 'Full campus buildout (104 MW) leaves 64 MW unbacked by verified utility sanctions.',
          },
          {
            code: 'SUMMER_WATER_DEFICIT',
            domain: 'WATER',
            severity: 'WARNING',
            message: 'Peak summer cooling demand (2,800 KLD) exceeds verified MIDC water allocation (1,800 KLD) by 1,000 KLD.',
          },
        ],
      },
    ],
    all_findings: [
      {
        code: 'CRITICAL_POWER_DEFICIT',
        domain: 'POWER',
        severity: 'CRITICAL',
        message: 'Full campus buildout (104 MW) leaves 64 MW unbacked by verified utility sanctions.',
      },
      {
        code: 'SUMMER_WATER_DEFICIT',
        domain: 'WATER',
        severity: 'WARNING',
        message: 'Peak summer cooling demand (2,800 KLD) exceeds verified MIDC water allocation (1,800 KLD) by 1,000 KLD.',
      },
    ],
  };
}

export function createMockSiteComparisons(projectId: string): SiteComparisonResponse {
  return {
    project_id: projectId,
    project_name: 'Pune Hyperscale Campus (Demo)',
    evaluated_at: new Date().toISOString(),
    sites: [
      {
        site_id: 'site-daund-01',
        site_name: 'Daund Greenfield Parcel A',
        area_ha: 24.5,
        state_code: 'IN-MH',
        district: 'Pune',
        boundary_screening_status: 'inside_screening_boundary',
        resource_readiness: {
          title: 'Resource Readiness',
          status: 'ATTENTION_REQUIRED',
          metrics: {
            firm_power_mw: 40,
            power_gap_mw: 64,
            power_status: 'PARTIAL',
            firm_water_kld: 1800,
            water_gap_kld: 1000,
            water_status: 'PARTIAL',
          },
          notes: ['Grid delivery sanctioned for Phase 1 (40 MW); campus expansion uncommitted.'],
        },
        environmental_exposure: {
          title: 'Environmental Exposure',
          status: 'READY',
          metrics: {
            boundary_screening: 'inside_screening_boundary',
            boundary_source: 'geoBoundaries gbOpen IND ADM1',
            area_ha: 24.5,
          },
          notes: [],
        },
        regulatory_readiness: {
          title: 'Regulatory Readiness',
          status: 'READY',
          metrics: {
            state_code: 'IN-MH',
            policy_framework: 'Maharashtra Data Centre Policy 2023 (Stamp duty exemption, power tariff subsidy)',
          },
          notes: ['State incentives subject to formal eligibility filing.'],
        },
        evidence_completeness: {
          title: 'Evidence Completeness',
          status: 'READY',
          metrics: {
            total_artifacts: 3,
            total_assertions: 4,
            verified_assertions: 2,
            conflicting_assertions: 0,
            documented_assertions: 1,
          },
          notes: [],
        },
      },
      {
        site_id: 'site-chakan-02',
        site_name: 'Chakan MIDC Phase IV',
        area_ha: 18.2,
        state_code: 'IN-MH',
        district: 'Pune',
        boundary_screening_status: 'inside_screening_boundary',
        resource_readiness: {
          title: 'Resource Readiness',
          status: 'ATTENTION_REQUIRED',
          metrics: {
            firm_power_mw: 20,
            power_gap_mw: 84,
            power_status: 'PARTIAL',
            firm_water_kld: 1200,
            water_gap_kld: 1600,
            water_status: 'PARTIAL',
          },
          notes: ['Substation proximity does not substitute for sanctioned delivery.'],
        },
        environmental_exposure: {
          title: 'Environmental Exposure',
          status: 'READY',
          metrics: {
            boundary_screening: 'inside_screening_boundary',
            boundary_source: 'geoBoundaries gbOpen IND ADM1',
            area_ha: 18.2,
          },
          notes: [],
        },
        regulatory_readiness: {
          title: 'Regulatory Readiness',
          status: 'READY',
          metrics: {
            state_code: 'IN-MH',
            policy_framework: 'Maharashtra Data Centre Policy 2023 (Stamp duty exemption, power tariff subsidy)',
          },
          notes: ['State incentives subject to formal eligibility filing.'],
        },
        evidence_completeness: {
          title: 'Evidence Completeness',
          status: 'ATTENTION_REQUIRED',
          metrics: {
            total_artifacts: 1,
            total_assertions: 2,
            verified_assertions: 1,
            conflicting_assertions: 0,
            documented_assertions: 1,
          },
          notes: ['Additional third-party audit evidence required.'],
        },
      },
    ],
    epistemic_disclaimer:
      'Independent 4-dimension comparison. Does not compute a black-box composite score. Missing data represents UNKNOWN/UNVERIFIED risk rather than safety.',
  };
}

export function createMockSitePassport(projectId: string, siteId: string): SiteReadinessPassport {
  return {
    passport_id: `pass-${siteId.substring(0, 8)}-${projectId.substring(0, 8)}`,
    generated_at: new Date().toISOString(),
    project_id: projectId,
    project_name: 'Pune Hyperscale Campus (Demo)',
    archetype: 'hyperscale',
    site_id: siteId,
    site_name: 'Daund Greenfield Parcel A',
    state_code: 'IN-MH',
    district: 'Pune',
    parcel_area_ha: 24.5,
    boundary_source: 'geoBoundaries gbOpen IND ADM1',
    boundary_screening_status: 'inside_screening_boundary',
    sections: [
      {
        section_id: 'sec_spatial',
        title: 'Spatial & Boundary Screening',
        status: 'SCREENING_VERIFIED',
        data: {
          area_ha: 24.5,
          state_code: 'IN-MH',
          district: 'Pune',
          boundary_source: 'geoBoundaries gbOpen IND ADM1',
          boundary_screening: { status: 'inside_screening_boundary' },
          revision: 1,
        },
        findings: [],
      },
      {
        section_id: 'sec_phases',
        title: 'Campus Lifecycle & Phasing Progression',
        status: 'EVALUATED',
        data: {
          phases_count: 3,
          phases: [
            {
              phase_sequence: 1,
              phase_name: 'Phase 1 - Initial Buildout',
              commissioning_date: '2027-06-01',
              cumulative_it_mw: 20,
              cumulative_facility_peak_mw: 26,
              design_pue: 1.3,
              peak_summer_water_kld: 700,
            },
            {
              phase_sequence: 2,
              phase_name: 'Phase 2 - Campus Expansion',
              commissioning_date: '2029-06-01',
              cumulative_it_mw: 50,
              cumulative_facility_peak_mw: 65,
              design_pue: 1.3,
              peak_summer_water_kld: 1600,
            },
            {
              phase_sequence: 3,
              phase_name: 'Phase 3 - Full Buildout',
              commissioning_date: '2032-06-01',
              cumulative_it_mw: 80,
              cumulative_facility_peak_mw: 104,
              design_pue: 1.15,
              peak_summer_water_kld: 2800,
            },
          ],
        },
        findings: [],
      },
      {
        section_id: 'sec_resource_gaps',
        title: 'Deliverability & Deficit Balance',
        status: 'DEFICIT',
        data: {
          campus_summary: {
            total_phases: 3,
            total_cumulative_it_mw: 80,
            total_cumulative_facility_peak_mw: 104,
            total_qualifying_firm_power_mw: 40,
            overall_power_gap_mw: 64,
            overall_power_status: 'PARTIAL',
            total_peak_summer_water_kld: 2800,
            total_qualifying_firm_water_kld: 1800,
            overall_water_gap_kld: 1000,
            overall_water_status: 'PARTIAL',
            critical_findings_count: 1,
            warning_findings_count: 2,
          },
        },
        findings: [
          {
            code: 'CRITICAL_POWER_DEFICIT',
            domain: 'POWER',
            severity: 'CRITICAL',
            message: 'Full campus buildout (104 MW) leaves 64 MW unbacked by verified utility sanctions.',
          },
          {
            code: 'SUMMER_WATER_DEFICIT',
            domain: 'WATER',
            severity: 'WARNING',
            message: 'Peak summer cooling demand (2,800 KLD) exceeds verified MIDC water allocation (1,800 KLD) by 1,000 KLD.',
          },
        ],
      },
    ],
    statutory_checklist: [
      {
        name: 'State Environmental Impact Assessment (SEIAA / MoEFCC)',
        mandate: 'EIA Notification 2006 for built-up area > 20,000 sq.m',
        status: 'EVIDENCE_REQUIRED',
      },
      {
        name: 'Consent to Establish (CTE / CTP)',
        mandate: 'State Pollution Control Board (DG emissions & STP effluent discharge)',
        status: 'EVIDENCE_REQUIRED',
      },
      {
        name: 'Dedicated Substation Feasibility Approval',
        mandate: 'STU / DISCOM dedicated 220kV or 110kV feeder and bay availability',
        status: 'ATTENTION_REQUIRED',
      },
      {
        name: 'PESO Explosives Licence for HSD Storage',
        mandate: 'Bulk High Speed Diesel fuel storage for standby backup generator sets',
        status: 'EVIDENCE_REQUIRED',
      },
    ],
    epistemic_disclaimer:
      'Official Pre-Investment Screening Dossier. This passport compiles evidence records for preliminary screening only and does not constitute a legal approval, official clearance, or verified spare utility capacity reservation.',
  };
}

// ----------------- Service Implementation -----------------

export const readinessService = {
  async getProjectReadiness(projectId: string, siteId?: string, signal?: AbortSignal): Promise<ProjectReadinessReport> {
    if (!isReadinessApiMode()) {
      return createMockProjectReadiness(projectId);
    }
    try {
      const res = await apiClient.get<ProjectReadinessReport>(`/projects/${projectId}/phase-readiness`, {
        params: siteId ? { site_id: siteId } : undefined,
        signal,
      });
      return res.data;
    } catch (err) {
      throw new Error(formatReadinessError(err), { cause: err });
    }
  },

  async getProjectComparisons(projectId: string, signal?: AbortSignal): Promise<SiteComparisonResponse> {
    if (!isReadinessApiMode()) {
      return createMockSiteComparisons(projectId);
    }
    try {
      const res = await apiClient.get<SiteComparisonResponse>(`/projects/${projectId}/comparisons`, {
        signal,
      });
      return res.data;
    } catch (err) {
      throw new Error(formatReadinessError(err), { cause: err });
    }
  },

  async getSitePassport(projectId: string, siteId: string, signal?: AbortSignal): Promise<SiteReadinessPassport> {
    if (!isReadinessApiMode()) {
      return createMockSitePassport(projectId, siteId);
    }
    try {
      const res = await apiClient.get<SiteReadinessPassport>(`/projects/${projectId}/sites/${siteId}/passport`, {
        signal,
      });
      return res.data;
    } catch (err) {
      throw new Error(formatReadinessError(err), { cause: err });
    }
  },
};
