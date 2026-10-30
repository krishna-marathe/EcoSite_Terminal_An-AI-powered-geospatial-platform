/**
 * EcoSite India — Evidence, Document & Assertion Service
 *
 * Author: Krishna (Data Engine Lead) & Omar (Frontend Lead)
 * Genuine FastAPI integration with offline mock fallback.
 */

import axios from 'axios';
import { apiClient } from './api';
import { useDashboardStore } from '../stores/dashboardStore';
import type {
  EvidenceArtifact,
  Assertion,
  AssertionStatus,
  ScopeType,
  ExtractionCandidate,
  AssertionReviewRequest,
  EvidenceUploadMetadata,
  DocumentType,
  Visibility,
} from '../types/evidence';

export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MiB (26,214,400 bytes)
export const ALLOWED_FILE_EXTENSIONS = ['.pdf', '.docx', '.doc', '.txt', '.md'];

export const FIELD_LABELS: Record<string, string> = {
  sanctioned_grid_mw: 'Sanctioned Grid Power',
  power_sanctioned_mw: 'Sanctioned Grid Power',
  water_allocation_kld: 'Allocated Water Supply',
  required_facility_mw: 'Full Campus Peak Demand',
  peak_summer_water_kld: 'Peak Summer Water Requirement',
  total_it_capacity_mw: 'Total IT Capacity',
  design_pue: 'Design PUE',
};

// Mock initial data fixtures for offline/demo/contract testing
export const INITIAL_MOCK_ARTIFACTS: EvidenceArtifact[] = [
  {
    id: 'art-001',
    project_id: 'proj-pune-hyperscale',
    site_id: 'site-daund-01',
    document_type: 'UTILITY_SANCTION',
    filename: 'MSEDCL_Grid_Sanction_Phase1_40MW.pdf',
    mime_type: 'application/pdf',
    file_size_bytes: 1845200,
    sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    issuer: 'Maharashtra State Electricity Distribution Co. Ltd. (MSEDCL)',
    reference: 'CE/PZC/COMM/2026/4102',
    issued_on: '2026-04-12',
    valid_until: '2028-04-11',
    visibility: 'PROJECT_TEAM',
    synthetic_demo: true,
    uploaded_by: 'siddharth@developer.ecosite',
    uploaded_at: '2026-10-20T10:15:00Z',
    notes: 'Sanction letter for initial 40 MW grid tap off 220kV Baramati feeder.',
  },
  {
    id: 'art-002',
    project_id: 'proj-pune-hyperscale',
    site_id: 'site-daund-01',
    document_type: 'WATER_ALLOCATION',
    filename: 'MIDC_Industrial_Water_Allocation_1800KLD.pdf',
    mime_type: 'application/pdf',
    file_size_bytes: 945120,
    sha256: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8',
    issuer: 'Maharashtra Industrial Development Corporation (MIDC)',
    reference: 'MIDC/ENG/WAT/2026/891',
    issued_on: '2026-05-18',
    valid_until: '2031-05-17',
    visibility: 'PROJECT_TEAM',
    synthetic_demo: true,
    uploaded_by: 'siddharth@developer.ecosite',
    uploaded_at: '2026-10-21T14:30:00Z',
    notes: 'Allocation of 1,800 KLD industrial tertiary treated supply.',
  },
  {
    id: 'art-003',
    project_id: 'proj-pune-hyperscale',
    site_id: 'site-daund-01',
    document_type: 'DPR',
    filename: 'EcoCompute_Campus_DPR_Revision_2.pdf',
    mime_type: 'application/pdf',
    file_size_bytes: 4210400,
    sha256: '4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a',
    issuer: 'EcoSite Engineering Consultants',
    reference: 'DPR-IN-MH-2026-02',
    issued_on: '2026-08-01',
    valid_until: null,
    visibility: 'PROJECT_TEAM',
    synthetic_demo: true,
    uploaded_by: 'omar@ecosite.internal',
    uploaded_at: '2026-10-22T09:00:00Z',
    notes: 'Detailed Project Report for 80 MW campus buildout over three phases.',
  },
];

