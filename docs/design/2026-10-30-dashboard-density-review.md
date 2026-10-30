# Dashboard & page density review — why each element is there, and what to cut

**Date:** 2026-10-30 · **Reviewer:** UI/UX design pass · **Viewport measured:** 1440 × 900
**Method:** live DOM measurement of every route on the running app (element rectangles, border counts,
type-size histogram, control counts, scroll ratios), plus source reading to establish each element's
original purpose. Every number below was measured this session, not estimated.

This review is about **space, hierarchy and redundancy**. The earlier
[UI/UX inspection](./2026-10-30-ui-ux-inspection.md) covered correctness, trust and token compliance;
this one asks a different question of each component: *what job does it do, and is it paying rent?*

---

## 1. The measured problem in six numbers

| Measurement (dashboard) | Value | Why it matters |
| --- | --- | --- |
| Viewport spent on chrome before any data | **238 px of 900 = 26%** | header 56 + page title band 121 + layer ribbon 33 + footer 28 |
| Content in the right rail vs. space to show it | **6,701 px in 656 px = 10.2×** | an entire screen of insight is ~10% visible at a time |
| Bordered boxes on one screen | **130** (59 inside the 410 px rail) | structure is drawn with borders instead of space |
| Text nodes below 12 px | **107** | the detail that should be *secondary* is instead *unreadable* |
| Text nodes ≥ 16 px | **3** (one 16 px, two 24 px) | there is almost no visual hierarchy to scan by |
| Interactive controls | **77** (16 in the header, 19 inside the map) | more controls than facts on the landing surface |

Font-size histogram of the dashboard, measured directly: `10px ×28 · 11px ×79 · 12px ×263 · 14px ×36 ·
16px ×1 · 24px ×2`. **98.7% of all text sits at 14 px or smaller.** A page where everything is small
and similar in weight reads as texture, not as information — which is exactly the "cluttered but
somehow also empty" feeling the dashboard gives.

The same pattern repeats off the dashboard:

| Page | Chars of text | Nodes < 12 px | Scroll height | Notable |
| --- | --- | --- | --- | --- |
| `/dashboard` | 5,900+ | 107 | 900 (inner scrollers) | 6 panels in a 410 px rail |
| `/public-facilities` | 3,792 | 41 | 900 | 48 controls, 3 KPI tiles + table |
| `/public-facilities/:id` | **9,351** | **111** | **4,679** | risk score starts at **2,708 px** |
| `/news` | 4,244 | 87 | 900 | two identical panels, two tab-lists |
| `/data-sources` | **8,268** | 97 | 900 | 12 sections, 13 legacy-colour elements |
| `/projects` | 1,146 | 3 | 900 | reads as marketing until a project is chosen |
| `/ministry` | 3,215 | 68 | 900 | 6 controls, 6 panels |
| `/ministry/review` | — | — | 900 | empty state, honest |
| `/operator/register` | — | — | 900 | 8 fields, no step grouping |

---

## 2. Four root causes

### R1 — No focal point: the hierarchy ladder is missing

There is no size step between "page title", "panel title", "row label" and "provenance". Measured on
the dashboard: one 16 px element, two 24 px elements, and 263 at 12 px. When the most important number
and the least important footnote are the same size, users cannot triage — they read everything or
nothing.

**Rule to adopt:** one *primary* number per surface at 32–40 px mono (the thing the page exists for),
panel titles at 16 px, row content at 14 px, metadata at 12 px, and 11 px only for uppercase chips.
Nothing below 11 px, ever.

### R2 — Box-in-box: borders are doing the work of whitespace

130 bordered boxes on one screen; 59 in the 410 px rail alone. A typical rail item is
`panel border → inner section border → row divider → chip border`, four levels deep, each one a hard
line. The eye cannot distinguish container from content, so everything reads at equal importance.

**Rule:** maximum **two** border levels (page → panel). Inside a panel, separate with 16 px of space and
an 11 px uppercase label — not another box. Reserve the border for things that are genuinely
selectable (buttons, inputs, rows in a table).

### R3 — Duplicated controls and duplicated facts

Measured duplications, each with its own state or its own copy:

