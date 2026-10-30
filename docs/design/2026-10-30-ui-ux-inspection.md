# Frontend UI/UX inspection — every page, three audiences

**Date:** 2026-10-30 · **Scope:** `frontend/src` (107 `.tsx` files, 9 live routes, 5 redirects)
**Method:** full route + component read, measured against the acceptance criteria already
committed in [`2026-10-18-frontend-clarity-spec.md`](./2026-10-18-frontend-clarity-spec.md) §9.
No browser run in this pass — findings are code-level and every one is reproducible by grep.

---

## 1. Verdict in one paragraph

The skeleton is good: one token palette, one `PageHeader`/`PageShell` pattern, one `Card`
anatomy, real error/empty/loading components, and an unusually honest risk panel. What makes
the product *hard to read for a first-time visitor* is not the design system — it is that
**three audiences are sharing one navigation**, the **instrument chrome is fabricated**
(hardcoded DEFCON/coverage/credibility numbers), and the **floor of the type scale and the
palette are both violated in exactly the files a judge or official lands on first**. Fix the
audience split and delete the fake telemetry, and the rest is a clean, bounded cleanup.

---

## 2. Measured state (vs. the spec's own acceptance criteria)

| AC | Target | Actual today | Verdict |
| --- | --- | --- | --- |
| §9.1 legacy colour utilities (`slate/sky/emerald/…`) | 0 | **246** across 13 files | ✗ |
| §9.2 hardcoded hex in `.tsx` | theme files only | **33** in 3 files | ✗ |
| §9.3 `!important` in `index.css` | 0 | **33** | ✗ |
| §9.4 raw `text-[9px]/[10px]/[11px]` | 0 (floor 12px) | **131** across 11 files | ✗ |
| §8.5 one `h1` per route via `PageHeader` | every route | **Dashboard has none** | ✗ |
| §7.2 no hardcoded aggregates | 0 | **Yes in 3 surfaces** (see F2) | ✗ |
| §3 states per surface | all | six routed pages OK; Projects uses bare `<p role="alert">` | ~ |

Worst offenders for legacy colour: `DataSources.tsx`, `SitePassport.tsx`,
`DataCentreAiInsightsCard.tsx`, `MainMap.tsx`, `WorldMonitorHeader.tsx`, `StatusBar.tsx`,
`NewsFeedPanel.tsx`, `EvidenceWorkspace.tsx`, `InfrastructurePredictionsPanel.tsx`.

One outright bug found while measuring: **`eco-accent` is not a defined token**
(`src/index.css` `@theme` has no `--color-eco-accent`), yet `Projects.tsx` uses
`text-eco-accent` for all three of its error messages (lines 49, 161, 166). Tailwind
generates no class, so **validation and load errors render in ordinary body colour** — they
look like normal text instead of an alert. Grep: `grep -rn "eco-accent" src`.

---

## 3. Cross-cutting findings

### F1 — Three audiences, one navigation (P0, biggest single cause of clutter)

`WorldMonitorHeader.tsx:27` ships eight equal-weight nav items:

```
Dashboard · Registry · Ministry · Register · Review · DC site planning · DC data sources · News
```

Nothing on that bar tells a visitor which items are for them. `Ministry`, `Review` and
`Register` are internal/restricted workspaces that open to anyone (with a demo-identity banner
standing in for auth), sitting at the same visual weight as `News`. Meanwhile the labels are
inconsistent: **Registry** (nav) → **"Public registry / Operational data centres"** (page
title) → **"Data-centre operations"** (ministry title) — three names for two concepts.

- A **citizen or judge** needs: where am I · one headline number · is it real · show me the map.
- An **official** needs: what needs my decision today · which facilities broke their freshness
  window · what changed since last week.
- A **data-centre owner** needs: my facility · what my score is and why · what to fix · how to
  submit/update a declaration.

All three currently land on the same dense operations dashboard. Nothing is *wrong* on it —
it is just addressed to nobody in particular.

### F2 — Fabricated instrument chrome (P0, trust-critical)

These are hardcoded strings, not derived state, so they say the same thing on every load and
can contradict the live registry:

