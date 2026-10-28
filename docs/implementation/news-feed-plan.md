# Data-centre news feed — implementation plan

Status: proposal only. No code has been changed.
Scope: a real, sourced media feed in the dashboard, segmented into **India** and
**World**, relevant to data-centre oversight (policy, grid, water, environment,
investment, benchmarks).

## 1. Product guardrails

News is **context, not evidence**. The feed must never:

- influence risk scores, suitability, verification status or publication;
- present a headline as a verified fact or imply ministry endorsement;
- store or republish full article text, images or paywalled content;
- invent items, timestamps or publishers.

It must:

- keep publisher, canonical URL, publication timestamp and provider;
- label every panel "Media report — not verified evidence";
- state coverage honestly (`FRESH`, `STALE`, `NOT_COVERED`) instead of an empty
  list that reads as "no news exists";
- link out only, with `rel="noreferrer"`, and keep excerpts ≤ 280 characters.

## 2. What exists today

- `backend/app/main.py` exposes `GET /api/v1/news` as a Google News RSS relay:
  arbitrary `q` from the browser, 8 s timeout, no cache, no dedupe, no tests,
  and a 503 detail that includes the raw exception string.
- `frontend/src/components/worldmonitor/PolicyNewsPanel.tsx` fetches that route
  with a hardcoded query. It is only referenced by `EcoWorkspace`, which the
  current dashboard no longer imports — so the existing news UI is unreachable.
- The dashboard's live panels live in `frontend/src/components/data-centre-dashboard/`
  and are composed in `pages/Dashboard.tsx` (`grid_only` and `split` views).

The existing endpoint should be **replaced**, not extended: browser-supplied
queries are an abuse vector and the provider key must never reach the client.

## 3. Provider decision (Phase 0 gate)

Recommended option: **Webz.io News Search API** — dedicated news search with
publisher metadata, excerpts and global coverage including India, callable
server-side over HTTPS JSON.

Tradeoff: its free tier is trial/volume-limited rather than permanent, so quota
and pricing must be confirmed before committing. Keep the choice isolated behind
an adapter so a swap is config-only.

Alternatives:

- **Exa** — semantic web search with free monthly credits; better for discovery,
  weaker on structured publisher metadata and "news" semantics.
- **Existing Google News RSS relay** — zero cost, no key, already written; lower
  metadata quality and no SLA. Keep as the no-budget fallback so the dashboard is
  never blocked on procurement.

Configuration (backend only, never Vite):

```
ECOSITE_NEWS_PROVIDER=webz | rss | disabled   # default: disabled
WEBZ_API_TOKEN=<secret>
ECOSITE_NEWS_CACHE_TTL_MINUTES=15
ECOSITE_NEWS_MAX_ITEMS=12
```

`disabled` is the fail-closed default: the panel then renders "News context is
not configured" instead of an error.

## 4. Relevance model (India vs World)

Topic catalogue in `data/news_topics.json`, editable without a deploy:

| Topic key | India queries | World queries |
|---|---|---|
| `dc_policy` | data centre policy India; Maharashtra/Telangana/Karnataka/Tamil Nadu IT & data-centre policy | data centre regulation; AI infrastructure policy |
| `energy_grid` | data centre power demand grid India; discom capacity | data centre grid connection; electricity moratorium |
| `water_cooling` | data centre water use cooling India | data centre water stress cooling |
| `environment` | data centre environmental clearance; air quality | environmental impact data centre |
| `investment` | hyperscale data centre investment India; semiconductor fab | hyperscaler capex; sovereign AI infrastructure |
| `benchmarks` | — | EU Energy Efficiency Directive; Singapore/Ireland/Amsterdam data-centre rules |

Rule-based ranking, no ML:

1. topic match weight (title match > excerpt match);
2. recency decay (drop older than 30 days);
3. publisher tier (government/regulator/PIB > wire service > general outlet);
4. dedupe, then cap 8–12 items per region.

Region assignment uses provider source-country metadata when present, otherwise
the query bucket. Do not infer region from the headline language.

Dedupe:

- canonical URL: strip query/fragment/tracking, lowercase host and path;
- `title_key`: lowercase, punctuation-stripped, whitespace-collapsed;
- then Jaccard token overlap ≥ 0.8 against already-kept items;
- keep the higher publisher tier, then the earlier timestamp.

Reject non-`http(s)` links, homepage/tag URLs and items without a publisher.

## 5. Backend design

New modules, following the existing service/repository split:

- `backend/app/services/news.py`
  - `NewsProvider` protocol: `fetch(topic, region, limit) -> list[NewsItem]`.
  - `WebzNewsProvider` (httpx, 10 s timeout, one retry on 429/5xx with backoff,
    token from env, never logged).
  - `GoogleNewsRssProvider` (existing parsing moved here).
  - `NullNewsProvider` for `disabled`.
  - `NewsNormalizer` + `dedupe()` + `rank()` as pure functions for testing.
