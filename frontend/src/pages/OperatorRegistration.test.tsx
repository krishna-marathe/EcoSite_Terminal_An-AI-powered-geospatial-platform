import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { OperatorRegistration } from './OperatorRegistration';
import type { RestrictedSubmission } from '../components/workflows/types';

const { maps } = vi.hoisted(() => ({ maps: [] as Array<{ emit: (name: string, event?: unknown) => void }> }));
vi.mock('maplibre-gl', () => ({
  Map: class {
    listeners = new Map<string, Set<(event: unknown) => void>>();
    constructor() { maps.push(this as { emit: (name: string, event?: unknown) => void }); }
    addControl() {}
    on(name: string, callback: (event: unknown) => void) { if (!this.listeners.has(name)) this.listeners.set(name, new Set()); this.listeners.get(name)!.add(callback); }
    off(name: string, callback: (event: unknown) => void) { this.listeners.get(name)?.delete(callback); }
    emit(name: string, event: unknown = {}) { this.listeners.get(name)?.forEach((callback) => callback(event)); }
    resize() {}
    easeTo() {}
    remove() { this.listeners.clear(); }
  },
  Marker: class { setLngLat() { return this; } addTo() { return this; } remove() {} },
  AttributionControl: class {},
}));

beforeEach(() => vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} }));
afterEach(() => { cleanup(); maps.length = 0; vi.unstubAllGlobals(); });

const submission: RestrictedSubmission = {
  id: 'sub-1', status: 'draft', revision: 2, facilityName: 'Private Campus', operatorOrganisationId: 'org-1', facilityType: 'colocation', stateCode: 'IN-MH', city: 'Mumbai', locality: 'Chandivali', exactGeometry: { type: 'Point', coordinates: [72.889432, 19.112345] }, capacityDisclosures: [{ value: 20, unit: 'MW', capacityType: 'it_load', scope: 'facility' }], evidence: [{ evidenceType: 'source_url', title: 'Operator facility page', reference: 'https://operator.example/campus' }], createdAt: '2026-10-29T09:00:00Z', updatedAt: '2026-10-29T09:10:00Z', submittedAt: null, assignedReviewerId: null,
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

it('adds typed capacity, evidence and a restricted point to a private draft', () => {
  const onSave = vi.fn();
  render(<OperatorRegistration onSave={onSave} />);
  fireEvent.change(screen.getByLabelText(/Facility name/), { target: { value: 'Evidence Campus' } });
  fireEvent.change(screen.getByLabelText(/City/), { target: { value: 'Hyderabad' } });
  fireEvent.change(screen.getByLabelText(/Locality/), { target: { value: 'HITEC City' } });
  fireEvent.click(screen.getByRole('button', { name: /Add capacity disclosure/ }));
  fireEvent.change(screen.getByLabelText('Value'), { target: { value: '32.5' } });
  fireEvent.change(screen.getByLabelText('Measurement scope'), { target: { value: 'Campus IT load' } });
  fireEvent.click(screen.getByRole('button', { name: /Add evidence/ }));
  fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Operator specification' } });
  fireEvent.change(screen.getByLabelText('Public source URL'), { target: { value: 'https://operator.example/specification' } });
  act(() => maps.at(-1)?.emit('click', { lngLat: { lng: 78.3812344, lat: 17.4412344 } }));
  fireEvent.click(screen.getByRole('button', { name: 'Create private draft' }));
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
    exactGeometry: { type: 'Point', coordinates: [78.381234, 17.441234] },
    capacityDisclosures: [{ value: 32.5, unit: 'MW', capacityType: 'it_load', scope: 'Campus IT load' }],
    evidence: [{ evidenceType: 'source_url', title: 'Operator specification', reference: 'https://operator.example/specification' }],
  }), undefined);
});

it('shows revision status and sends an existing draft for review', () => {
  const onSubmit = vi.fn();
  render(<OperatorRegistration submission={submission} onSubmitForReview={onSubmit} />);
  expect(screen.getByText('Status draft · revision 2')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Submit for ministry review' }));
  expect(onSubmit).toHaveBeenCalledWith(submission);
});

it('keeps an incomplete saved draft out of ministry review', () => {
  render(<OperatorRegistration submission={{ ...submission, capacityDisclosures: [], evidence: [] }} />);
  expect(screen.getByText('Review requirements incomplete')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Submit for ministry review' })).toBeDisabled();
});
