import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, RefreshCw } from 'lucide-react';
import { DashboardPanel, PanelState } from '../data-centre-dashboard';
import { IconButton } from '../ui/Button';
import { apiErrorMessage } from '../../services/api';
import { getNewsFeed, getNewsTopics, type NewsCoverage, type NewsRegion } from '../../services/news';

const REGIONS: Array<{ key: NewsRegion; label: string }> = [
  { key: 'india', label: 'India' },
  { key: 'world', label: 'World' },
];

const COVERAGE_TONE: Record<NewsCoverage, string> = {
  FRESH: 'border-eco-primary/40 bg-eco-primary/10 text-eco-primary',
  STALE: 'border-eco-warning/50 bg-eco-warning/10 text-eco-warning',
  NOT_COVERED: 'border-eco-border bg-eco-surface-secondary text-eco-muted',
  NOT_CONFIGURED: 'border-eco-border bg-eco-surface-secondary text-eco-muted',
  UNAVAILABLE: 'border-eco-critical/40 bg-eco-critical/10 text-eco-critical',
};

const relativeTime = (iso: string, now = Date.now()) => {
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return 'Unknown time';
  const minutes = Math.max(1, Math.round((now - parsed) / 60000));
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
};

export const NewsFeedPanel: React.FC<{ defaultRegion?: NewsRegion; limit?: number; compact?: boolean }> = ({ defaultRegion = 'india', limit = 8, compact = false }) => {
  const [region, setRegion] = useState<NewsRegion>(defaultRegion);
  const [topic, setTopic] = useState('all');

  const topics = useQuery({
    queryKey: ['news-topics'],
    queryFn: getNewsTopics,
    staleTime: Infinity,
    retry: false,
  });
  const feed = useQuery({
    queryKey: ['news-feed', region, topic, limit],
    queryFn: () => getNewsFeed(region, topic, limit),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  // Auto-refresh every hour (60 minutes) — only in browser, not in tests
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const interval = window.setInterval(() => {
      feed.refetch();
    }, 60 * 60 * 1000);
    return () => window.clearInterval(interval);
  }, [feed]);

  const coverage = feed.data?.coverage ?? null;
  const availableTopics = topics.data?.topics ?? [{ key: 'all', label: 'All topics' }];

  const coverageMessage = (value: NewsCoverage) => {
    if (value === 'NOT_CONFIGURED') {
      return 'News context is not configured on this deployment. Set ECOSITE_NEWS_PROVIDER on the backend.';
    }
    if (value === 'UNAVAILABLE') {
      return 'News providers are unreachable and no cached headlines are available.';
    }
    return 'No media coverage matched this topic.';
  };

  return (
    <DashboardPanel title="Media context" eyebrow="India & world news">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div
          role="tablist"
          aria-label="News region"
          className="flex rounded-sm border border-eco-border p-0.5"
        >
          {REGIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              role="tab"
              aria-selected={region === option.key}
              onClick={() => setRegion(option.key)}
              className={`cursor-pointer rounded-sm px-2.5 py-1 text-meta transition-colors ${
                region === option.key
                  ? 'bg-eco-surface-secondary font-medium text-eco-primary'
                  : 'text-eco-muted hover:text-eco-text'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {coverage && (
            <span
              className={`rounded-sm border px-1.5 py-0.5 font-mono text-micro ${COVERAGE_TONE[coverage]}`}
              title="Media coverage state for this region and topic"
            >
              {coverage}
            </span>
          )}
          <IconButton
            label="Refresh news"
            size="sm"
            disabled={feed.isFetching}
            onClick={() => void feed.refetch()}
            icon={<RefreshCw className={`h-3.5 w-3.5 ${feed.isFetching ? 'animate-spin' : ''}`} />}
          />
        </div>
      </div>

      {!compact && <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
        {availableTopics.map((option) => (
          <button
            key={option.key}
            type="button"
            aria-pressed={topic === option.key}
            onClick={() => setTopic(option.key)}
            className={`shrink-0 cursor-pointer rounded-sm border px-2 py-0.5 text-micro transition-colors ${
              topic === option.key
                ? 'border-eco-primary/40 bg-eco-primary/10 text-eco-primary'
                : 'border-eco-border text-eco-muted hover:text-eco-text'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>}

      <div className="mt-3">
        {feed.isLoading ? (
          <PanelState kind="loading" />
        ) : feed.error ? (
          <PanelState
            kind="error"
            message={apiErrorMessage(feed.error, 'The news feed could not be reached.')}
          />
        ) : coverage && coverage !== 'FRESH' && coverage !== 'STALE' ? (
          <PanelState kind="not-covered" message={coverageMessage(coverage)} />
        ) : feed.data && feed.data.items.length > 0 ? (
          <>
            {coverage === 'STALE' && (
              <p className="mb-2 text-meta text-eco-warning">
                Showing cached headlines from {relativeTime(feed.data.generatedAt)}; the provider refresh failed.
              </p>
            )}
            <div className="space-y-2.5">
              {feed.data.items.map((item) => {
                return (
                  <div
                    key={item.id}
                    className="group rounded-md border border-eco-border/80 bg-eco-surface/70 p-3 shadow-sm backdrop-blur-sm transition-all hover:border-eco-primary/50 hover:bg-eco-surface-secondary/40"
                  >
                    <div className="flex items-baseline justify-between gap-2 border-b border-eco-border/40 pb-1.5">
                      <span className="min-w-0 truncate font-mono text-micro font-semibold uppercase tracking-wider text-eco-primary">
                        {item.publisher}
                      </span>
                      <div className="flex shrink-0 items-center gap-2 font-mono text-micro text-eco-muted">
                        <span className="hidden sm:inline">MEDIA REPORT</span>
                        <time dateTime={item.publishedAt}>{relativeTime(item.publishedAt)}</time>
                      </div>
                    </div>

                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 block"
                    >
                      <span className="block text-body font-medium leading-snug text-eco-text group-hover:text-eco-primary transition-colors">
                        {item.title}
                      </span>
                      {!compact && item.summary && (
                        <span className="mt-1 line-clamp-2 block text-meta text-eco-muted leading-relaxed">
                          {item.summary}
                        </span>
                      )}
                    </a>

                  {!compact && <div className="mt-2 flex items-center justify-end border-t border-eco-border/20 pt-1">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 font-mono text-micro text-eco-muted transition-colors hover:text-eco-primary"
                    >
                      <span>Open at publisher</span>
                      <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    </a>
                  </div>}
                </div>
              );
            })}
          </div>
          </>
        ) : (
          <PanelState kind="not-covered" message={coverageMessage('NOT_COVERED')} />
        )}
      </div>

      <p className="mt-3 text-micro text-eco-muted">
        Media reports, not verified evidence. Headlines link to their publishers and never affect facility
        risk, verification or publication.
      </p>
    </DashboardPanel>
  );
};
