/**
 * Eco Terminal — Evidence, Document & Assertion Service
 *
 * Author: Omar (Frontend & UX Lead)
 * Handles uploading artifacts, listing assertions, and review actions.
 */

import { apiClient } from './api';
import type {
  EvidenceArtifact,
  Assertion,
  AssertionStatus,
  DocumentType,
  ExtractionCandidate,
  AssertionReviewRequest,
} from '../types/evidence';

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
    issuer: 'Eco Terminal Engineering Consultants',
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
    asserted_by: 'Eco Terminal Engineering Consultants',
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

export const evidenceService = {
  async getArtifacts(projectId: string): Promise<EvidenceArtifact[]> {
    try {
      const response = await apiClient.get<EvidenceArtifact[]>(`/projects/${projectId}/evidence`);
      return response.data;
    } catch {
      const store = loadStore();
      if (!projectId) return store.artifacts;
      return store.artifacts.filter((a) => a.project_id === projectId);
    }
  },

  async uploadArtifact(
    projectId: string,
    file: File,
    metadata: {
      document_type: DocumentType;
      issuer?: string;
      reference?: string;
      valid_until?: string;
      site_id?: string;
      notes?: string;
    }
  ): Promise<EvidenceArtifact> {
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

    const store = loadStore();
    store.artifacts = [newArtifact, ...store.artifacts];
    saveStore(store);
    return newArtifact;
  },

  async getAssertions(projectId: string): Promise<Assertion[]> {
    try {
      const response = await apiClient.get<Assertion[]>(`/projects/${projectId}/assertions`);
      return response.data;
    } catch {
      const store = loadStore();
      if (!projectId) return store.assertions;
      return store.assertions.filter((a) => a.project_id === projectId);
    }
  },

  async reviewAssertion(review: AssertionReviewRequest): Promise<Assertion> {
    const store = loadStore();
    const target = store.assertions.find((a) => a.id === review.assertion_id);
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
    return updated;
  },

  async getExtractions(scopeId?: string): Promise<ExtractionCandidate[]> {
    const store = loadStore();
    if (!scopeId) return store.extractions;

    // Check if scopeId matches document_id directly
    const directMatches = store.extractions.filter((e) => e.document_id === scopeId);
    if (directMatches.length > 0) return directMatches;

    // Otherwise treat scopeId as projectId: only return extractions whose document belongs to this project
    const projectDocIds = new Set(
      store.artifacts.filter((a) => a.project_id === scopeId).map((a) => a.id)
    );
    return store.extractions.filter((e) => projectDocIds.has(e.document_id));
  },

  async confirmExtraction(
    extractionId: string,
    decision: 'ACCEPTED' | 'REJECTED',
    adjustedValue?: number | string
  ): Promise<ExtractionCandidate> {
    const store = loadStore();
    const target = store.extractions.find((e) => e.id === extractionId);
    if (!target) throw new Error('Extraction not found');

    const updated: ExtractionCandidate = {
      ...target,
      review_status: decision,
      normalized_value: adjustedValue !== undefined ? adjustedValue : target.normalized_value,
    };

    store.extractions = store.extractions.map((e) => (e.id === updated.id ? updated : e));
    saveStore(store);
    return updated;
  },

  resetMocks() {
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