| Surface | Claim | Evidence |
| --- | --- | --- |
| Header | `DEFCON 4`, `WATER TIER 2`, pulsing `animate-ping` dot | `WorldMonitorHeader.tsx:128–145` |
| Header | `⚡ 19 DCS` | `WorldMonitorHeader.tsx:144` |
| StatusBar | `DIGEST COVERAGE: 19 Facilities Screened · 4 Focus States · SRTM 30m · JRC GSW · CGWB 2024` | `StatusBar.tsx:52–62` |
| Dashboard panel | `volume: '19 Facilities Screened'`, `CGWB 2024 Dynamic GW Assessment` | `InfrastructurePredictionsPanel.tsx:28,33` |
| News | `CRED 92`, `NEW`, `3 SOURCES`, `LIVE WIRE`, "Reported across multiple tier-1 financial wires" | `NewsFeedPanel.tsx:32,167,170,176,203,210` |

The news ones are the worst: `getCredibility()` is a string match on the publisher name that
invents a 78–98 "credibility score", and the "3 SOURCES"/"2 SOURCES" chip is a **ternary on
that invented tier** — it is not counting sources. A government reader who notices one of
these is fabricated will distrust the risk score next to it, which is the one thing on the
site that *is* rigorous. `Card`'s own contract says `status` is "derived state chip — never
hardcoded copy"; these bypass it.

### F3 — No navigation at or below `md` (P0)

`WorldMonitorHeader.tsx:150` is `className="hidden … md:flex"` with no mobile menu anywhere in
the tree (`grep -rn "md:hidden" src/components/layout src/components/worldmonitor` → nothing).
On a phone or a narrow window the app has **zero navigation**; deep links and the browser Back
button are the only way between pages. Declared policy is "mobile breakpoint keeps working"
(spec §8) — it does not.

At 768–1024px, the same row also carries brand + clock, 8 nav items, search, 3 view modes,
3 time ranges, Layers, recenter, mute and keys. That is the overflow risk that produced the
crowded header you saw earlier.

### F4 — Type floor (P1, readability for officials)

131 raw `text-[9px]`/`text-[10px]`/`text-[11px]` usages. Most damaging:
`MainMap.tsx:1189–1197` (map legend + attribution at 10px), `InfrastructurePredictionsPanel`
(whole panel), `SitePassport.tsx` (the owner-facing factsheet), `NewsFeedPanel` (every chip).
For a 55-year-old official on a 1366×768 projector these are unreadable, and they are all
text that *matters* (legend, units, provenance), not decoration.

### F5 — Palette drift + broken error tone

246 legacy colour utilities mean the same semantic ("warning", "verified", "water") is
`eco-warning` on one page, `amber-500` on another, `cyan-500` on a third. `DataSources.tsx` is
visibly a different app from `PublicFacilities.tsx` for this reason alone. Combined with F4's
`eco-accent` bug, "colour carries no reliable meaning" is the current state.

### F6 — Duplicated and dead controls

- **Layer controls exist twice**: `WorldMonitorLayerRibbon` ("Data centre markers", expandable)
  and `LeftSidebar` ("Layers & filters"), each with its own toggle set, plus a ribbon line
  saying "Context layers are managed in Layers & filters". Two doors, one room.
- **`ApiKeyModal`** — a key-entry dialog behind a header key icon — is exposed on the public
  dashboard. It is a developer control in a citizen-facing chrome.
- **`LeftSidebar` "Facility type"** renders a `<div>` styled to look like a disabled select
  reading "Data centres (fixed)": a control that looks interactive and is not.
- **Orphaned code still in the bundle**: `EcoWorkspace.tsx` (488 lines) is imported by nothing
  and drags `LiveSignalsWirePanel`, `ActiveHotspotsPanel` and `PolicyNewsPanel` with it;
  `SlideOverDeepDive.tsx`, `PlanningBar.tsx` (the *only* city/data-mode control per its own
  docblock) and the pages `Mitigation`, `Reports`, `SiteAnalysis`, `RiskAnalysis`, `Forecast`
  are all unrouted. Note the contradiction: **`StatusBar` deliberately hides the data-mode
  badge on registry routes, and the component that owns mode selection is not mounted** — so a
  user cannot tell whether numbers are synthetic or live.

### F7 — Status vocabulary is route-guessed, not modelled

