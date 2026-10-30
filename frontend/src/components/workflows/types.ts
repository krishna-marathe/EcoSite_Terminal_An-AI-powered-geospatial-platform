import type { MinistryOverview, MinistrySourceHealth, MinistryStateSummary, FacilityFreshness } from '../../types/ministryOperations';
import type { PublicCapacityDisclosure, PublicFacility, PublicFacilityType, PublicStateCode } from '../../types/publicFacilities';
import type { ExactPointGeometry, FacilitySubmission, ReviewQueueItem as ApiReviewQueueItem, SubmissionCreate, SubmissionStatus as ApiSubmissionStatus } from '../../types/submissions';

export type DemoRole = 'operator' | 'ministry_reviewer';
export type WorkflowStateCode = PublicStateCode;
export type WorkflowFacilityType = PublicFacilityType;
export type SubmissionStatus = ApiSubmissionStatus;
export type CapacityDisclosureInput = PublicCapacityDisclosure;
export type SubmissionDraftInput = SubmissionCreate;
export type RestrictedSubmission = FacilitySubmission;
/** The API queue type deliberately excludes exactGeometry and evidence. */
export type ReviewQueueItem = ApiReviewQueueItem;
export type PublicSnapshotPreview = PublicFacility;
export type MinistryStateSummaryData = MinistryStateSummary;
export type SourceHealthItem = MinistrySourceHealth;
export type FreshnessQueueItem = FacilityFreshness;
export type MinistryOverviewData = MinistryOverview;
export type { ExactPointGeometry };

export type ReviewAction =
  | { action: 'request_information'; reason: string; requestedFields: string[] }
  | { action: 'reject'; reason: string }
  | { action: 'approve'; reason: string; publicSnapshot: PublicSnapshotPreview };
