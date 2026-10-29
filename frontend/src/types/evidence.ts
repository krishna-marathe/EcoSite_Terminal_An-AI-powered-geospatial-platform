/**
 * EcoSite India — Evidence, Document & Assertion TypeScript Interfaces
 *
 * Author: Omar (Frontend & UX Lead)
 * Based on API_CONTRACTS.md and Four-Member Master Implementation Plan.
 */

export type DocumentType =
  | 'UTILITY_APPLICATION'
  | 'UTILITY_SANCTION'
  | 'WATER_ALLOCATION'
  | 'WATER_STUDY'
  | 'DPR'
  | 'PLANNING'
  | 'EIA_STUDY'
  | 'OTHER';

export type Visibility = 'PROJECT_TEAM' | 'RESTRICTED_REVIEWER' | 'PUBLIC_SUMMARY';

export type AssertionStatus =
  | 'DECLARED'
  | 'DOCUMENTED'
  | 'VERIFIED_WITHIN_SCOPE'
  | 'EXPIRED'
  | 'SUPERSEDED'
  | 'CONFLICTING'
  | 'MISSING';

export type ScopeType = 'CAMPUS' | 'PHASE' | 'CANDIDATE_SITE' | 'CONNECTION_POINT';

export interface EvidenceArtifact {
  id: string;
  project_id: string;
  site_id?: string | null;
  document_type: DocumentType;
  filename: string;
  mime_type: string;
  file_size_bytes: number;
  sha256: string;
  issuer?: string | null;
  reference?: string | null;
  issued_on?: string | null;
  valid_until?: string | null;
  visibility: Visibility;
  synthetic_demo: boolean;
  uploaded_by: string;
  uploaded_at: string;
  notes?: string | null;
}

export interface Assertion {
  id: string;
  project_id: string;
  site_id?: string | null;
  phase_id?: string | null;
  field_key: string;
  field_label: string;
  value: number | string;
  unit: string;
  scope_type: ScopeType;
  scope_detail?: string | null;
  status: AssertionStatus;
  asserted_by: string;
  asserted_at: string;
  effective_from?: string | null;
  effective_to?: string | null;
  supersedes_assertion_id?: string | null;
  evidence_artifact_ids: string[];
  supporting_pages?: number[];
  revision: number;
}

export interface ExtractionCandidate {
  id: string;
  document_id: string;
  document_name: string;
  document_type: DocumentType;
  page_number: number;
  field_key: string;
  field_label: string;
  raw_text: string;
  normalized_value: number | string;
  unit: string;
  phase_scope?: string | null;
  method: 'RULE_BASED' | 'REGEX_PARSER' | 'ML_MODEL' | 'MANUAL';
  model_version?: string | null;
  confidence?: number | null;
  review_status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'MODIFIED';
  bounding_box?: [number, number, number, number];
}

export interface AssertionReviewRequest {
  assertion_id: string;
  decision: 'VERIFIED_WITHIN_SCOPE' | 'REJECTED' | 'FLAG_CONFLICT';
  reviewer_role: string;
  notes?: string;
  scope_limitation?: string;
}

export interface PowerCommitment {
  id: string;
  project_id: string;
  site_id: string;
  utility_name: string;
  substation_name?: string;
  sanctioned_mw: number;
  interconnection_voltage_kv: number;
  commitment_stage: 'APPLICATION' | 'IN_PRINCIPLE_SANCTION' | 'FORMAL_SANCTION' | 'ENERGIZED';
  valid_until?: string;
  evidence_artifact_id?: string;
}

export interface WaterCommitment {
  id: string;
  project_id: string;
  site_id: string;
  source_type: 'MUNICIPAL_PIPELINE' | 'INDUSTRIAL_RECYCLED' | 'GROUNDWATER' | 'SURFACE_WATER';
  allocated_kld: number;
  peak_summer_limit_kld: number;
  internal_reuse_kld: number;
  is_verified_delivery: boolean;
  valid_until?: string;
  evidence_artifact_id?: string;
}
