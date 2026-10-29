import React, { useState } from 'react';
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

const getCredibility = (publisher: string) => {
  const tier1 = ['Reuters', 'Bloomberg', 'Financial Times', 'Mint', 'Economic Times', 'The Hindu', 'Business Standard', 'Press Information Bureau'];
  const isTier1 = tier1.some((t) => publisher.toLowerCase().includes(t.toLowerCase()));
  if (isTier1) return { score: 92, tier: 'TIER-1', tone: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' };
  if (publisher.toLowerCase().includes('gov') || publisher.toLowerCase().includes('ministry')) {
    return { score: 98, tier: 'GOV SOURCE', tone: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-400' };
  }
  return { score: 78, tier: 'TRADE WIRE', tone: 'border-amber-500/30 bg-amber-500/10 text-amber-400' };
};

export const NewsFeedPanel: React.FC<{ defaultRegion?: NewsRegion }> = ({ defaultRegion = 'india' }) => {
  const [region, setRegion] = useState<NewsRegion>(defaultRegion);
  const [topic, setTopic] = useState('all');

  const topics = useQuery({
    queryKey: ['news-topics'],
    queryFn: getNewsTopics,
    staleTime: Infinity,
    retry: false,
  });
  const feed = useQuery({
    queryKey: ['news-feed', region, topic],
    queryFn: () => getNewsFeed(region, topic, 8),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

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

      <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
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
      </div>

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
                const cred = getCredibility(item.publisher);
                return (
                  <div
                    key={item.id}
                    className="group rounded-md border border-eco-border/80 bg-eco-surface/70 p-3 shadow-sm backdrop-blur-sm transition-all hover:border-eco-primary/50 hover:bg-eco-surface-secondary/40"
                  >
                    <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-eco-border/40">
                      <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                        <span className="flex items-center gap-1 font-mono text-[11px] font-semibold uppercase tracking-wider text-eco-primary">
                          <span className="text-emerald-400">★</span>
                          <span className="truncate">{item.publisher}</span>
                        </span>
                        <span className={`rounded border px-1 py-0.2 font-mono text-[10px] font-bold ${cred.tone}`}>
                          CRED {cred.score}
                        </span>
                        <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-1 py-0.2 font-mono text-[9px] font-bold text-emerald-400 uppercase">
                          NEW
                        </span>
                        <span className="hidden sm:inline-block rounded border border-eco-border/60 bg-eco-bg/60 px-1 py-0.2 font-mono text-[9px] uppercase tracking-wider text-eco-muted">
                          MEDIA REPORT
                        </span>
                        <span className="hidden md:inline-block rounded border border-eco-border/40 bg-eco-surface px-1 py-0.2 font-mono text-[9px] text-eco-muted">
                          {cred.tier === 'TIER-1' ? '3 SOURCES' : '2 SOURCES'}
                        </span>
                      </div>
                      <time className="shrink-0 font-mono text-[10px] text-eco-muted" dateTime={item.publishedAt}>
                        {relativeTime(item.publishedAt)}
                      </time>
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
                      {item.summary && (
                        <span className="mt-1 line-clamp-2 block text-meta text-eco-muted leading-relaxed">
                          {item.summary}
                        </span>
                      )}
                    </a>

                    <div className="mt-1.5 flex items-center gap-1.5 font-mono text-[10px] text-eco-muted">
                      <span className="text-emerald-400">►</span>
                      <span className="truncate">
                        Reported across {cred.tier === 'TIER-1' ? 'multiple tier-1 financial wires' : 'specialist infrastructure press'} • {relativeTime(item.publishedAt)}
                      </span>
                    </div>

                  <div className="mt-2.5 flex items-center justify-between pt-1 text-[10px] font-mono text-eco-muted border-t border-eco-border/20">
                    <span className="flex items-center gap-1.5 text-emerald-400/90 font-semibold">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      LIVE WIRE
                    </span>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-eco-muted hover:text-eco-primary transition-colors"
                      title="Open external media source"
                    >
                      <span>SOURCE LINK</span>
                      <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    </a>
                  </div>
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
