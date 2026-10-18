import { DEMO_MITIGATION_CATALOG } from '../data/demo/mitigations';
import type { Facility, InfrastructureType, MitigationRecommendation } from '../types';
import { apiClient } from './api';
export interface MitigationPlanRequest { facility_id?: string; facility_type?: InfrastructureType; constraints?: string; focus_area?: string }
export const getMitigationRecommendations = async (facilityType: InfrastructureType | 'all'): Promise<MitigationRecommendation[]> => DEMO_MITIGATION_CATALOG.filter(m => facilityType === 'all' || m.facilityType === facilityType || m.facilityType === 'all').map(m => ({ ...m, expectedBenefit: 'Potential resource or exposure reduction; magnitude requires a site-specific engineering audit.', supportingEvidence: 'Illustrative intervention catalogue, not a verified site-specific recommendation.', verificationRequirements: `Verify suitability, permissions, costs and benefits with qualified specialists. ${m.verificationRequirements}` }));
export function validateRecommendations(value: unknown): MitigationRecommendation[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 20) throw new Error('AI response must contain 1–20 recommendations.');
  const categories = ['Water Conservation', 'Renewable Energy', 'Energy Efficiency', 'Waste & Emissions', 'Ecology & Community'];
  const types = ['all', 'data_centre', 'thermal_power', 'hydro_power', 'solar_farm', 'wind_farm', 'substation', 'industrial'];
  const fields = ['id', 'title', 'category', 'facilityType', 'priority', 'implementationComplexity', 'timeframe', 'responsibleStakeholder', 'supportingEvidence', 'expectedBenefit', 'verificationRequirements'];
  for (const item of value) {
    if (!item || typeof item !== 'object' || fields.some(k => typeof item[k] !== 'string' || !item[k].trim() || item[k].length > 4000) || !categories.includes(item.category) || !types.includes(item.facilityType) || !['High', 'Medium', 'Low'].includes(item.priority) || !['Low', 'Moderate', 'High'].includes(item.implementationComplexity)) throw new Error('AI returned an invalid recommendation.');
  }
  return value as MitigationRecommendation[];
};
export const generateAIMitigationPlan = async (req: MitigationPlanRequest, facility?: Facility): Promise<MitigationRecommendation[]> => {
  if (!facility) throw new Error('Select an available facility first.');
  const apiKey = localStorage.getItem('ECOSITE_GEMINI_API_KEY') || import.meta.env.VITE_GEMINI_API_KEY || '';
  if (!apiKey) throw new Error('Configure a Gemini API key to request optional AI advice.');
  const response = await apiClient.post<{ recommendations: MitigationRecommendation[] }>('/mitigation-plans/gemini', { ...req, api_key: apiKey });
  return validateRecommendations(response.data.recommendations);
};