export const INITIAL_MOCK_ASSERTIONS: Assertion[] = [
  {
    id: 'asrt-001',
    project_id: 'proj-pune-hyperscale',
    site_id: 'site-daund-01',
    phase_id: 'phase-01',
    field_key: 'sanctioned_grid_mw',
    field_label: 'Sanctioned Grid Power',
    value: 40,
    unit: 'MW',
    scope_type: 'PHASE',
    scope_detail: 'Phase 1 (2027 Commissioning)',
    status: 'VERIFIED_WITHIN_SCOPE',
    verification_method: 'SIMULATED_REVIEW',
    is_simulated: true,
    asserted_by: 'MSEDCL / Reviewed by Consultant',
    asserted_at: '2026-10-20T11:00:00Z',
    effective_from: '2026-04-12',
    effective_to: '2028-04-11',
    evidence_artifact_ids: ['art-001'],
    supporting_pages: [2],
    revision: 1,
  },
  {
    id: 'asrt-002',
    project_id: 'proj-pune-hyperscale',
    site_id: 'site-daund-01',
    phase_id: 'phase-03',
    field_key: 'required_facility_mw',
    field_label: 'Full Campus Peak Demand',
    value: 80,
    unit: 'MW',
    scope_type: 'CAMPUS',
    scope_detail: 'Full Campus (Phase 3 cumulative)',
    status: 'DOCUMENTED',
    asserted_by: 'EcoSite Engineering Consultants',
    asserted_at: '2026-10-22T09:15:00Z',
    evidence_artifact_ids: ['art-003'],
    supporting_pages: [14],
    revision: 1,
  },
  {
    id: 'asrt-003',
    project_id: 'proj-pune-hyperscale',
    site_id: 'site-daund-01',
    phase_id: 'phase-01',
    field_key: 'water_allocation_kld',
    field_label: 'Evidenced Water Supply',
    value: 1800,
    unit: 'KLD',
    scope_type: 'CAMPUS',
    scope_detail: 'MIDC Tertiary Pipeline',
    status: 'VERIFIED_WITHIN_SCOPE',
    verification_method: 'SIMULATED_REVIEW',
    is_simulated: true,
    asserted_by: 'MIDC Authority',
    asserted_at: '2026-10-21T15:00:00Z',
    effective_from: '2026-05-18',
    effective_to: '2031-05-17',
    evidence_artifact_ids: ['art-002'],
    supporting_pages: [1, 3],
    revision: 1,
  },
  {
    id: 'asrt-004',
    project_id: 'proj-pune-hyperscale',
    site_id: 'site-daund-01',
    phase_id: 'phase-03',
    field_key: 'peak_summer_water_kld',
    field_label: 'Peak Summer Water Requirement',
    value: 2800,
    unit: 'KLD',
    scope_type: 'CAMPUS',
    scope_detail: 'Campus evaporative cooling peak',
    status: 'CONFLICTING',
    asserted_by: 'DPR Revision 2 vs MIDC Sanction',
    asserted_at: '2026-10-22T10:00:00Z',
    evidence_artifact_ids: ['art-002', 'art-003'],
    supporting_pages: [18],
    revision: 1,
  },
];

export const INITIAL_MOCK_EXTRACTIONS: ExtractionCandidate[] = [
  {
    id: 'ext-001',
    document_id: 'art-001',
    document_name: 'MSEDCL_Grid_Sanction_Phase1_40MW.pdf',
    document_type: 'UTILITY_SANCTION',
    page_number: 2,
    field_key: 'sanctioned_grid_mw',
    field_label: 'Sanctioned Grid Power',
    raw_text: 'The competent authority accords formal sanction for a contract demand of 40.0 MW at 220 kV voltage level.',
    normalized_value: 40,
    unit: 'MW',
    phase_scope: 'PHASE_1',
    method: 'RULE_BASED',
    confidence: 0.98,
    review_status: 'ACCEPTED',
    bounding_box: [120, 240, 480, 280],
  },
  {
    id: 'ext-002',
    document_id: 'art-002',
    document_name: 'MIDC_Industrial_Water_Allocation_1800KLD.pdf',
    document_type: 'WATER_ALLOCATION',
    page_number: 1,
    field_key: 'water_allocation_kld',
    field_label: 'Allocated Water Supply',
    raw_text: 'Subject to timely pipeline commissioning, a continuous water allocation of 1800 KLD (kilo-litres per day) is reserved.',
    normalized_value: 1800,
    unit: 'KLD',
    phase_scope: 'CAMPUS',
    method: 'REGEX_PARSER',
    confidence: 0.94,
    review_status: 'ACCEPTED',
    bounding_box: [100, 310, 500, 350],
  },
  {
    id: 'ext-003',
    document_id: 'art-003',
    document_name: 'EcoCompute_Campus_DPR_Revision_2.pdf',
    document_type: 'DPR',
    page_number: 18,
    field_key: 'peak_summer_water_kld',
    field_label: 'Peak Summer Water Requirement',
    raw_text: 'Under extreme dry-bulb conditions (42°C wet-bulb 28°C), peak evaporative consumption will reach 2,800 KLD.',
    normalized_value: 2800,
    unit: 'KLD',
    phase_scope: 'PHASE_3',
    method: 'RULE_BASED',
    confidence: 0.91,
    review_status: 'PENDING',
    bounding_box: [110, 420, 520, 460],
  },
];