- `backend/app/schemas/news.py`
  - `NewsItem { id, title, url, publisher, publishedAt, summary, region, topics,
    provider, mediaClass: "MEDIA_REPORT", retrievedAt }`
  - `NewsFeedPage { region, topic, generatedAt, items, coverage, provider,
    sourceHealth }`
- `backend/app/routers/news.py`
  - `GET /api/v1/news/feed?region=india|world&topic=<enum>&limit=1..12`
  - `GET /api/v1/news/topics`
  - no free-text `q` from the browser; enum-validated params; `Cache-Control`
    and `ETag`; error envelope from `ApiError`; never echo provider errors.
- `backend/app/services/news_sqlalchemy.py` + migration `04d_001_news_feed.py`
  - `news_items`: id, canonical_url, title_key, title, url, publisher,
    published_at, summary, region, provider, topics (JSON), first_seen_at,
    last_seen_at; unique `(canonical_url)` and index `(region, published_at)`.
  - `news_fetch_runs`: run_id, provider, region, topic, status, item_count,
    error_class, started_at, finished_at — mirrors environmental ingestion runs.
- `backend/app/jobs/news_ingestion.py` + `backend/scripts/refresh_news.py`
  - refresh every 15 minutes via the OS scheduler (same pattern as the existing
    environmental connector job);
  - the dashboard reads the cache only, so provider latency and rate limits
    never reach the browser;
  - record success/partial/failed per run; expose last success in source health.
- Retention: purge items older than 90 days and runs older than 30 days in the
  existing maintenance script.
- Rate limiting: simple per-IP token bucket on `/news/feed` (60 req/min) or a
  CDN rule; the cache already bounds provider spend.

## 6. Frontend design

New `frontend/src/components/news/`:

- `NewsFeedPanel.tsx` — card with India/World segmented control (`role="tablist"`),
  topic chips, refresh, coverage badge, disclaimer footer.
- `NewsItemRow.tsx` — headline link, publisher, relative time, external-link icon.
- `useNewsFeed.ts` — React Query `['news-feed', region, topic]`, `staleTime`
  equal to the backend TTL, `placeholderData` to avoid flicker on tab switch.

Placement in `pages/Dashboard.tsx`:

- `grid_only`: fifth panel spanning both columns.
- `split`: a card in the right rail below ministry operations.
- `map_only`: unchanged initially; optional toolbar button + slide-over later.

States: loading skeleton, error with retry, `NOT_COVERED` ("No media coverage
matched these topics"), `STALE` (cached items + "last refreshed" timestamp).
Cap visible items at 8 per region, with a "more" link to a filterable view if
needed later.

## 7. Tests

Backend (unittest, mocked provider via recorded fixtures):

- normalization of Webz and RSS payloads, including missing fields and bad dates;
- canonical-URL and near-duplicate dedupe, ranking order;
- cache hit performs zero provider calls; expired TTL refetches;
- run records success/partial/failed; 429/500 becomes `STALE`/unavailable with
  no token or upstream message in the response;
- route validation: bad region/topic/limit → 422 envelope; no `q` passthrough;
- retention purge.

Frontend:

- India/World tabs request the right params; topic chips filter;
- renders publisher and working external link; loading/error/not-covered states;
- stale badge and last-refreshed timestamp;
- refresh triggers refetch.

Manual acceptance:

- unset `WEBZ_API_TOKEN` → "not configured" state, no crash;
- provider outage → cached items with `STALE`, never a fake empty feed;
- spot-check 5 headlines against their publishers before sign-off.

## 8. Phases and effort

| Phase | Work | Estimate |
|---|---|---|
| 0 | Provider decision, token, ToS/quota confirmation | 0.5 day |
| 1 | Migration, adapters, normalizer, cache, job, route, tests | 1–1.5 days |
| 2 | Dashboard panel, hook, states, tests | 1 day |
| 3 | Scheduled refresh, source health, retention | 0.5 day |
| 4 (optional) | Per-state India tab, saved filters, similarity tuning | 1 day |

Acceptance: dashboard shows 8 India and 8 World items from at least three
publishers each; every item links out and carries a publisher and timestamp;
no provider credential or upstream error appears in any response; backend and
frontend suites pass.

## 9. Risks

- **Cost/quota** — the tracked provider is trial-limited; the RSS fallback keeps
  the feature free but lower quality.
- **Headline quality and bias** — mitigated by media-report labelling, linking
  to the publisher and excluding news from all scoring/publication paths.
- **Copyright/ToS** — metadata and short excerpts only; no full text, images or
  caching of article bodies.
- **Staleness** — the 15-minute cache and `STALE` badge make outages visible.
- **Abuse** — server-side fixed queries only, bounded limits, per-IP throttling.
- **Coverage gaps** — world coverage for state-level Indian policy will be thin;
  the UI must say `NOT_COVERED` rather than pad the list.