`StatusBar.tsx:19` decides its label from a hardcoded list of path prefixes
(`['/dashboard','/public-facilities','/ministry','/operator']`) to choose between "public
registry" and "candidate evidence". Adding a route silently changes what the footer claims.
Same heuristic picks whether to show the demo badge.

### F8 — Bundle shape

Single chunk, 2.20 MB / **621 kB gzip** (measured with `vite build`). With three of the four
map/news/site-analysis subsystems reachable from every route, a first-time visitor on a
government network pays for the whole app before seeing one number. Route-level
`React.lazy` on `/projects`, `/data-sources` and `/ministry*` is the cheap fix.

---

## 4. Page-by-page

### `/dashboard` — the landing page

**Works:** map + registry KPI + environmental coverage + news in one glance; dossier opens on
marker click; three view modes are genuinely useful.
**Problems:**
1. No `PageHeader`, therefore **no `h1` and no stated purpose** — the only route without it. A
   first-time visitor gets a wall of panels with no sentence telling them what they're looking at.
2. `split` view compresses the same seven panels built for a wide grid into a 410px column
   (`Dashboard.tsx:71`) — every panel inside is cramped, some horizontally scrolled.
3. `LeftSidebar` opens over the map by default; the ribbon sits above it; both control layers.
4. `StatusBar`'s DIGEST block and header DEFCON pills (F2) are most visible *here*, i.e. on the
   surface a judge sees first.
5. `fitToIndia()` + `setTypeFilter('data_centre')` run on every mount (`Dashboard.tsx:46`) —
   returning from a facility profile resets the user's map position and filters.