export const EVIDENCE_STORAGE_KEY = 'ecosite-project-evidence-v1';

export interface EvidenceStoreData {
  artifacts: EvidenceArtifact[];
  assertions: Assertion[];
  extractions: ExtractionCandidate[];
}

function loadStore(): EvidenceStoreData {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(EVIDENCE_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (
          parsed &&
          Array.isArray(parsed.artifacts) &&
          Array.isArray(parsed.assertions) &&
          Array.isArray(parsed.extractions)
        ) {
          return parsed as EvidenceStoreData;
        }
      }
    }
  } catch {
    // Fall back to memory on localStorage error or corrupted JSON
  }

  return {
    artifacts: [...INITIAL_MOCK_ARTIFACTS],
    assertions: [...INITIAL_MOCK_ASSERTIONS],
    extractions: [...INITIAL_MOCK_EXTRACTIONS],
  };
}

function saveStore(data: EvidenceStoreData): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(EVIDENCE_STORAGE_KEY, JSON.stringify(data));
    }
  } catch {
    // Silently ignore quota / access errors
  }
}

// In-memory state for offline/demo/contract tests
let artifactsStore = [...INITIAL_MOCK_ARTIFACTS];
let assertionsStore = [...INITIAL_MOCK_ASSERTIONS];
let extractionsStore = [...INITIAL_MOCK_EXTRACTIONS];

// Local cache for candidates loaded from backend to resolve document_id on confirm/reject
const backendCandidateCache = new Map<string, { candidate: ExtractionCandidate; artifactId: string }>();

const CANDIDATE_STORAGE_KEY = 'ecosite_candidate_artifact_map_v1';