| Duplication | Evidence | Consequence |
| --- | --- | --- |
| **Two time-range controls on one screen** | header `24H/7D/30D`; map strip `1H/24H/7D/30D/ALL` — both call `setTimeRange` (`MainMap.tsx:1029`, `WorldMonitorHeader.tsx:~170`) | different option sets, different active styles, one shared state |
| **Two layer controls** | `WorldMonitorLayerRibbon` ("Data centre markers 1/1 selected") and `LeftSidebar` ("Layers & filters") | the ribbon's catalogue yields exactly **one** layer, so the control has nothing to choose |
| **Facility count stated three times** | page scope text, map chip "19 operating data centres", rail "Operating facilities 19" | three numbers that can disagree |
| **The same missing-data fact three times** | coverage panel (4 states × 14 metrics = **56 rows, all `NOT_COVERED`**), freshness queue (**19 rows, all "no linked station"**), and the map's "not covered" messaging | one sentence of information occupies ~2,000 px |
| **Two news panels** | `/news` renders `NewsFeedPanel` twice, each with its own India/World tablist | four region tabs on one page; either column can duplicate the other |
| **Two h1s** | `PageHeader` + `SitePassport.tsx` (fixed to h2, worth re-verifying) | two competing page titles |
| **Three clocks** | header IST clock, map strip clock, "as of" in the rail | one is enough, and seconds serve nothing |

### R4 — Priority inversion: the least trustworthy element is the biggest

On `/public-facilities/:id`:

- `FacilityProfile` occupies the first ~580 px (facts — correct to lead).
- **`DataCentreAiInsightsCard` occupies the next 1,866 px — 40% of the page.**
- The measured 0–100 risk score does not begin until **2,708 px**.

The AI card carries framing the product does not own: *"OFFICIAL INSPECTION AUTHORITY & MANDATE"*,
*"CLICK PERSPECTIVE TO RE-PROMPT AI"*, a *"Statutory Risk Score"* attributed to *"Ministry of
Electronics and Information Technology (MeitY) & MoEFCC"* (`DataCentreAiInsightsCard.tsx:63,127,387`).
It is generated text presented as an institutional verdict, it is larger than the evidence, and it
comes first. For a ministry stakeholder this is the most damaging element in the product; for an
owner it buries the number they came for.

**Fix:** AI insights become a *collapsed, clearly attributed* advisory block **below** the measured
score, retitled "AI-generated suggestions (not an authority assessment)", with the perspective picker
reduced to three chips. The statutory-score framing goes entirely — there is no statutory basis.

---

## 3. Dashboard, element by element: purpose → verdict

Each row states why the element exists, then what to do with it.

