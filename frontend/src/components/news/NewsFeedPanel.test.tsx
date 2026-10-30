import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NewsFeedPanel } from './NewsFeedPanel';
import { getNewsFeed, getNewsTopics } from '../../services/news';

vi.mock('../../services/news', () => ({
  getNewsFeed: vi.fn(),
  getNewsTopics: vi.fn(),
}));

const published = '2026-10-29T08:00:00Z';

const item = (region: 'india' | 'world' = 'india', title = 'India data centre policy approved') => ({
  id: `${region}-story-1`,
  title,
  url: 'https://example.test/story',
  publisher: 'Example Wire',
  publishedAt: published,
  summary: 'A short summary.',
  region,
  topics: ['all'],
  provider: 'fake',
  mediaClass: 'MEDIA_REPORT' as const,
  retrievedAt: published,
});

const feed = (overrides: Record<string, unknown> = {}) => ({
  region: 'india' as const,
  topic: 'all',
  generatedAt: published,
  coverage: 'FRESH' as const,
  provider: 'fake',
  items: [item()],
  ...overrides,
});

function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NewsFeedPanel />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getNewsTopics).mockResolvedValue({
    regions: ['india', 'world'],
    topics: [
      { key: 'all', label: 'All topics' },
      { key: 'dc_policy', label: 'Policy & regulation' },
    ],
    catalogueVersion: '1',
  });
  vi.mocked(getNewsFeed).mockImplementation(async (region: 'india' | 'world') =>
    feed({
      region,
      items: [item(region, region === 'india' ? 'India data centre policy approved' : 'World data centre rules updated')],
    })
  );
});

describe('NewsFeedPanel', () => {
  it('renders India headlines with publisher, link and media-report disclaimer', async () => {
    renderPanel();
    const headline = await screen.findByText('India data centre policy approved');
    expect(headline.closest('a')).toHaveAttribute('href', 'https://example.test/story');
    expect(screen.getByText('Example Wire')).toBeInTheDocument();
    expect(screen.getByText('FRESH')).toBeInTheDocument();
    expect(screen.getByText(/media reports, not verified evidence/i)).toBeInTheDocument();
  });

  it('requests the world feed when the World tab is selected', async () => {
    renderPanel();
    await screen.findByText('India data centre policy approved');
    fireEvent.click(screen.getByRole('tab', { name: 'World' }));
    await screen.findByText('World data centre rules updated');
    expect(getNewsFeed).toHaveBeenCalledWith('world', 'all', 8);
  });

  it('requests the selected topic', async () => {
    renderPanel();
    await screen.findByText('India data centre policy approved');
    fireEvent.click(screen.getByRole('button', { name: 'Policy & regulation' }));
    await screen.findByText('India data centre policy approved');
    expect(getNewsFeed).toHaveBeenCalledWith('india', 'dc_policy', 8);
  });

  it('states when no media coverage matched', async () => {
    vi.mocked(getNewsFeed).mockResolvedValue(feed({ coverage: 'NOT_COVERED', items: [] }));
    renderPanel();
    expect(await screen.findByText(/No media coverage matched this topic/i)).toBeInTheDocument();
  });

  it('states when news is not configured', async () => {
    vi.mocked(getNewsFeed).mockResolvedValue(feed({ coverage: 'NOT_CONFIGURED', items: [] }));
    renderPanel();
    expect(await screen.findByText(/not configured on this deployment/i)).toBeInTheDocument();
  });

  it('shows cached headlines with a stale warning when the refresh fails', async () => {
    vi.mocked(getNewsFeed).mockResolvedValue(feed({ coverage: 'STALE' }));
    renderPanel();
    expect(await screen.findByText(/Showing cached headlines/i)).toBeInTheDocument();
    expect(screen.getByText('India data centre policy approved')).toBeInTheDocument();
  });

  it('shows an error state without fabricating items', async () => {
    vi.mocked(getNewsFeed).mockRejectedValue(new Error('News offline'));
    renderPanel();
    expect(await screen.findByRole('alert')).toHaveTextContent('News offline');
    expect(screen.queryByText('India data centre policy approved')).toBeNull();
  });
});
