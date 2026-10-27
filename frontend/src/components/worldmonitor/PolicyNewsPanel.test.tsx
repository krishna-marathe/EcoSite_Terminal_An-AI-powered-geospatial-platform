import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { PolicyNewsPanel } from './PolicyNewsPanel';
import { apiClient } from '../../services/api';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it('renders a controlled error instead of crashing when the API returns HTML', async () => {
  vi.spyOn(apiClient, 'get').mockResolvedValue({ data: '<!doctype html><html></html>' } as never);

  render(<PolicyNewsPanel />);

  expect(await screen.findByText('Internet news unavailable')).toBeTruthy();
  expect(screen.getByText(/returned HTML instead of JSON/i)).toBeTruthy();
});

it('renders a JSON list and ignores malformed entries', async () => {
  vi.spyOn(apiClient, 'get').mockResolvedValue({
    data: [
      { title: 'Valid headline', url: 'https://example.test/a', source: 'Example', publishedAt: 'today' },
      { title: 'Missing url', source: 'Example', publishedAt: 'today' },
    ],
  } as never);

  render(<PolicyNewsPanel />);

  expect(await screen.findByText('Valid headline')).toBeTruthy();
  expect(screen.queryByText('Missing url')).toBeNull();
});