**Fix:** add a compact page header ("Data-centre environmental screening · 4 states · as of
{today}") with the 3 headline numbers as tiles; move the news panel off `split` into
`grid_only`; make `split` right column a fixed 3-panel digest rather than the whole grid;
persist map viewport in the store; delete the header pills and DIGEST block.

### `/public-facilities` — the registry

**Works:** honest provenance column, map/list toggle persisted in `localStorage`, state filter
+ search, capacity boundary disclaimer, empty and error states all correct.
**Problems:**
1. The disclaimer is a permanent full-width `InlineAlert` above the fold — a three-line legal
   caveat before the user has seen one facility. Move to `Card` footer or a `?` disclosure.
2. **No pagination/sort.** API returns ≤100 rows (`pageSize: 100`) but the table renders
   whatever arrives with no "show more", and no sort by capacity/state/freshness.
3. Summary tiles duplicate the dashboard KPI tiles with different wording ("Operating
   facilities" vs "Registry KPI") — two vocabularies for the same count.
4. `total ?? filtered.length` in the card subtitle means the count silently changes meaning
   when a client-side filter applies.

**Fix:** collapse the caveat, add sort + pagination, and reuse the dashboard KPI component so
one number has one name.

### `/public-facilities/:facilityId` — the facility profile (owner-facing)

**Works:** the best page in the app. `RiskScorePanel` shows score, band, coverage, every
parameter row including the unavailable ones *with their reasons*, and explicitly says gaps
are excluded, not zeroed. Exactly the right instinct.
**Problems:**
1. **No map** of the (generalised) location — the one thing an owner wants to confirm.
2. No plain-language interpretation: "19.8/100 · Low" with no sentence telling an owner what
   dominates the score or what a high band would imply.
3. No comparison: score cannot be read against the other facilities in the same state, which is
   the first question anyone asks.
4. Stacked order is Profile → Risk → Current → Trend; the score (the hook) is below a long
   fact table.
5. `EnvironmentalCurrent` and `EnvironmentalTimeSeries` both restate "not on-site telemetry" —
   good intent, said twice.

**Fix:** score + band + "what drives this" first, map beside the profile, add a
state-percentile line ("lower than 62% of screened facilities in Maharashtra"), and reduce the
duplicate notice to one place.

### `/news`

**Works:** clear "media reports are context, never verified evidence" framing; two regions
side by side.
**Problems:**
1. Two `NewsFeedPanel`s each render their own India/World tab pair (`News.tsx:21–22`), so the
   page shows **four region tabs** and either column can be switched to duplicate the other.
2. All of F2's fabricated credibility chrome lives here in its densest form.
3. 8-item lists with no "see all", no date grouping, no publisher filter.

**Fix:** one panel, one tab pair, region as page-level state; delete CRED/NEW/SOURCES/LIVE WIRE;
keep publisher + relative time + summary.

### `/projects` — site planning

**Works:** URL-addressable project/site selection (`?project=&site=`), polygon editor,
comparison matrix, evidence workspace.
**Problems:**
1. **Two `h1`s**: `PageHeader` plus `SitePassport.tsx:70` renders its own `<h1>`.
2. Uses raw `<select>`/`<input>` with hand-written classes (`Projects.tsx:65`) instead of the
   `Field` family — visually a different control system from every other page.
3. Errors are bare `<p role="alert">` in `eco-accent` (undefined token → invisible as an
   error) instead of `ErrorState`/`InlineAlert`.
4. Six stacked sections on one scroll (selector → create → 3 explainer cards → phases → sites →
   evidence). Nothing collapses; the create form is a `<details>` while everything else is open.
5. Exposed in the primary nav to every visitor, though it is an analyst/owner working surface.

**Fix:** demote `SitePassport` heading to `h2`; adopt `Field`; use `InlineAlert`; move the three
explainer cards into an empty state shown only when no project is selected (they already are
conditional — they render *instead* of content, so the page reads as marketing on first load);
move nav to the owner/analyst section.

### `/data-sources` — 788 lines, four tabs, ~15 legacy colour uses

**Works:** genuinely useful reference (official documents, per-state packs, grid factors,
environmental datasets) with correct "Unavailable" handling for missing factors.
**Problems:** heaviest legacy-palette page, so it looks like a different product; four
same-weight tabs with no summary; `download` and external links mixed in one card grid; exposed
to citizens in the primary nav, where it reads as an internal compliance dump.

**Fix:** retokenise, move under a "Documentation/Reference" section or the official workspace,
and put a one-line summary per tab with counts.

### `/ministry` and `/ministry/review`

**Works:** clear "Restricted ministry workspace" eyebrow; demo-identity banner is honest;
review workspace separates private declaration from public snapshot preview.
**Problems:** reachable with no sign-in (F1); no queue count in the nav, so an official cannot
see whether there is work without opening the page; the two pages are two nav items for one
job ("decide things"), which is where the header's eight-item crowding comes from.

**Fix:** one `Official` entry with a badge count; treat the pair as tabs inside it.

### `/operator/register`

**Works:** single-purpose form, revision-safe, clear that the declaration is private until
reviewed.
**Problems:** no progress indicator across the multi-part form; the owner cannot see afterwards
what state their submission is in (no "my submissions" view); nav label "Register" doesn't say
"register a facility".

---

## 5. What "clear" means for each audience — concrete deltas

**Citizen / judge (60 seconds, mobile possible)**
- Land on a header with one sentence and three numbers, not eight nav items.
- Nav: `Map · Registry · News` (+ `About the data`). Everything restricted moves behind a
  clearly-marked `Workspaces` entry.
- Every number traceable in one click to source + timestamp. No invented scores anywhere.
- Works at 390px wide.

**Government official (daily, dense, audit-minded)**
- Nav entry `Official` with a queue badge; inside: Overview · Review · Data sources.
- Freshness first: which facilities are past their verification window, which providers failed.
- Sortable tables, CSV export, and a printable one-page facility sheet.
- Zero fabricated telemetry — a DEFCON pill that is a string literal is a liability in a
  briefing.
- Type you can read in a meeting room: 12px floor, no 9px chips.

**Data-centre owner**
- Nav entry `Owner`: `My facility · Register/update · Guidance`.
- Facility page: score, band, drivers, per-parameter status, and a "what moves this score"
  sentence per available parameter.
- Comparison against state peers, and a clear "generalised location" statement so it is obvious
  why the address is not exact.
- Evidence upload with visible submission state.

---

## 6. Clutter budget — what to remove, exactly

| Remove | Where | Why |
| --- | --- | --- |
| `DEFCON 4`, `WATER TIER 2`, `⚡ 19 DCS`, ping dot | `WorldMonitorHeader.tsx:126–146` | fabricated, and the number contradicts the API |
| `DIGEST COVERAGE` block | `StatusBar.tsx:52–62` | fabricated; footer should report one real status |
| `CRED nn`, `NEW`, `N SOURCES`, `LIVE WIRE`, "reported across…" | `NewsFeedPanel.tsx:167–211` | invented scores/counts |
| `19 Facilities Screened` / `CGWB 2024` volume strings | `InfrastructurePredictionsPanel.tsx:28,33` | hardcoded |
| `ApiKeyModal` trigger | `WorldMonitorHeader.tsx:255` | dev control in public chrome |
| Layer ribbon **or** sidebar layer list (keep one) | `WorldMonitorLayerRibbon.tsx` / `LeftSidebar.tsx` | duplicate control |
| "Facility type: Data centres (fixed)" pseudo-select | `LeftSidebar.tsx:132` | looks interactive, isn't |
| Permanent `InlineAlert` disclaimer | `PublicFacilities.tsx:55` | caveat before content |
| Duplicate region tabs | `News.tsx:21–22` | one panel instead of two |
| Orphaned `EcoWorkspace`, `SlideOverDeepDive`, `PlanningBar`, 5 unrouted pages | `src/components/worldmonitor`, `src/pages` | dead weight, ~1,500 lines, in the bundle |

Keep: `PageHeader` purpose line, `Card` footer provenance, `RiskScorePanel`'s unavailable-with-
reason rows, `DemoIdentityBanner`, `DataQualityBanner`, the map legend (at ≥12px).

---

## 7. Prioritised plan

**P0 — trust + first contact (≈1.5 days)**
1. Delete every fabricated string in §6 (mechanical, no design decisions).
2. Split nav by audience; add a `Workspaces` disclosure for restricted routes; rename for one
   vocabulary (Registry = `/public-facilities` everywhere).
3. Add `PageHeader` to `/dashboard`; make it the only `h1` there; demote `SitePassport`'s `h1`.
4. Add mobile navigation (a single drawer reusing `NAV_MODULES`) and hide the 9 header controls
   below `lg`.
5. Define `--color-eco-accent` **or** replace its 3 uses with `eco-critical`.

**P1 — legibility (≈1.5 days)**
6. Kill all 131 raw px sizes → `text-micro` (11px, uppercase chips only) / `text-meta` (12px).
   Start with `MainMap` legend/attribution and `SitePassport`.
7. Retokenise the 13 legacy-colour files, `DataSources.tsx` first; add the spec's grep to CI so
   it cannot regress.
8. Route-level `React.lazy` for `/projects`, `/data-sources`, `/ministry*`.

**P2 — workflows (≈2–3 days)**
9. Facility page: score-first layout, location map, state-percentile line, one contextual notice.
10. Registry: sort + pagination, collapse the caveat, single KPI vocabulary.
11. News: one panel, real metadata only.
12. Projects: `Field` family, `InlineAlert`, empty-state explainers.
13. Official workspace: one nav entry with queue badge; freshness-first overview; CSV export.

**P3 — polish**
14. Persist map viewport across navigation.
15. Delete orphans after confirming no route/import references them.

**Acceptance (same greps as the spec, run before calling it done)**
```bash
grep -rnE 'text-\[(9|10|11)px\]' src --include='*.tsx' | wc -l        # 0
grep -rnE '(bg|text|border|ring)-(slate|sky|blue|emerald|rose|amber|violet|cyan|purple)-[0-9]' src --include='*.tsx' | wc -l   # 0
grep -n '!important' src/index.css | wc -l                            # 0
grep -rn 'DEFCON\|DIGEST COVERAGE\|CRED \|LIVE WIRE' src --include='*.tsx' | wc -l   # 0
grep -L 'PageHeader' src/pages/*.tsx | grep -v test                   # only redirected pages
```

---

## 8. Deliberately not recommended

- **A redesign or new palette.** The tokens pass AA (spec §2) and the risk panel proves the
  system can carry dense evidence honestly. Enforcement, not invention.
- **A role/permission system in the frontend.** That is a backend identity decision; the
  frontend fix now is *labelling* restricted areas and not pretending demo identity is auth.
- **Removing the map-first dashboard.** For the public audience a map is the fastest
  orientation; it needs a header and fewer controls, not replacement.
