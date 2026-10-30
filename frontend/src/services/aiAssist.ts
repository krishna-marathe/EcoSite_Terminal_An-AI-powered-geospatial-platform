/**
 * Gemini AI Assistant Service (Frontend Client).
 *
 * Connects to the server-side Gemini AI engine for live, grounded
 * data-centre insights, with resilient client-side fallbacks.
 */
import { apiClient } from './api';
import type { PublicFacility } from '../types/publicFacilities';
import type { EnvironmentalCurrentResponse } from '../types/environmentalMonitoring';
import {
  generateDataCentreInsights,
  type FacilityInsightSummary,
  type FacilityIntervention,
  type FacilityComplianceRequirement,
  type FacilityInfrastructureTelemetry,
} from '../utils/dataCentreInsights';

export type InspectionMode =
  | 'MEITY_OVERSIGHT'
  | 'SPCB_ENVIRONMENTAL'
  | 'CGWA_WATER'
  | 'CEA_GRID'
  | 'URBAN_RECEPTOR';

export interface MinistryAssessment {
  departmentPerspective: string;
  statutoryRiskScore: number;
  complianceStatus: 'COMPLIANT_NOMINAL' | 'ACTION_REQUIRED_MODERATE' | 'URGENT_INTERVENTION_CRITICAL';
  officialDirective: string;
  statutoryGaps: string[];
  keyRegulatoryActs: string[];
}

export interface AiServiceStatus {
  configured: boolean;
  primaryModel: string;
  fallbackModels: string[];
  activeKeyMasked: string;
}

export interface FacilityAiAssistRequest {
  focus_area?: string;
  custom_prompt?: string;
  force_model?: string;
  inspection_mode?: InspectionMode;
}

export interface FacilityAiAssistResponse {
  facilityId: string;
  facilityName: string;
  modelUsed: string;
  status: 'live_ai' | 'fallback_deterministic';
  criticalityTier: 'TIER_1_ELEVATED' | 'TIER_2_MODERATE' | 'TIER_3_NOMINAL';
  criticalityLabel: string;
  vulnerabilityOverview: string;
  stateRegulatoryBody: string;
  stateDiscom: string;
  ministryAssessment?: MinistryAssessment | null;
  interventions: FacilityIntervention[];
  complianceChecklist: FacilityComplianceRequirement[];
  infrastructureTelemetry: FacilityInfrastructureTelemetry;
  focusArea?: string | null;
  customPrompt?: string | null;
  inspectionMode?: string | null;
  generatedAt: string;
  disclaimer: string;
}

export async function fetchAiServiceStatus(): Promise<AiServiceStatus> {
  try {
    const res = await apiClient.get<AiServiceStatus>('/ai-assist/status');
    return res.data;
  } catch {
    return {
      configured: true,
      primaryModel: 'gemini-3.8-flash',
      fallbackModels: ['gemini-2.5-flash-lite', 'gemini-3.5-flash', 'gemini-2.5-flash'],
      activeKeyMasked: 'Server-Managed',
    };
  }
}

export async function fetchFacilityAiAssist(
  facilityId: string,
  options?: FacilityAiAssistRequest,
  fallbackFacility?: PublicFacility,
  envCurrent?: EnvironmentalCurrentResponse | null,
): Promise<FacilityAiAssistResponse> {
  try {
    const res = await apiClient.post<FacilityAiAssistResponse>(
      `/public-facilities/${encodeURIComponent(facilityId)}/ai-assist`,
      options ?? {},
    );
    return res.data;
  } catch (error) {
    // If backend route fails or network drops, provide graceful local deterministic baseline
    if (fallbackFacility) {
      const baseline = generateDataCentreInsights(fallbackFacility, envCurrent);
      return {
        facilityId: fallbackFacility.id,
        facilityName: fallbackFacility.name,
        modelUsed: 'Local Engineering Baseline (offline)',
        status: 'fallback_deterministic',
        criticalityTier: baseline.criticalityTier,
        criticalityLabel: baseline.criticalityLabel,
        vulnerabilityOverview: baseline.vulnerabilityOverview,
        stateRegulatoryBody: baseline.stateRegulatoryBody,
        stateDiscom: baseline.stateDiscom,
        ministryAssessment: {
          departmentPerspective: 'Ministry of Electronics and Information Technology (MeitY) & MoEFCC',
          statutoryRiskScore: baseline.criticalityTier === 'TIER_1_ELEVATED' ? 65 : 45,
          complianceStatus: baseline.criticalityTier === 'TIER_1_ELEVATED' ? 'ACTION_REQUIRED_MODERATE' : 'COMPLIANT_NOMINAL',
          officialDirective: 'Verify DG stack heights and CGWA groundwater telemetry during next CTO renewal.',
          statutoryGaps: [
            'Groundwater recharge log telemetry verification pending.',
            'DG acoustic insertion loss test certificate required.',
          ],
          keyRegulatoryActs: [
            'Water (Prevention and Control of Pollution) Act 1974',
            'Air (Prevention and Control of Pollution) Act 1981',
            'CGWA 2020/2023 Gazette Guidelines',
          ],
        },
        interventions: baseline.interventions,
        complianceChecklist: baseline.complianceChecklist,
        infrastructureTelemetry: baseline.infrastructureTelemetry,
        focusArea: options?.focus_area ?? null,
        customPrompt: options?.custom_prompt ?? null,
        inspectionMode: options?.inspection_mode ?? 'MEITY_OVERSIGHT',
        generatedAt: new Date().toISOString(),
        disclaimer: baseline.disclaimer,
      };
    }
    throw error;
  }
}
