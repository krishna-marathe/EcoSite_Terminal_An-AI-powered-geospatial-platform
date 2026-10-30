import { describe, expect, it, vi } from 'vitest';
import type { FacilitySubmission } from '../types/submissions';
import { buildPublicPreview, publicPreviewBlockReason } from './publicationPreview';

const submission = (overrides: Partial<FacilitySubmission> = {}): FacilitySubmission => ({
  id: 'SUB_01', status: 'submitted', revision: 2,
  facilityName: 'Operator Campus One', operatorOrganisationId: 'Example Operator Ltd', facilityType: 'colocation',
  stateCode: 'IN-MH', city: 'Mumbai', locality: 'Chandivali', exactGeometry: { type: 'Point', coordinates: [72.88881, 19.11224] },
  capacityDisclosures: [{ value: 20, unit: 'MW', capacityType: 'it_load', scope: 'Campus IT load' }],
  evidence: [{ evidenceType: 'source_url', title: 'Operator facility factsheet', reference: 'https://operator.example/facilities/campus-one' }],
  createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-29T00:00:00Z', submittedAt: '2026-10-29T00:00:00Z', assignedReviewerId: 'ministry-reviewer-demo',
  ...overrides,
});

describe('ministry public snapshot preview', () => {
  it('uses explicit evidence and capacity without inventing operational history or a localhost source', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-29T12:00:00Z'));
    const record = submission();
    const preview = buildPublicPreview(record);
    expect(preview).not.toBeNull();
    expect(preview).not.toHaveProperty('operationalSince');
    expect(preview?.capacityDisclosures).toEqual(record.capacityDisclosures);
    expect(preview?.verification.source).toMatchObject({ title: 'Operator facility factsheet', publisher: 'Example Operator Ltd', url: 'https://operator.example/facilities/campus-one', sourceClass: 'operator' });
    expect(preview?.verification.source.url).not.toContain('localhost');
    vi.useRealTimers();
  });

  it.each([
    ['capacity disclosure', { capacityDisclosures: [] }, 'capacity disclosure'],
    ['traceable source URL', { evidence: [{ evidenceType: 'document_reference' as const, title: 'Private document', reference: 'DOC-42' }] }, 'source URL'],
    ['valid source URL', { evidence: [{ evidenceType: 'source_url' as const, title: 'Broken source', reference: 'not-a-url' }] }, 'source URL'],
  ])('blocks publication when %s is absent', (_label, overrides, reason) => {
    const record = submission(overrides);
    expect(buildPublicPreview(record)).toBeNull();
    expect(publicPreviewBlockReason(record)).toContain(reason);
  });

  it('generalizes the restricted point without copying exact coordinates', () => {
    const record = submission();
    const preview = buildPublicPreview(record);
    expect(preview?.publicCoordinates).toEqual([72.889, 19.112]);
    expect(preview?.publicCoordinates).not.toEqual(record.exactGeometry.coordinates);
  });
});
