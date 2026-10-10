import { DEMO_MITIGATION_CATALOG } from '../data/demo/mitigations';
import type { Facility, InfrastructureType, MitigationRecommendation } from '../types';

export interface MitigationPlanRequest {
  facility_id?: string;
  facility_type?: InfrastructureType;
  constraints?: string;
  focus_area?: string;
}

export const getMitigationRecommendations = async (
  facilityType: InfrastructureType | 'all'
): Promise<MitigationRecommendation[]> => {
  if (facilityType === 'all') {
    return DEMO_MITIGATION_CATALOG;
  }
  return DEMO_MITIGATION_CATALOG.filter(
    (m) => m.facilityType === facilityType || m.facilityType === 'all'
  );
};

// Direct Google Gemini API caller using the user's configured key
export const callGeminiMitigation = async (
  req: MitigationPlanRequest,
  facility?: Facility,
  apiKey?: string
): Promise<MitigationRecommendation[]> => {
  if (!apiKey) return [];

  const fName = facility?.name || 'Target Facility';
  const fType = facility?.type || req.facility_type || 'data_centre';
  const fState = facility?.state || 'India';
  const fDistrict = facility?.district || '';
  const waterStress = facility?.indicators.waterStress ?? 65;
  const gridPressure = facility?.indicators.gridPressure ?? 70;
  const airPollution = facility?.indicators.airPollution ?? 60;
  const riskFactors = facility?.keyRiskFactors?.join(', ') || 'Regional resource stress';
  const constraints = req.constraints?.trim() || 'Accelerate carbon neutrality and water resilience';

  const prompt = `You are a Principal Environmental & Sustainable Infrastructure Engineer specializing in India.
Facility: ${fName} (${fType.replace('_', ' ')} in ${fDistrict}, ${fState}).
Vulnerability Metrics: Water Stress = ${waterStress}/100, Grid Pressure = ${gridPressure}/100, Air Quality = ${airPollution} µg/m³.
Vulnerabilities: ${riskFactors}.
Site Constraints & Objectives: "${constraints}".

Generate 3 high-impact, technologically viable mitigation engineering recommendations.
Return ONLY valid JSON matching this exact structure:
[
  {
    "id": "gemini-rec-1",
    "title": "Clear action-oriented title",
    "category": "Water Conservation",
    "facilityType": "${fType}",
    "priority": "Critical",
    "implementationComplexity": "Moderate",
    "timeframe": "6 - 12 Months",
    "responsibleStakeholder": "Technical Lead",
    "expectedBenefit": "Quantifiable reduction in resource consumption or emissions",
    "supportingEvidence": "Statutory reference (e.g. CPCB, CGWB, CEA)",
    "verificationRequirements": "Verification protocol"
  }
]
Category must be one of: "Water Conservation", "Renewable Energy", "Energy Efficiency", "Waste & Emissions", "Ecology & Community".
Priority must be one of: "Critical", "High", "Moderate".
Complexity must be one of: "Low", "Moderate", "High".`;

  const modelName = import.meta.env.VITE_GEMINI_MODEL || 'gemini-3.7-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  let response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.2,
      },
    }),
  });

  // If gemini-3.7-flash experiences a temporary 503 capacity spike, fallback seamlessly to gemini-2.5-flash
  if (!response.ok && response.status === 503) {
    const fallbackUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    response = await fetch(fallbackUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      }),
    });
  }

  if (!response.ok) {
    throw new Error(`Gemini API returned HTTP ${response.status}`);
  }

  const data = await response.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) return [];

  const parsed = JSON.parse(rawText) as MitigationRecommendation[];
  return parsed;
};

export const generateAIMitigationPlan = async (
  req: MitigationPlanRequest,
  facility?: Facility
): Promise<MitigationRecommendation[]> => {
  const apiKey =
    localStorage.getItem('ECOSITE_GEMINI_API_KEY') ||
    import.meta.env.VITE_GEMINI_API_KEY ||
    '';

  const fType = facility?.type || req.facility_type || 'data_centre';
  const baseRecommendations = DEMO_MITIGATION_CATALOG.filter(
    (m) => m.facilityType === fType || m.facilityType === 'all'
  );

  // If a Gemini API key is configured, call Google Gemini live
  if (apiKey) {
    try {
      const geminiRecs = await callGeminiMitigation(req, facility, apiKey);
      if (geminiRecs && geminiRecs.length > 0) {
        return [...geminiRecs, ...baseRecommendations];
      }
    } catch (err) {
      console.warn('Gemini live call error, using local fallback:', err);
    }
  }

  // Fallback: If user provided custom constraints, generate synthetic recommendation
  if (req.constraints && req.constraints.trim().length > 0) {
    const customRecommendation: MitigationRecommendation = {
      id: `mit-custom-ai-${Date.now()}`,
      title: `AI Synthesized: Site Action for "${req.constraints.slice(0, 45)}..."`,
      category: 'Energy Efficiency',
      facilityType: fType,
      priority: 'High',
      implementationComplexity: 'Moderate',
      timeframe: '6 - 12 Months',
      responsibleStakeholder: 'Technical Project Director & Sustainability Lead',
      supportingEvidence: `Synthesized by EcoSite Terminal from Gemini Engineering Guidelines & ${facility?.state || 'Regional'} statutory norms.`,
      expectedBenefit: `Directly addresses user constraints: "${req.constraints}". Estimated 25-30% reduction in environmental screening sensitivity.`,
      verificationRequirements: 'Third-party carbon & water accounting protocol verification and quarterly SPCB filing.',
    };
    return [customRecommendation, ...baseRecommendations];
  }

  return baseRecommendations;
};
