import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { ExternalLink, RefreshCw } from 'lucide-react';
import { apiClient, expectArray } from '../../services/api';
import { DataModeBadge } from '../ui/Badge';
import { IconButton } from '../ui/Button';
import { EmptyState, ErrorState, LoadingSkeleton } from '../ui/StateViews';

interface NewsItem { title: string; url: string; source: string; publishedAt: string; summary?: string; dataStatus?: string }

type NewsStatus = 'loading' | 'ready' | 'error';

const isNewsItem = (value: unknown): value is NewsItem => {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.title === 'string' &&
    typeof item.url === 'string' &&
    typeof item.source === 'string' &&
    typeof item.publishedAt === 'string'
  );
};

const newsErrorCause = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    if (!error.response) return 'The EcoSite backend is not reachable. Start it and retry.';
    const body = error.response.data;
    if (typeof body === 'string' && /^\s*</.test(body)) {
      return 'The API URL returned HTML instead of JSON. Another service may be occupying port 8000; start the EcoSite backend on that port and retry.';
    }
    return `The news relay returned HTTP ${error.response.status}. Verify backend and outbound feed access.`;
  }
  return error instanceof Error ? error.message : 'The RSS relay could not be reached.';
};

export const PolicyNewsPanel: React.FC = () => {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [status, setStatus] = useState<NewsStatus>('loading');
  const [errorCause, setErrorCause] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  // Fetch inside the effect; state is only set from async callbacks so no
  // synchronous setState runs during the effect body.
  useEffect(() => {
    let active = true;
    apiClient
      .get<unknown>('/news', { params: { q: 'environmental policy climate regulation India', limit: 8 } })
      .then((response) => {
        if (!active) return;
        if (typeof response.data === 'string') {
          throw new Error(
            'The API URL returned HTML instead of JSON. Another service may be occupying port 8000; start the EcoSite backend on that port and retry.'
          );
        }
        setItems(expectArray<unknown>(response.data, 'News feed').filter(isNewsItem));
        setStatus('ready');
      })
      .catch((error: unknown) => {
        if (!active) return;
        setItems([]);
        setErrorCause(newsErrorCause(error));
        setStatus('error');
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const retry = () => {
    setErrorCause('');
    setStatus('loading');
    setReloadKey((key) => key + 1);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-eco-border px-3 py-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <DataModeBadge mode="internet" />
          <span className="truncate text-meta text-eco-muted">Internet feed — not city-specific</span>
        </div>
        <IconButton
          label="Refresh news"
          size="sm"
          disabled={status === 'loading'}
          onClick={retry}
          icon={<RefreshCw className={`h-3.5 w-3.5 ${status === 'loading' ? 'animate-spin' : ''}`} />}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {status === 'loading' && (
          <div className="p-3" role="status" aria-label="Loading policy headlines">
            <LoadingSkeleton rows={4} />
          </div>
        )}

        {status === 'error' && (
          <ErrorState
            title="Internet news unavailable"
            cause={errorCause || 'The RSS relay could not be reached. Start the backend and verify outbound feed access.'}
            onRetry={retry}
          />
        )}

        {status === 'ready' && items.length === 0 && (
          <EmptyState
            title="No policy headlines returned"
            body="The feed responded without items for this query."
            action={{ label: 'Refresh feed', onClick: retry }}
          />
        )}

        {status === 'ready' && items.length > 0 && (
          <div className="divide-y divide-eco-border/60">
            {items.map((item) => (
              <a
                key={`${item.url}-${item.publishedAt}`}
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="block space-y-1 p-3 transition-colors hover:bg-eco-surface-secondary"
              >
                <span className="flex items-start gap-2">
                  <span className="flex-1 text-body font-medium leading-snug text-eco-text">{item.title}</span>
                  <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-eco-muted" />
                </span>
                <span className="flex items-center justify-between gap-2 text-meta text-eco-muted">
                  <span className="truncate">{item.source}</span>
                  <span className="shrink-0">{item.publishedAt}</span>
                </span>
              </a>
            ))}
          </div>
        )}
      </div>

      <p className="shrink-0 border-t border-eco-border px-3 py-2 text-meta text-eco-muted">
        Headlines are links to external publishers. Validate source context before making a compliance decision.
      </p>
    </div>
  );
};