| Element | Why it is present | Verdict |
| --- | --- | --- |
| Brand + "Government data-centre oversight" | identity + audience statement | **Keep** |
| Nav (Overview · Registry · News · Workspaces) | audience-split wayfinding | **Keep** (already reduced from 8 items) |
| Ticking IST clock, seconds resolution | recency cue | **Cut the seconds.** Replace with one "Data as of {date}" in the orientation strip. Nothing in the product changes at second granularity |
| Facility search (dashboard only) | filters map markers | **Move into the map** as a floating field, or delete in favour of Registry search — two search boxes for the same records is a smell |
| View modes Split / Map / Grid | density control | **Keep** — it is the only honest answer to "too much on screen". Make Split the default with a 3-panel rail (below) |
| Header time range (24H/7D/30D) | filters time-scoped layers | **Keep one**, in the orientation strip; delete the map-strip duplicate and the `1H`/`ALL` variants unless a layer actually uses them |
| Layers toggle | opens the layer/filter panel | **Keep** |
| Recenter map | resets extent | **Move into the map's control stack** (it is a map action, not an app action) |
| Audio alerts toggle | *claims* alert audio | **Delete.** `audioAlertsEnabled` is a store boolean; nothing plays audio anywhere. It is a control for a feature that does not exist |
| Page title band (121 px) | orientation (h1 + scope + two badges) | **Keep, compress to ~64 px**: h1 16 px, one scope line, no badges — move "Operational only" and "Screening, not a compliance determination" into the footer notice |
| Layer ribbon (33 px) | select among infrastructure classes | **Delete.** `WM_LAYER_CATALOG.filter(l => l.key === 'bases')` leaves exactly one option; the control displays "1/1 selected" and toggles a no-op. Its useful residue (the count) belongs in the orientation strip |
| Map chip "19 operating data centres" | spatial inventory count | **Delete** (duplicate of the rail KPI) |
| "Mapbox HD" chip | basemap provenance | **Keep once**, as a small corner label inside the map |
| "DC SITUATION \| clock \| 1h…all" strip | recency + time filter | **Delete the strip.** It repeats the page title, the clock and the time control. Keep the time control in the orientation strip |
| Legend (purple `#8b5cf6` DC, "SLOPE >15°", "SURFACE WATER") | decode map symbols | **Keep but rewrite:** use the shared `FACILITY_TYPE_COLORS` token (the footer legend already uses it — today the two legends use different vocabularies), raise text to 12 px, and only list overlays that are currently switched on |
| 2D / 3D toggle | oblique terrain view | **Keep, demote** into the map control stack; align its active state with the design system instead of `bg-emerald-400 text-black` |
| "Environmental overlays are synthetic demonstration data…" | honesty notice | **Keep**, but as one line in the legend/footer, not a floating box |
| Rail: Operational registry | the headline count (19 facilities, 5 operators) | **Keep — this is the primary number.** Set it at 32–40 px, not 24 px |
| Rail: Registry distribution (by state, by operator) | composition (8/4/3/4; 5 operators) | **Keep as a compact bar list**, 4 rows + top 3 operators; it is genuinely useful orientation |
| Rail: Environmental coverage | per-state metric coverage | **Collapse.** Today: 4 state cards × 14 metric rows = 56 rows, every one `NOT_COVERED`. Replace with one line — "0 of 19 facilities have a linked public station" — plus a `Why?` disclosure listing metrics once (not per state) |
| Rail: Action queue + source health | ministry diagnostics | **Move to `/ministry`.** It is 19 failure rows + 14 source rows; it is an operational workspace, not public orientation. On the dashboard, show a single "12 of 14 sources connected · 19 facilities awaiting coverage" line linking to the workspace |
| Rail: Infrastructure & risk predictions | illustrative scenarios | **Move to `/ministry`** or a dedicated `/scenarios`. Labelled illustrative, it is still four 170 px cards of invented probabilities on the citizen's first screen |
| Rail: Media context | external context | **Keep**, but cap to 4 headlines on the dashboard with "All news" → `/news` |
| Footer: viewport coordinates | debug convenience | **Delete.** No stakeholder task uses `18.52°N, 73.86°E`; replace with "As of {date} · {n} facilities · Screening only" |
| Footer: "Screening only" | legal/scope notice | **Keep**, and make it the single home for that caveat |

Result of applying the verdicts: the rail goes from **6 panels / 6,701 px** to **3 panels / ~700 px**
(registry KPI, distribution, 4 headlines), with the rest reachable in one click inside the workspace
that owns them.

---

