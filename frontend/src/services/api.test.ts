import axios from 'axios';
import { afterEach, expect, it, vi } from 'vitest';
import { apiErrorEnvelope, apiErrorMessage } from './api';

afterEach(() => vi.restoreAllMocks());

it('reads the standardized API error without exposing other payload shapes', () => {
  vi.spyOn(axios, 'isAxiosError').mockReturnValue(true);
  const error = { response: { data: { error: { code: 'revision_conflict', message: 'Reload.', details: {}, requestId: 'req-1' } } } };
  expect(apiErrorEnvelope(error)?.error.code).toBe('revision_conflict');
  expect(apiErrorMessage(error, 'Fallback')).toBe('Reload.');
});

it('uses an ordinary error or safe fallback for non-contract failures', () => {
  expect(apiErrorMessage(new Error('Offline'), 'Fallback')).toBe('Offline');
  expect(apiErrorMessage(null, 'Fallback')).toBe('Fallback');
});
