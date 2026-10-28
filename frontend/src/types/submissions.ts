import type { PublicCapacityDisclosure, PublicFacility, PublicFacilityType, PublicStateCode } from './publicFacilities';

export type SubmissionStatus = 'draft' | 'submitted' | 'information_requested' | 'resubmitted' | 'approved' | 'rejected' | 'withdrawn';
export interface ExactPointGeometry { type: 'Point'; coordinates: [number, number] }
export interface SubmissionEvidence {
  evidenceType: 'source_url' | 'document_reference';
  title: string;
  reference: string;
  fileSha256?: string | null;
}
export interface SubmissionCreate {
  facilityName: string;
  operatorOrganisationId: string;
  facilityType: PublicFacilityType;
  stateCode: PublicStateCode;
  city: string;
  locality: string;
  exactGeometry: ExactPointGeometry;
}
export interface SubmissionPatch {
  expectedRevision: number;
  facilityName?: string;
  facilityType?: PublicFacilityType;
  stateCode?: PublicStateCode;
  city?: string;
  locality?: string;
  exactGeometry?: ExactPointGeometry;
  capacityDisclosures?: PublicCapacityDisclosure[];
  evidence?: SubmissionEvidence[];
}
export interface FacilitySubmission extends SubmissionCreate {
  id: string;
  status: SubmissionStatus;
  revision: number;
  capacityDisclosures: PublicCapacityDisclosure[];
  evidence: SubmissionEvidence[];
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  assignedReviewerId: string | null;
}
export interface ReviewQueueItem {
  id: string;
  status: SubmissionStatus;
  revision: number;
  facilityName: string;
  operatorOrganisationId: string;
  stateCode: PublicStateCode;
  city: string;
  submittedAt: string | null;
  assignedReviewerId: string | null;
}
export interface ReviewQueue { items: ReviewQueueItem[]; page: number; pageSize: number; total: number }
export type ReviewAction = 'request_information' | 'reject' | 'approve';
export interface ReviewActionRequest {
  expectedRevision: number;
  action: ReviewAction;
  reason: string;
  requestedFields?: string[];
  publicSnapshot?: PublicFacility;
}
export interface ReviewResult {
  submissionId: string;
  status: SubmissionStatus;
  revision: number;
  decision: { action: ReviewAction; reason: string | null; decidedAt: string; decidedBy: string };
  publishedFacilityId: string | null;
  publicSnapshotVersion: number | null;
}
