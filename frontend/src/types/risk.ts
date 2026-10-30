/** Facility environmental risk score (0-100) and its per-parameter breakdown. */

export type RiskBand = 'low' | 'moderate' | 'high' | 'critical' | 'unknown';

export interface RiskParameter {
  key: string;
  label: string;
  unit: string;
  weight: number;
  /** `null` when the provider could not produce a value. It is never a zero. */
  value: number | null;
  score: number | null;
  status: 'AVAILABLE' | 'UNAVAILABLE';
  note: string;
  reason: string | null;
  observedAt: string | null;
  provider: string | null;
  sourceUrl: string | null;
  quality: string | null;
  detail: Record<string, unknown>;
}

export interface RiskScoreResponse {
  facilityId: string;
  score: number | null;
  band: RiskBand;
  /** Share of the parameter weight that was measurable, 0-1. */
  coverage: number;
  availableWeight: number;
  confidence: 'high' | 'medium' | 'low';
  scoreVersion: string;
  generatedAt: string;
  parameters: RiskParameter[];
  notes: string[];
  providerErrors: string[];
}