## 4. Proposed dashboard layout

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ HEADER 56  EcoSite Terminal │ Overview  Registry  News  ⌄Workspaces          │
├──────────────────────────────────────────────────────────────────────────────┤
│ ORIENTATION 64   Data-centre environmental screening      [24h │ 7d │ 30d]   │
│                  Four-state public registry · data as of 30 Oct 2026         │
├───────────────────────────────────────────────┬──────────────────────────────┤
│ MAP (flex)                                    │ RAIL 360                     │
│                                               │ ┌─ 19 operating facilities ─┐│
│   [search]                                    │ │  19        /100 score avg ││
│                                               │ └───────────────────────────┘│
│                                               │ ┌─ By state ────────────────┐│
│                                               │ │ ▇▇▇▇▇▇▇▇ MH 8            ││
│                                               │ │ ▇▇▇▇ TG 4  ▇▇▇▇ TN 4     ││
│                                               │ └───────────────────────────┘│
│                                               │ ┌─ Coverage ────────────────┐│
│   legend (12px, 1 line)   [zoom][2D/3D][fit]  │ │ 0 of 19 linked  Why?      ││
│                                               │ └───────────────────────────┘│
│                                               │ ┌─ Media context ───────────┐│
│                                               │ │ 4 headlines · All news →  ││
│                                               │ └───────────────────────────┘│
├───────────────────────────────────────────────┴──────────────────────────────┤
│ FOOTER 24   Registry ready · 30 Oct 2026 · Screening only, not compliance    │
└──────────────────────────────────────────────────────────────────────────────┘
```
Chrome: **144 px (16%)** instead of 238 (26%). Borders: page + panel (2 levels) instead of 4.

---

## 5. Page-by-page discrepancies

### `/public-facilities` — Registry
**Purpose:** the canonical inventory an owner or journalist cites.
**Discrepancies:** three KPI tiles restate numbers the table already contains; a permanent
full-width disclaimer sits above the table; no sorting and no pagination (the API caps at 100 rows and
the UI silently shows what arrives); 41 sub-12px nodes in a table meant for reading; the three tiles,
the dashboard's registry panel and the ministry overview each name the same count differently
("Operating facilities" vs "Operational registry" vs "Registry coverage").
**Changes:** drop the KPI row to one line inside the table header ("19 facilities · 5 operators · 4
states"); move the disclaimer to a `Why these boundaries?` disclosure; add column sort and a "load
more"; one vocabulary: **facility**, **operator**, **state**, **verified**, **as of**.

### `/public-facilities/:id` — Facility profile
**Purpose:** answer "how exposed is this facility, and why".
**Discrepancies:** the answer is at 2,708 px (see R4); 9,351 characters and 111 sub-12 px nodes; the
AI card is the largest element and is framed as institutional authority; no location map; the
environmental caveat is stated twice; score, band, coverage and eight parameter rows are all set at
12–14 px so the score does not stand out.
**Changes:** order = **score (32 px) → band + coverage + "what drives this" → map + profile facts →
monitoring → trends → collapsed AI suggestions**; one visible notice; a state-percentile sentence so
the number has meaning.

### `/news`
**Purpose:** contextual media coverage, explicitly not evidence.
**Discrepancies:** two panels, two region tablists, 58 controls, 87 sub-12 px nodes; the same caveat
printed twice; no date grouping; no "show all".
**Changes:** one panel; region as page-level segmented control; group by day; 12 items with "load
more"; publisher + age only (already de-chipped).

### `/projects` — Site planning
**Purpose:** draw candidate polygons and compare them.
**Discrepancies:** with no project selected the page is three numbered marketing cards ("1. Candidate
Land Polygons…"), which reads as a landing page for a workspace; project selector, "Quick open" chips
and a `<details>` create-form all compete above the work; raw `<select>`/`<input>` styled ad hoc rather
than with the `Field` family, so it looks like a different product; errors as bare `<p role="alert">`.
**Changes:** empty state becomes a single card — "No project selected" + primary `Create project` +
`Open recent (3)`; one control row for project selection; standard fields; the explainer cards become
empty-state *descriptions*, not page content.

### `/data-sources`
**Purpose:** the citation trail behind every claim — this is the page a ministry reviewer needs.
**Discrepancies:** 8,268 characters, 12 sections, four tabs of unequal weight with no summary; long
policy titles rendered at 12 px with no issuing body or date surfaced; 13 legacy-palette elements
(`sky/emerald/amber`) that make it visibly a different app; the page title ("Data Sources & Official
Documents") does not match the nav label ("Data sources") or its eyebrow.
**Changes:** one row per document: title (14 px, max 2 lines) · issuer · date · type chip · download;
group by state with counts; retokenise; retitle consistently.

### `/ministry`
**Purpose:** the official's working overview — freshness and source health.
**Discrepancies:** six panels at dashboard density with 68 sub-12 px nodes; no "what needs action
today" summary; the empty `/ministry/review` queue is a separate top-level destination rather than a
count beside it; title "Data-centre operations" is nearly identical to the dashboard's title, so
stakeholders cannot tell the two apart in a tab or a screenshot.
**Changes:** lead with three numbers — *pending reviews*, *facilities outside the freshness window*,
*sources down* — then the queue; rename to "Ministry workspace — registry health".

### `/ministry/review` and `/operator/register`
**Purpose:** decide submissions; declare a facility.
**Discrepancies:** review is honest and well-scoped, but its empty state is a full page with no link
back to what would create a submission; register is a single 8-field wall with no step grouping, no
progress indicator, and no visibility of what happens after submission.
**Changes:** review empty state → "No submissions pending. Operators submit via Register a facility
→"; register → three labelled groups (Identity · Location · Capacity) with a summary rail, and a
confirmation state that names the next step and the expected turnaround.

---

## 6. Space and rhythm system (the part that prevents regression)

| Token | Value | Applies to |
| --- | --- | --- |
| `space-1` | 4 px | icon-to-label |
| `space-2` | 8 px | inside a control, chip gaps |
| `space-3` | 12 px | inside a panel (row padding) |
| `space-4` | 16 px | between rows / cards, panel body padding |
| `space-6` | 24 px | between page sections |
| `space-8` | 32 px | page side margins ≥ lg; page max width 1200 (1440 for the dashboard) |

- **Two border levels maximum.** Page → panel. No nested panels; use spacing + an 11 px uppercase label.
- **One primary number per surface**, 32–40 px mono. Everything else ≤16 px.
- **One control per state.** Before adding a control, grep the store: if the setter is already bound
  somewhere visible, the new control is a duplicate.
- **Hide until earned.** Anything below the fold on the primary surface must be either a count or one
  click away — never a scroller inside a scroller.
- **Empty states carry the fix.** Every empty region states what would fill it and links to the action.

---

## 7. Prioritised changes

**P0 — recover the landing page (≈1 day)**
1. Delete the layer ribbon, the `DC SITUATION` strip, the audio toggle, the viewport coordinates, the map count chip and the map's duplicate clock.
2. Compress the title band to 64 px; move scope badges to the footer.
3. Move Action queue + predictions into `/ministry`; collapse coverage to one line + `Why?`.
4. Rail = 3 panels (~700 px), so the 10.2× scroll becomes ~1.1×.
5. Unify the two time-range controls and the two legends on shared tokens.

**P1 — facility page inversion (≈1 day)**
6. Reorder to score-first; collapse the AI card below it; strip "Official inspection authority / statutory risk score / MeitY" framing.
7. Add the location map and the state-percentile sentence.

**P2 — the rest (≈2 days)**
8. Registry: sort, pagination, one KPI line, disclaimer disclosure.
9. News: single panel, day grouping.
10. Data sources: document rows, retokenise, consistent title.
11. Projects: proper empty state, `Field` family.
12. Register: three steps + confirmation; review empty state links to it.

---

## 8. Acceptance criteria (measurable, same method as this review)

```
Chrome share of a 1440×900 dashboard      ≤ 16%        (today 26%)
Right-rail scroll ratio                   ≤ 1.5×       (today 10.2×)
Bordered boxes, dashboard                 ≤ 40         (today 130)
Text nodes < 12 px, dashboard             0            (today 107)
Text nodes ≥ 16 px, dashboard             ≥ 4          (today 3)
Controls, dashboard                       ≤ 40         (today 77)
Distinct time-range controls per screen   1            (today 2)
Panels duplicating a count               0            (today 3)
Facility page: offset of risk score       < 900 px     (today 2,708 px)
```

---

## 9. Outcome — measured after the P0 pass

Same method, same viewport (1440 × 900, split view), re-measured on the running app:

| Metric | Before | After | Target |
| --- | --- | --- | --- |
| Chrome share of viewport | 26% (238 px) | **16% (143 px)** | ≤ 16% ✓ |
| Right-rail scroll ratio | 10.2× (6,701 px in 656 px) | **1.6× (1,195 px in 743 px)** | ≤ 1.5× (near) |
| Panels in the rail | 6 | **3** | 3 ✓ |
| Bordered boxes, page / rail | 130 / 59 | **82 / 21** | ≤ 40 page (rail met) |
| Text nodes below 12 px | 107 | **29** (all 11 px uppercase chips) | 0 prose ✓ |
| Controls on the dashboard | 77 | **52** | ≤ 40 (header 16 → 11) |

What was removed: the layer ribbon, the `DC SITUATION` clock/time strip, the header clock, the
header time-range control (replaced by one control in the orientation strip), the header map-recenter,
the audio-alert toggle, the map's facility-count chip and pulse dot, the footer's viewport coordinates,
and the dashboard's ministry + predictions panels (now in `/ministry`).

What was added: a 59 px orientation strip carrying the title, the single time-range control and one
sentence of coverage/source health with a link to the ministry workspace; a coverage panel collapsed
to a total plus a `Why?` disclosure; a compact news variant for the rail; one legend vocabulary.

Still above target and worth a follow-up: the 82 remaining bordered boxes (mostly nested panel
internals in the rail's two registry panels) and the rail ratio, which would reach 1.5× by capping
headlines at three.

---

## 10. What not to change

- **The map-first dashboard.** For a citizen or a judge, geography is the fastest orientation. It needs
  less chrome around it, not replacement.
- **The honesty pattern.** Unavailable-with-reason rows and "screening, not compliance" wording are the
  product's strongest differentiator. The fix is to make them *quieter*, not to remove them.
- **Split / Map / Grid.** A real density choice is rare and valuable; it just needs a smaller rail.
