import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MinistryReview } from './MinistryReview';
import type { PublicSnapshotPreview, RestrictedSubmission, ReviewQueueItem } from '../components/workflows/types';

afterEach(cleanup);

const queue: ReviewQueueItem[] = [{ id: 'sub-1', status: 'submitted', revision: 3, facilityName: 'Example Campus', operatorOrganisationId: 'org-1', stateCode: 'IN-MH', city: 'Mumbai', submittedAt: '2026-10-29T09:30:00Z', assignedReviewerId: null }];
const selected: RestrictedSubmission = { id: 'sub-1', status: 'submitted', revision: 3, facilityName: 'Example Campus', operatorOrganisationId: 'org-1', facilityType: 'colocation', stateCode: 'IN-MH', city: 'Mumbai', locality: 'Chandivali', exactGeometry: { type: 'Point', coordinates: [72.889432, 19.112345] }, capacityDisclosures: [], evidence: [], createdAt: '2026-10-29T09:00:00Z', updatedAt: '2026-10-29T09:30:00Z', submittedAt: '2026-10-29T09:30:00Z', assignedReviewerId: null };
const preview: PublicSnapshotPreview = { id: 'example-campus', name: 'Example Campus', operator: 'Example Operator', ownershipCategory: 'private', facilityType: 'colocation', state: 'Maharashtra', stateCode: 'IN-MH', city: 'Mumbai', locality: 'Chandivali', publicCoordinates: [72.889, 19.112], locationPrecision: 'locality', operationalSince: 2026, capacityDisclosures: [], verification: { status: 'government_verified', verifiedAt: '2026-10-29', expiresAt: '2027-01-27', source: { title: 'Reviewed submission', publisher: 'EcoSite reviewer', url: 'https://example.gov/review', sourceClass: 'government', retrievedAt: '2026-10-29' } } };

it('keeps exact coordinates out of the review queue', () => {
  const onSelect = vi.fn();
  render(<MinistryReview queue={queue} onSelect={onSelect} />);
  expect(screen.getByText('Example Campus')).toBeTruthy();
  expect(screen.queryByText('72.889432')).toBeNull();
  expect(screen.queryByText('19.112345')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /Example Campus/ }));
  expect(onSelect).toHaveBeenCalledWith('sub-1');
});

it('separates restricted detail from generalized public preview and approves the latter', () => {
  const onAction = vi.fn();
  render(<MinistryReview queue={queue} selected={selected} publicPreview={preview} onAction={onAction} />);
  expect(screen.getByText('72.889432')).toBeTruthy();
  expect(screen.getByText('19.112345')).toBeTruthy();
  expect(screen.getByText('72.889')).toBeTruthy();
  expect(screen.getByText('19.112')).toBeTruthy();
  expect(screen.getByText(/only location representation proposed for publication/)).toBeTruthy();
  fireEvent.change(screen.getByLabelText(/Decision reason/), { target: { value: 'Evidence reviewed.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Approve and publish' }));
  expect(onAction).toHaveBeenCalledWith(selected, { action: 'approve', reason: 'Evidence reviewed.', publicSnapshot: preview });
});

it('requires a decision reason before ministry actions are enabled', () => {
  render(<MinistryReview queue={queue} selected={selected} publicPreview={preview} />);
  expect(screen.getByRole('button', { name: 'Approve and publish' }).hasAttribute('disabled')).toBe(true);
  expect(screen.getByRole('button', { name: 'Reject' }).hasAttribute('disabled')).toBe(true);
});
