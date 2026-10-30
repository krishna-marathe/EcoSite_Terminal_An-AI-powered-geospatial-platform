import type { PublicFacility } from '../types/publicFacilities';
import type { FacilitySubmission } from '../types/submissions';

const stateNames = { 'IN-MH': 'Maharashtra', 'IN-TG': 'Telangana', 'IN-KA': 'Karnataka', 'IN-TN': 'Tamil Nadu' } as const;
const dateOnly = (date: Date) => date.toISOString().slice(0, 10);

const traceableSource = (submission: FacilitySubmission) => submission.evidence.find((item) => {
  if (item.evidenceType !== 'source_url') return false;
  try {
    const url = new URL(item.reference);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
});

export function publicPreviewBlockReason(submission: FacilitySubmission | undefined): string | null {
  if (!submission) return null;
  if (!submission.capacityDisclosures.length) return 'Publication is blocked until the operator supplies at least one typed capacity disclosure.';
  if (!traceableSource(submission)) return 'Publication is blocked until the operator supplies at least one traceable source URL.';
  return null;
}

export function buildPublicPreview(submission: FacilitySubmission | undefined): PublicFacility | null {
  if (!submission) return null;
  const source = traceableSource(submission);
  if (!submission.capacityDisclosures.length || !source) return null;
  const verifiedAt = new Date();
  const expiresAt = new Date(verifiedAt);
  expiresAt.setUTCDate(expiresAt.getUTCDate() + 89);
  return {
    id: `registered-${submission.id.toLowerCase().replaceAll('_', '-').replace(/[^a-z0-9-]/g, '')}`,
    name: submission.facilityName,
    operator: submission.operatorOrganisationId,
    ownershipCategory: 'private',
    facilityType: submission.facilityType,
    stateCode: submission.stateCode,
    state: stateNames[submission.stateCode],
    city: submission.city,
    locality: submission.locality,
    publicCoordinates: submission.exactGeometry.coordinates.map((value) => Number(value.toFixed(3))) as [number, number],
    locationPrecision: 'locality',
    capacityDisclosures: submission.capacityDisclosures,
    verification: {
      status: 'government_verified',
      verifiedAt: dateOnly(verifiedAt),
      expiresAt: dateOnly(expiresAt),
      source: {
        title: source.title,
        publisher: submission.operatorOrganisationId,
        url: source.reference,
        sourceClass: 'operator',
        retrievedAt: dateOnly(verifiedAt),
      },
    },
  };
}