function saveCandidateArtifactMapping(candidateId: string, artifactId: string): void {
  try {
    if (typeof sessionStorage === 'undefined') return;
    const raw = sessionStorage.getItem(CANDIDATE_STORAGE_KEY);
    const map: Record<string, string> = raw ? JSON.parse(raw) : {};
    map[candidateId] = artifactId;
    map[`${artifactId}:${candidateId}`] = artifactId;
    sessionStorage.setItem(CANDIDATE_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Ignore sessionStorage limitations in constrained environments
  }
}

function getStoredArtifactId(candidateId: string, documentId?: string): string | null {
  try {
    if (typeof sessionStorage === 'undefined') return null;
    const raw = sessionStorage.getItem(CANDIDATE_STORAGE_KEY);
    if (!raw) return null;
    const map: Record<string, string> = JSON.parse(raw);
    if (documentId && map[`${documentId}:${candidateId}`]) {
      return map[`${documentId}:${candidateId}`];
    }
    return map[candidateId] || null;
  } catch {
    return null;
  }
}

// Force flag for testing
let mockModeOverride: boolean | null = null;

export function setEvidenceMockMode(enabled: boolean | null): void {
  mockModeOverride = enabled;
}

export function isEvidenceApiMode(): boolean {
  if (mockModeOverride !== null) {
    return !mockModeOverride;
  }
  try {
    return useDashboardStore.getState().dataMode === 'api';
  } catch {
    return false;
  }
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

interface HttpErrorLike {
  isAxiosError?: boolean;
  response?: {
    status?: number;
    data?: {
      detail?: unknown;
    };
  };
  message?: string;
}

function getHttpError(error: unknown): HttpErrorLike | null {
  if (axios.isAxiosError(error)) return error;
  if (error && typeof error === 'object' && 'response' in error) {
    return error as HttpErrorLike;
  }
  return null;
}

export function extractErrorMessage(error: unknown, fallback: string): string {
  const httpErr = getHttpError(error);
  if (httpErr) {
    const detail = httpErr.response?.data?.detail;
    if (typeof detail === 'string') return detail;
    if (detail && typeof detail === 'object' && typeof (detail as { message?: unknown }).message === 'string') {
      return (detail as { message: string }).message;
    }
    if (httpErr.response?.status === 413) {
      return 'File size exceeds maximum allowed limit (25 MiB).';
    }
    if (httpErr.response?.status === 409) {
      return 'Conflict: Operation rejected due to state conflict.';
    }
    if (httpErr.response?.status === 422) {
      return 'Validation failed: Please check submitted format and fields.';
    }
    if (!httpErr.response) {
      return 'EcoSite backend unavailable. Check your local connection.';
    }
  }
  return error instanceof Error ? error.message : fallback;
}

interface EvidenceArtifactReadDTO {
  id: string;
  project_id: string;
  site_id?: string | null;
  document_type: string;
  filename: string;
  mime_type: string;
  file_size_bytes: number;
  sha256: string;
  issuer?: string | null;
  reference?: string | null;
  issued_on?: string | null;
  valid_until?: string | null;
  visibility: string;
  synthetic_demo: boolean;
  uploaded_by: string;
  uploaded_at: string;
  notes?: string | null;
}

interface AssertionEvidenceLinkReadDTO {
  artifact_id: string;
  filename: string;
  document_type: string;
  page_number?: number | null;
  sha256: string;
  synthetic_demo: boolean;
}

interface AssertionReviewReadDTO {
  id: string;
  assertion_id: string;
  reviewer_id: string;
  review_status: string;
  is_simulated: boolean;
  notes: string;
  reviewed_at: string;
}

interface AssertionReadDTO {
  id: string;
  project_id: string;
  site_id?: string | null;
  phase_id?: string | null;
  field_key: string;
  value: string;
  numeric_value?: number | null;
  unit: string;
  scope_type: string;
  scope_detail?: string | null;
  status: string;
  verification_method: string;
  asserted_by: string;
  asserted_at: string;
  effective_from?: string | null;
  effective_to?: string | null;
  supersedes_assertion_id?: string | null;
  status_record: string;
  revision: number;
  evidence_links: AssertionEvidenceLinkReadDTO[];
  reviews?: AssertionReviewReadDTO[];
}

interface ExtractionCandidatePayloadDTO {
  extraction_id: string;
  document_id: string;
  document_type: string;
  page_number: number;
  field_key: string;
  raw_text: string;
  normalized_value?: number | string | null;
  unit?: string | null;
  phase_scope?: string | null;
  method?: string;
  model_version?: string | null;
  confidence?: number | null;
  review_status: string;
  assertion_id?: string | null;
}

interface ExtractionRunResponseDTO {
  artifact_id: string;
  filename: string;
  file_format: string;
  page_count: number;
  status: string;
  document_type: string;
  candidate_count: number;
  extraction_candidates: ExtractionCandidatePayloadDTO[];
}

function mapArtifactRead(dto: EvidenceArtifactReadDTO): EvidenceArtifact {
  return {
    id: dto.id,
    project_id: dto.project_id,
    site_id: dto.site_id ?? null,
    document_type: dto.document_type as DocumentType,
    filename: dto.filename,
    mime_type: dto.mime_type,
    file_size_bytes: dto.file_size_bytes,
    sha256: dto.sha256,
    issuer: dto.issuer ?? null,
    reference: dto.reference ?? null,
    issued_on: dto.issued_on ?? null,
    valid_until: dto.valid_until ?? null,
    visibility: (dto.visibility as Visibility) || 'PROJECT_TEAM',
    synthetic_demo: Boolean(dto.synthetic_demo),
    uploaded_by: dto.uploaded_by,
    uploaded_at: dto.uploaded_at,
    notes: dto.notes ?? null,
  };
}

function mapScopeType(scope: string): ScopeType {
  if (scope === 'SITE') return 'CANDIDATE_SITE';
  if (scope === 'CONNECTION') return 'CONNECTION_POINT';
  if (scope === 'PHASE') return 'PHASE';
  return 'CAMPUS';
}

function mapAssertionRead(dto: AssertionReadDTO): Assertion {
  const artifactIds = Array.isArray(dto.evidence_links)
    ? dto.evidence_links.map((link) => link.artifact_id)
    : [];
  const pages = Array.isArray(dto.evidence_links)
    ? dto.evidence_links
        .map((link) => link.page_number)
        .filter((p): p is number => typeof p === 'number')
    : [];

  const displayVal =
    dto.numeric_value !== null && dto.numeric_value !== undefined
      ? dto.numeric_value
      : dto.value;

  return {
    id: dto.id,
    project_id: dto.project_id,
    site_id: dto.site_id ?? null,
    phase_id: dto.phase_id ?? null,
    field_key: dto.field_key,
    field_label: FIELD_LABELS[dto.field_key] || dto.field_key.replace(/_/g, ' '),
    value: displayVal,
    unit: dto.unit,
    scope_type: mapScopeType(dto.scope_type),
    scope_detail: dto.scope_detail ?? null,
    status: dto.status as AssertionStatus,
    verification_method: dto.verification_method ?? null,
    is_simulated:
      dto.verification_method === 'SIMULATED_REVIEW' ||
      (Array.isArray(dto.reviews) && dto.reviews.some((r) => r.is_simulated)),
    asserted_by: dto.asserted_by,
    asserted_at: dto.asserted_at,
    effective_from: dto.effective_from ?? null,
    effective_to: dto.effective_to ?? null,
    supersedes_assertion_id: dto.supersedes_assertion_id ?? null,
    evidence_artifact_ids: artifactIds,
    supporting_pages: pages,
    revision: dto.revision,
  };
}

function mapCandidatePayload(
  payload: ExtractionCandidatePayloadDTO,
  filename?: string
): ExtractionCandidate {
  let method: ExtractionCandidate['method'] = 'RULE_BASED';
  if (payload.method === 'REGEX_PARSER') method = 'REGEX_PARSER';
  else if (payload.method === 'ML_MODEL' || payload.method === 'EXTRACTED_MODEL') method = 'ML_MODEL';
  else if (payload.method === 'MANUAL') method = 'MANUAL';

  const revStatus = (
    ['ACCEPTED', 'REJECTED', 'MODIFIED'].includes(payload.review_status)
      ? payload.review_status
      : 'PENDING'
  ) as ExtractionCandidate['review_status'];

  return {
    id: payload.extraction_id,
    document_id: payload.document_id,
    document_name: filename || payload.document_id,
    document_type: payload.document_type as DocumentType,
    page_number: payload.page_number,
    field_key: payload.field_key,
    field_label: FIELD_LABELS[payload.field_key] || payload.field_key.replace(/_/g, ' '),
    raw_text: payload.raw_text,
    normalized_value: payload.normalized_value ?? payload.raw_text,
    unit: payload.unit || '',
    phase_scope: payload.phase_scope || 'UNKNOWN',
    method,
    model_version: payload.model_version ?? null,
    confidence: payload.confidence ?? null,
    review_status: revStatus,
  };
}

export const evidenceService = {
  async getArtifacts(projectId: string): Promise<EvidenceArtifact[]> {
    if (!isEvidenceApiMode()) {
      const store = loadStore();
      if (!projectId) return store.artifacts;
      return store.artifacts.filter((a) => a.project_id === projectId);
    }

    try {
      const response = await apiClient.get<EvidenceArtifactReadDTO[]>(
        `/projects/${projectId}/evidence`
      );
      if (!Array.isArray(response.data)) {
        throw new Error('Expected an array of evidence artifacts from backend.');
      }
      return response.data.map(mapArtifactRead);
    } catch (err) {
      throw new Error(extractErrorMessage(err, 'Failed to retrieve evidence artifacts.'), { cause: err });
    }
  },

  async uploadArtifact(
    projectId: string,
    file: File,
    metadata: EvidenceUploadMetadata
  ): Promise<EvidenceArtifact> {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new Error(
        `File size (${(file.size / (1024 * 1024)).toFixed(1)} MiB) exceeds the maximum allowed limit of 25 MiB.`
      );
    }

    const extension = '.' + (file.name.split('.').pop() || '').toLowerCase();
    if (!ALLOWED_FILE_EXTENSIONS.includes(extension)) {
      throw new Error(
        `Unsupported file format '${extension}'. Allowed extensions: ${ALLOWED_FILE_EXTENSIONS.join(', ')}.`
      );
    }

    if (!isEvidenceApiMode()) {
      const newArtifact: EvidenceArtifact = {
        id: `art-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        project_id: projectId,
        site_id: metadata.site_id || null,
        document_type: metadata.document_type,
        filename: file.name,
        mime_type: file.type || 'application/pdf',
        file_size_bytes: file.size,
        sha256: 'simulated_' + Math.random().toString(36).substring(2, 15),
        issuer: metadata.issuer || null,
        reference: metadata.reference || null,
        issued_on: new Date().toISOString().split('T')[0],
        valid_until: metadata.valid_until || null,
        visibility: 'PROJECT_TEAM',
        synthetic_demo: true,
        uploaded_by: 'current_user@ecosite',
        uploaded_at: new Date().toISOString(),
        notes: metadata.notes || null,
      };

      artifactsStore = [newArtifact, ...artifactsStore];
      const store = loadStore();
      store.artifacts = [newArtifact, ...store.artifacts];
      saveStore(store);
      return newArtifact;
    }

    try {
      const base64Data = await fileToBase64(file);
      const isSynthetic = metadata.synthetic_demo !== undefined ? metadata.synthetic_demo : !isEvidenceApiMode();
      const uploadedBy = metadata.uploaded_by || 'local-user';

      const payload = {
        filename: file.name,
        document_type: metadata.document_type,
        content_base64: base64Data,
        site_id: metadata.site_id || undefined,
        issuer: metadata.issuer || undefined,
        reference: metadata.reference || undefined,
        valid_until: metadata.valid_until || undefined,
        visibility: 'PROJECT_TEAM',
        confidentiality: 'confidential',
        synthetic_demo: isSynthetic,
        uploaded_by: uploadedBy,
      };

      const uploadRes = await apiClient.post<EvidenceArtifactReadDTO>(
        `/projects/${projectId}/evidence/upload`,
        payload
      );
      const artifact = mapArtifactRead(uploadRes.data);

      // Trigger automatic ML extraction
      try {
        await apiClient.post(`/evidence/${artifact.id}/extract`);
      } catch (extractErr) {
        console.warn(`[EcoSite Evidence] Auto-extraction triggered with notice: ${extractErrorMessage(extractErr, 'Extraction pending')}`);
      }

      return artifact;
    } catch (err) {
      throw new Error(extractErrorMessage(err, 'Failed to upload evidence artifact.'), { cause: err });
    }
  },

  async getAssertions(projectId: string): Promise<Assertion[]> {
    if (!isEvidenceApiMode()) {
      const store = loadStore();
      if (!projectId) return store.assertions;
      return store.assertions.filter((a) => a.project_id === projectId);
    }

    try {
      const response = await apiClient.get<AssertionReadDTO[]>(
        `/projects/${projectId}/assertions`
      );
      if (!Array.isArray(response.data)) {
        throw new Error('Expected an array of assertions from backend.');
      }
      return response.data.map(mapAssertionRead);
    } catch (err) {
      throw new Error(extractErrorMessage(err, 'Failed to retrieve assertions.'), { cause: err });
    }
  },

  async reviewAssertion(review: AssertionReviewRequest): Promise<Assertion> {
    if (!isEvidenceApiMode()) {
      const store = loadStore();
      const target = store.assertions.find((a) => a.id === review.assertion_id) || assertionsStore.find((a) => a.id === review.assertion_id);
      if (!target) throw new Error('Assertion not found');

      const resolvedStatus: AssertionStatus =
        review.decision === 'FLAG_CONFLICT'
          ? 'CONFLICTING'
          : review.decision === 'VERIFIED_WITHIN_SCOPE'
            ? 'VERIFIED_WITHIN_SCOPE'
            : 'MISSING';

      const updated: Assertion = {
        ...target,
        status: resolvedStatus,
        revision: target.revision + 1,
      };

      store.assertions = store.assertions.map((a) => (a.id === updated.id ? updated : a));
      saveStore(store);
      assertionsStore = assertionsStore.map((a) => (a.id === updated.id ? updated : a));
      return updated;
    }

    try {
      let reviewStatus: 'APPROVED' | 'FLAGGED_CONFLICT' | 'REJECTED';
      if (review.decision === 'VERIFIED_WITHIN_SCOPE') {
        reviewStatus = 'APPROVED';
      } else if (review.decision === 'FLAG_CONFLICT') {
        reviewStatus = 'FLAGGED_CONFLICT';
      } else {
        reviewStatus = 'REJECTED';
      }

      const reviewerId = review.reviewer_id || review.reviewer_role;
      const body = {
        reviewer_id: reviewerId,
        review_status: reviewStatus,
        is_simulated: review.is_simulated ?? true,
        notes: review.notes || `Review outcome: ${review.decision} by ${review.reviewer_role}`,
      };

      const response = await apiClient.post<AssertionReadDTO>(
        `/assertions/${review.assertion_id}/reviews`,
        body
      );
      return mapAssertionRead(response.data);
    } catch (err) {
      throw new Error(extractErrorMessage(err, 'Failed to record assertion review.'), { cause: err });
    }
  },

  async getExtractions(documentOrProjectId?: string): Promise<ExtractionCandidate[]> {
    if (!isEvidenceApiMode()) {
      const store = loadStore();
      if (!documentOrProjectId) return store.extractions;

      // Check if documentOrProjectId matches document_id directly
      const directMatches = store.extractions.filter(
        (e) => e.document_id === documentOrProjectId || e.id === documentOrProjectId
      );
      if (directMatches.length > 0) return directMatches;

      // Otherwise treat documentOrProjectId as projectId: only return extractions whose document belongs to this project
      const projectDocIds = new Set(
        store.artifacts.filter((a) => a.project_id === documentOrProjectId).map((a) => a.id)
      );
      return store.extractions.filter((e) => projectDocIds.has(e.document_id));
    }

    if (!documentOrProjectId) {
      return Array.from(backendCandidateCache.values()).map((entry) => entry.candidate);
    }

    // Attempt 1: treat documentOrProjectId as artifact_id
    try {
      let runData: ExtractionRunResponseDTO;
      try {
        const res = await apiClient.get<ExtractionRunResponseDTO>(
          `/evidence/${documentOrProjectId}/extractions`
        );
        runData = res.data;
      } catch (firstErr) {
        const httpFirst = getHttpError(firstErr);
        if (httpFirst && httpFirst.response?.status === 404) {
          const detail = httpFirst.response.data?.detail;
          const code = typeof detail === 'object' ? (detail as { code?: string }).code : '';
          if (code === 'not_extracted') {
            const extractRes = await apiClient.post<ExtractionRunResponseDTO>(
              `/evidence/${documentOrProjectId}/extract`
            );
            runData = extractRes.data;
          } else {
            throw firstErr;
          }
        } else {
          throw firstErr;
        }
      }

      const mapped = (runData.extraction_candidates || []).map((c) =>
        mapCandidatePayload(c, runData.filename)
      );
      for (const cand of mapped) {
        backendCandidateCache.set(cand.id, { candidate: cand, artifactId: documentOrProjectId });
        backendCandidateCache.set(`${documentOrProjectId}:${cand.id}`, { candidate: cand, artifactId: documentOrProjectId });
        saveCandidateArtifactMapping(cand.id, documentOrProjectId);
      }
      return mapped;
    } catch (artifactErr) {
      const httpArt = getHttpError(artifactErr);
      const artDetail = httpArt?.response?.data?.detail;
      const artCode = typeof artDetail === 'object' ? (artDetail as { code?: string }).code : '';
      if (httpArt && httpArt.response?.status === 404 && artCode === 'artifact_not_found') {
        try {
          const artRes = await apiClient.get<EvidenceArtifactReadDTO[]>(
            `/projects/${documentOrProjectId}/evidence`
          );
          const artifacts = artRes.data || [];
          const allCandidates: ExtractionCandidate[] = [];

          for (const art of artifacts) {
            try {
              let extRes: ExtractionRunResponseDTO;
              try {
                const r = await apiClient.get<ExtractionRunResponseDTO>(
                  `/evidence/${art.id}/extractions`
                );
                extRes = r.data;
              } catch (innerErr) {
                const httpInner = getHttpError(innerErr);
                if (httpInner && httpInner.response?.status === 404) {
                  const run = await apiClient.post<ExtractionRunResponseDTO>(
                    `/evidence/${art.id}/extract`
                  );
                  extRes = run.data;
                } else {
                  continue;
                }
              }

              const mapped = (extRes.extraction_candidates || []).map((c) =>
                mapCandidatePayload(c, art.filename)
              );
              for (const cand of mapped) {
                backendCandidateCache.set(cand.id, { candidate: cand, artifactId: art.id });
                backendCandidateCache.set(`${art.id}:${cand.id}`, { candidate: cand, artifactId: art.id });
                saveCandidateArtifactMapping(cand.id, art.id);
                allCandidates.push(cand);
              }
            } catch {
              // Ignore single artifact extraction failures
            }
          }
          return allCandidates;
        } catch (projErr) {
          throw new Error(extractErrorMessage(projErr, 'Failed to load project extractions.'), { cause: projErr });
        }
      }

      throw new Error(extractErrorMessage(artifactErr, 'Failed to retrieve extraction candidates.'), { cause: artifactErr });
    }
  },

  async confirmExtraction(
    extractionId: string,
    decision: 'ACCEPTED' | 'REJECTED',
    adjustedValue?: number | string,
    documentId?: string,
    projectId?: string
  ): Promise<ExtractionCandidate> {
    if (!isEvidenceApiMode()) {
      const store = loadStore();
      const target = store.extractions.find((e) => e.id === extractionId) || extractionsStore.find((e) => e.id === extractionId);
      if (!target) throw new Error('Extraction not found');

      const updated: ExtractionCandidate = {
        ...target,
        review_status: decision,
        normalized_value: adjustedValue !== undefined ? adjustedValue : target.normalized_value,
      };

      store.extractions = store.extractions.map((e) => (e.id === updated.id ? updated : e));
      saveStore(store);
      extractionsStore = extractionsStore.map((e) => (e.id === updated.id ? updated : e));
      return updated;
    }

    // 1. Resolve artifact ID from explicit documentId, composite cache, memory cache, session storage, or ID prefix
    let resolvedArtifactId: string | null = documentId || null;

    if (!resolvedArtifactId) {
      const memEntry = backendCandidateCache.get(extractionId);
      if (memEntry) {
        resolvedArtifactId = memEntry.artifactId;
      }
    }

    if (!resolvedArtifactId) {
      resolvedArtifactId = getStoredArtifactId(extractionId, documentId);
    }

    if (!resolvedArtifactId && extractionId.includes('-cand-')) {
      resolvedArtifactId = extractionId.split('-cand-')[0];
    }

    // 2. If still unmapped and projectId is provided, reconstruct mapping from backend
    if (!resolvedArtifactId && projectId) {
      try {
        const candidates = await evidenceService.getExtractions(projectId);
        const match = candidates.find((c) => c.id === extractionId);
        if (match) {
          resolvedArtifactId = match.document_id;
        }
      } catch {
        // Fall through to error
      }
    }

    if (!resolvedArtifactId) {
      throw new Error(
        `Extraction candidate '${extractionId}' could not be associated with a valid artifact. Please reload extractions before confirming.`
      );
    }

    const artifactId = resolvedArtifactId;
    const candidate = backendCandidateCache.get(`${artifactId}:${extractionId}`)?.candidate ||
      backendCandidateCache.get(extractionId)?.candidate || {
        id: extractionId,
        document_id: artifactId,
        document_name: artifactId,
        document_type: 'OTHER' as DocumentType,
        page_number: 1,
        field_key: 'unknown',
        field_label: 'Unknown Field',
        raw_text: '',
        normalized_value: adjustedValue ?? '',
        unit: '',
        phase_scope: 'UNKNOWN',
        method: 'RULE_BASED' as const,
        review_status: 'PENDING' as const,
      };

    try {
      if (decision === 'ACCEPTED') {
        const body = {
          reviewer_id: 'local-reviewer',
          notes:
            adjustedValue !== undefined
              ? `Confirmed with adjusted value: ${adjustedValue}`
              : 'Confirmed by human reviewer',
          modified_value: adjustedValue !== undefined ? String(adjustedValue) : undefined,
          modified_numeric_value:
            typeof adjustedValue === 'number'
              ? adjustedValue
              : adjustedValue !== undefined && !isNaN(Number(adjustedValue))
                ? Number(adjustedValue)
                : undefined,
          is_simulated: true,
          review_outcome: null, // Strict invariant: confirmation produces DOCUMENTED status
        };

        await apiClient.post(
          `/evidence/${artifactId}/extractions/${extractionId}/confirm`,
          body
        );

        const updated: ExtractionCandidate = {
          ...candidate,
          review_status: adjustedValue !== undefined ? 'MODIFIED' : 'ACCEPTED',
          normalized_value: adjustedValue !== undefined ? adjustedValue : candidate.normalized_value,
        };
        backendCandidateCache.set(extractionId, { candidate: updated, artifactId });
        return updated;
      } else {
        const body = {
          reviewer_id: 'local-reviewer',
          notes: 'Rejected by reviewer during extraction review',
        };

        await apiClient.post(
          `/evidence/${artifactId}/extractions/${extractionId}/reject`,
          body
        );

        const updated: ExtractionCandidate = {
          ...candidate,
          review_status: 'REJECTED',
        };
        backendCandidateCache.set(extractionId, { candidate: updated, artifactId });
        return updated;
      }
    } catch (err) {
      throw new Error(extractErrorMessage(err, 'Failed to record extraction review decision.'), { cause: err });
    }
  },

  resetMocks() {
    artifactsStore = [...INITIAL_MOCK_ARTIFACTS];
    assertionsStore = [...INITIAL_MOCK_ASSERTIONS];
    extractionsStore = [...INITIAL_MOCK_EXTRACTIONS];
    backendCandidateCache.clear();
    mockModeOverride = null;
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem(CANDIDATE_STORAGE_KEY);
      }
    } catch {
      // Ignore
    }
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(EVIDENCE_STORAGE_KEY);
      }
    } catch {
      // Ignore
    }
    const initial: EvidenceStoreData = {
      artifacts: [...INITIAL_MOCK_ARTIFACTS],
      assertions: [...INITIAL_MOCK_ASSERTIONS],
      extractions: [...INITIAL_MOCK_EXTRACTIONS],
    };
    saveStore(initial);
  },
};
