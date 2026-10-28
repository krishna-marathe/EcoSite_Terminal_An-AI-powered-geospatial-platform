import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { OperatorRegistration } from './OperatorRegistration';
import type { RestrictedSubmission } from '../components/workflows/types';

afterEach(cleanup);

const submission: RestrictedSubmission = {
  id: 'sub-1', status: 'draft', revision: 2, facilityName: 'Private Campus', operatorOrganisationId: 'org-1', facilityType: 'colocation', stateCode: 'IN-MH', city: 'Mumbai', locality: 'Chandivali', exactGeometry: { type: 'Point', coordinates: [72.889432, 19.112345] }, capacityDisclosures: [], evidence: [], createdAt: '2026-10-29T09:00:00Z', updatedAt: '2026-10-29T09:10:00Z', submittedAt: null, assignedReviewerId: null,
};

it('labels exact coordinates as restricted and submits a private draft', () => {
  const onSave = vi.fn();
  render(<OperatorRegistration onSave={onSave} />);
  expect(screen.getByText('Restricted exact location')).toBeTruthy();
  fireEvent.change(screen.getByLabelText(/Facility name/), { target: { value: 'New Campus' } });
  fireEvent.change(screen.getByLabelText(/City/), { target: { value: 'Pune' } });
  fireEvent.change(screen.getByLabelText(/Locality/), { target: { value: 'Hinjawadi' } });
  fireEvent.change(screen.getByLabelText(/Longitude/), { target: { value: '73.733' } });
  fireEvent.change(screen.getByLabelText(/Latitude/), { target: { value: '18.591' } });
  fireEvent.click(screen.getByRole('button', { name: 'Create private draft' }));
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ facilityName: 'New Campus', exactGeometry: { type: 'Point', coordinates: [73.733, 18.591] } }), undefined);
  expect(screen.getByText(/not government verification/)).toBeTruthy();
});

it('shows revision status and sends an existing draft for review', () => {
  const onSubmit = vi.fn();
  render(<OperatorRegistration submission={submission} onSubmitForReview={onSubmit} />);
  expect(screen.getByText('Status draft · revision 2')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Submit for ministry review' }));
  expect(onSubmit).toHaveBeenCalledWith(submission);
});
