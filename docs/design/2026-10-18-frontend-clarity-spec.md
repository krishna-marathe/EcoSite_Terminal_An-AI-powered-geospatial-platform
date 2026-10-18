# EcoSite Terminal — Frontend Clarity Spec

**Date:** 2026-10-18 · **Status:** draft for approval · **Implementable in this repo** (target: `react-vite-tailwind-engineer` profile; pure SPA, no SSR/SEO needs).

**Agreed scope**
- **Audience:** hackathon judges first, analyst workflow not sacrificed — "judges-first, analyst-honest".
- **Coverage:** whole app, Dashboard depth-first.
- **Depth:** layout + visual system allowed; keep the dark terminal identity, React 19 / Vite / Tailwind v4 stack, and the frozen data contract (`shared/pilot.json`).

**Non-goals:** no light theme, no new features, no backend/scoring changes, no data-contract edits, no i18n, no new runtime dependencies. Desktop-first (demo on a laptop/projector); anything below `md` must not break, but mobile is not optimized.

---

## 1. Context

**Product:** a 2-city (Pune/Mumbai) environmental screening terminal. Records → screening indices → risk/mitigation/forecast surfaces → printable planning dossier. Demo mode ships synthetic pilot fixtures; API mode reads the local FastAPI backend.

**Who looks at it and why**
- **Judge (3 minutes, guided):** "What is this, is it real, does it work, is it honest?" Every screen must answer with one glance: what city, what data, what's synthetic, what action.
- **Analyst (repeated use):** switch city → screen candidates → compare → forecast → mitigation → dossier. Wants stable layouts, labeled numbers, visible provenance, no dead ends.

**Definition of "clean and understandable" for this app**
1. **One visual language** — one palette, one type scale, one control/badge/table vocabulary.
2. **Scannable hierarchy** — in 3 seconds: page title → panel title → value; numbers carry labels and units.
3. **Honest status** — every panel states its data mode/source; no claim the data doesn't support; no dead ends (every async failure offers a next step).
4. **Flow continuity** — switching city or data mode updates every surface (this is currently broken at the map — see §7).

**Constraints:** Tailwind v4 (`@theme` tokens exist), IBM Plex Mono already declared as body font, MapLibre only for maps, lucide-react icons. Working tree is uncommitted; the pilot plan's acceptance checks and the frozen contract must keep passing.

---

## 2. Diagnosis — why it feels unclear today (evidence)

| # | Finding | Evidence |
|---|---------|----------|
| D1 | **Two palettes at once.** A retrofitted green-on-charcoal system (`eco-*` tokens + a `!important` override block that recolors a *subset* of legacy utilities) fights the original blue/slate design. New pilot components bypass the overrides entirely. | `index.css` `@theme` (`eco-*`) + override block; 36 `.tsx` files: **1** uses `eco-*`, **22** use legacy navy hexes (`#0F172A`, `#111827`, `#263447`, `#080D16`…), **31** use raw `slate/sky/blue` utilities |
| D2 | **No type scale; readability floor violated.** 10–11px is used everywhere, including prose and form labels. | **145** occurrences of `text-[10px]`/`text-[11px]`; body font 10–11px in RiskAnalysis dossiers, SiteMapPicker overlays, DataQualityBanner, panel statuses |
| D3 | **Flat hierarchy.** Page `h1` is `text-xl` on legacy pages; instrument pages use mono/uppercase micro-text; three different title patterns exist. | SiteAnalysis/Forecast/Mitigation (`text-xl` h1, raw body) vs RiskAnalysis ("Module 02" badge + hex cards) vs Reports ("eyebrow + h1 + five equal h2s") |
| D4 | **Three control vocabularies.** Unbordered `bg-slate-800 p-2` selects; bordered `inputClass` inputs; hex-bordered mono selects; plus native unstyled buttons. | Forecast.tsx selects, SiteAnalysis.tsx inputs, RiskAnalysis.tsx facility select, Mitigation.tsx button |
| D5 | **Contradictory status copy.** Panel statuses hardcoded and false in API/empty states. | `EcoWorkspace.tsx:99` `'DEMO · 4 ALERTS'` above a permanently empty feed; `:114` `'SCREENING · 20 ASSETS'`; `:142-147,153,156,179-181,192` hardcoded national aggregates; `WorldMonitorLayerRibbon.tsx:93` hardcoded `/12` |
| D6 | **Honesty defects** (also QA blockers). | Map renders national fixtures regardless of city (`MainMap.tsx:13,593`); SlideOver `:99` `{operator \|\| 'Verified Record'}`; "verified against CGWB/CEA" copy; Navi Mumbai preset outside Mumbai bounds; Reports CSV severity `0` vs label "None" |
| D7 | **Orientation gaps.** Mixed nav labels; icon-only buttons are `title`-only; live clock hidden below 2xl; Reports exposes raw status enum (`StatusBar.tsx:14`) and hardcoded `°N/°E` (`:20`). | Header nav "ML Forecast / Site Evaluation / AI Mitigation"; legend color vocabularies differ between `StatusBar` and `MainMap` |
| D8 | **Hygiene.** Declared font never loads; MapLibre CSS loaded twice; two orphaned components. | `index.html` has no font link (font declared `index.css:31`); unpkg link `index.html:8` + bundled import `index.css:2`; orphans: `facilities/DashboardStatsBar.tsx`, `facilities/FacilityDetailPanel.tsx` (~90% duplicate of `SlideOverDeepDive.tsx`) |

**The good news:** the token palette itself is sound. All `eco-*` foregrounds pass WCAG AA on all three surfaces (text 16.85, primary 13.56, muted 6.44, warning 10.45, critical 6.52 on `eco-bg`; worst pair muted-on-surface-2 = 5.70). No palette redesign is needed — the fix is **enforcement**: converge every surface on these tokens and delete the hack layer.

---

## 3. Flows & states

### Flow A — Judge tour (~3 min, demo mode default)

- **Goal:** in one pass, see a working pilot: city data → map → dossier → candidate → forecast → risk → mitigation → dossier report.
- **User story:** As a hackathon judge, I want a guided, honest tour of the pilot so that I can evaluate scope, rigor, and honesty in minutes.
- **Trigger:** opens `/dashboard` in demo mode.
- **Entry points:** `/dashboard`; deep links to `/site-analysis`, `/forecast`, `/risk-analysis`, `/mitigation`, `/reports`; city+mood via `PlanningContextBar` selectors.
- **Prerequisites:** none (demo fixtures shipped); backend optional.

```
Open /dashboard
  │
  ▼
PlanningContextBar: "Pune · Synthetic demo"  ──▶ CityComparison open (Pune vs Mumbai coverage)
  │
  ▼
Map (Pune facilities, legend, sources)  ──▶ click hotspot row ──▶ Slide-over dossier
  │                                                              (risk, drivers, provenance, actions)
  ▼
/site-analysis: pick preset ──▶ Evaluate ──▶ suitability + flags ──▶ Save to comparison
  │
  ▼
/forecast (12 months, one metric, labeled summary, "synthetic demonstration" notice)
  │
  ▼
/risk-analysis (score ring, contributions, weight tuner, dossiers)
  │
  ▼
/mitigation (catalogue + optional AI advice, provenance chips)
  │
  ▼
/reports (dossier, CSV exports, Print) ──▶ judge asks "is this real?" → every panel answers in one glance
```

- **Branch points:** demo ↔ API (PlanningContextBar); city switch (must propagate to *all* surfaces incl. map); facility selection (slide-over only when selected).
- **Edge cases:** judge asks about data provenance (DataQualityBanner + per-panel SourceTag must be visible, not buried); judges resize to projector 1366×768 (no clipped primary content; panels scroll internally).
- **States required:** demo chip visible; map/panel skeleton on hydrate; if API mode fails mid-tour → section-level `ErrorState` with "Switch to Synthetic demo" action.

### Flow B — Analyst workflow

- **Goal:** produce a defensible candidate comparison and dossier for one city.
- **Trigger:** PlanningContextBar city switch, then work across pages.
- **Prerequisites:** none in demo; reachable backend for API mode.
- **Steps:** city select → layer/filter refinements (LeftSidebar, hidden by default) → hotspot/signals review → site candidate (map click or preset; validation against city bounds) → evaluate → save → forecast metric/horizon → risk weights → mitigation (catalogue or optional AI) → Reports: export CSV / mitigation CSV / print dossier.
- **Edge cases:** zero facilities in city → `EmptyState` with "Evaluate a site" guidance; missing observations → `Insufficient data`/`Unavailable`, never `0`; saved-state survives reload (already true, localStorage); Navi Mumbai candidate outside Mumbai bounds → inline validation, submission blocked.

### Flow C — API mode connect / failure

- **Goal:** switch to backend data for everything, with explicit recovery.
- **Trigger:** PlanningContextBar "Data → Backend API".
- **States:** loading (`LoadingSkeleton`, city-scoped copy) → success (SourceTag "Backend API · N records · observed X") → error (`ErrorState`: "Backend unreachable" + cause + actions **Retry** / **Switch to Synthetic demo**). No silent fixture fallback (matches QA semantics). Optional API keys (ApiKeyModal) never block core use; save shows validation feedback.

### State model (applies to every async surface)

| State | Treatment |
|---|---|
| Loading | Skeleton rows/tiles (not bare text); `aria-busy`; copy names the scope ("Loading Pune records…") |
| Empty | `EmptyState`: what is missing + one next action (link/button) |
| Error | `ErrorState`: title, cause, **Retry**, and when applicable **Switch to Synthetic demo** |
| Partial / unavailable | Value renders `Unavailable` (muted, tooltip = reason) or `Insufficient data` chip; never `0`, never blank |
| Demo/API duality | One mode chip in PlanningContextBar; per-panel `SourceTag` in panel footer; single DataQuality disclosure |

---

## 4. Design tokens

**Strategy:** the `eco-*` tokens in `frontend/src/index.css` `@theme` are canonical. Migrate all mounted components to them, then **delete the `!important` override block** (the attribute-selector section of `index.css`). Theme: dark only.

### 4.1 Color — roles (existing hex values kept)

| Role | Token | Hex | Use |
|---|---|---|---|
| App background | `eco-bg` | `#0b0d0c` | Page canvas |
| Surface | `eco-surface` | `#111514` | Panels, cards, controls |
| Surface raised | `eco-surface-secondary` | `#171c19` | Headers, hover, selected fills (12–16% alpha ok) |
| Border | `eco-border` | `#29362f` | 1px hairlines everywhere |
| Text | `eco-text` | `#e7f1e8` | Primary text |
| Muted | `eco-muted` | `#85998d` | Meta, captions, inactive |
| Accent/interactive/positive | `eco-primary` | `#39f58b` | Buttons, links, focus ring, selected, "ok/low risk" |
| Attention | `eco-warning` | `#ffad24` | Demo/synthetic chips, elevated risk, caveats |
| Critical | `eco-critical` | `#ff5d68` | High risk, errors |
| Positive (soft) | `eco-secondary` | `#71e6a0` | Hover/soft variant of primary only — no separate semantics |

**Rules**
- `sky/blue/emerald/violet/cyan/purple` utilities and legacy navy hexes (`#0F172A`, `#111827`, `#172131`, `#263447`, `#080D16`, `#080D1A`, `#060A10`, `#0B1220`, `#1E293B`, `#1E2C42`) are **forbidden** outside `frontend/src/theme/tokens.ts` (single source for chart/map palettes).
- Risk ladder (bar + number + badge use the same): low → `eco-primary`, elevated/moderate → `eco-warning`, high/critical → `eco-critical`, unknown → `eco-muted`. Text label always present; color never sole carrier.
- Data mode: demo/synthetic → `eco-warning` chip; API/live → `eco-primary` chip; internet feed → `eco-muted`/neutral chip.
- Focus ring: `eco-primary`, 2px, 2px offset (`ring-offset-eco-bg`).

### 4.2 Typography

**Fonts:** load IBM Plex Mono (400/500/600) **and** IBM Plex Sans (400/500/600/700) in `index.html` with `preconnect`; declare stacks:
- `--font-mono: "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace` — numbers, IDs, table digits, code-like values, wordmark, micro-chips.
- `--font-sans: "IBM Plex Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` — everything else (prose, labels, titles, controls).
- Optional hardening before the demo: self-host the six `.woff2` files under `frontend/public/fonts/` (offline-proof). Google Fonts link is acceptable default; fallbacks above keep the app usable offline.

**Scale (add to `@theme`; replaces all ad-hoc sizes):**

| Token | Size/line | Use |
|---|---|---|
| `text-display` | 28/34, sans 600 | Page h1 (PageHeader) |
| `text-h2` | 16/24, sans 600 | Section headings |
| `text-body` | 14/22, sans 400 | Prose, labels, controls, table cells |
| `text-meta` | 12/16, sans 400 | Captions, help text, table headers (with `font-medium`), footers |
| `text-data` | 13/18, mono 500, tabular-nums | Inline values, table digits |
| `text-data-lg` | 22/28, mono 500, tabular-nums | Metric tile values |
| `text-micro` | 11/16, mono 500, uppercase, tracking .06em | Chips/badges/eyebrow **only** — never prose |

**Rules:** no text below 11px anywhere; 11px only for uppercase chip labels; values always `tabular-nums`; units render adjacent to values in `text-meta`; `text-[10px]/[9px]` are eliminated (145 occurrences today).

### 4.3 Spacing, shape, motion, layering

- **Spacing:** 4px base. Page padding `p-6` (24); section gap `space-y-6`; panel padding `p-3` (12), prose panels `p-4`; grid gap `gap-3`; control height 36 (`h-9`), compact 32 (`h-8`); table row ≥36; chip height 20.
- **Radii:** `rounded-sm` (4) controls/badges/tables, `rounded-md` (6) panels, `rounded-lg` (10) modals/slide-over/map chrome. (Today: `rounded`/`rounded-xl` mix, non-standard `w-84`, `w-105`, `w-115` — replace with standard widths.)
- **Borders:** 1px `eco-border`; emphasis via surface fill, not heavier borders.
- **Motion:** 120ms ease-out hover/focus; 200ms enter/leave for popovers/slide-overs; honor `prefers-reduced-motion` (disable transforms/pulses). No looping decorative animation.
- **Z-layers:** sticky header/planning context 30; ribbon/map chrome 20; popovers 40; slide-over 50; modal 60 (modal must sit above slide-over).
- **Breakpoints:** defaults; page bodies get `mx-auto w-full max-w-[1200px]` (Dashboard stays full-bleed). Panels 1-col <md, 2-col ≥md, 4-col ≥xl (current behavior kept).

### 4.4 Print (Reports)

- Replace fragile `main > :not(.planning-report)` selectors with an explicit `.print-hidden` class on controls.
- Add a print-only report header block (hidden on screen): city, generated-at, data mode, scoring version; set `document.title` to `EcoSite dossier — {city}` so browser print headers are meaningful.
- Tables: min 9pt, `break-inside: avoid` on rows, numeric columns right-aligned; force hidden overflow visible (already).
- Page-number via browser header/footer only (no fake CSS page counters).

---

## 5. Component specs

Full specs for the shared core; a compact table covers the rest. All components live under `frontend/src/components/ui/` (existing files upgraded; no new libraries).

### 5.1 PanelShell (upgrade of `Card`)

**Purpose:** the single panel/card anatomy for every dashboard panel, page section, and report block.
**Variants:** `panel` (default, header+body+footer), `bare` (paddingless container for tables/maps), `report` (print-friendly).
**Props:**
```ts
interface PanelShellProps {
  title: string;                       // sentence case, must match panel content
  status?: React.ReactNode;            // derived chip: counts/mode — never hardcoded copy
  statusTone?: 'neutral' | 'warning' | 'critical';
  source?: { label: string; status: DataStatus };  // footer provenance
  actions?: React.ReactNode;           // header right (close, menu)
  footer?: React.ReactNode;            // units/disclaimer line
  scroll?: 'none' | 'body';            // body scrolls internally
  className?: string;
  children: React.ReactNode;
}
```
**States:** renders any child state component; header `status` is consumer-derived.
**Interaction:** header `h-8`; actions are icon buttons (§5.4) with `aria-label`.
**Responsive:** stretches to grid cell; `min-h` from parent grid; body scrolls, header/footer pinned.
**A11y:** `role="region"` + `aria-label={title}`; status chip is text, not color-only.
**Tokens:** `bg-eco-surface border border-eco-border rounded-md`; header `bg-eco-surface-secondary/60 border-b border-eco-border px-3 h-8`; title `text-body font-semibold`; footer `text-meta text-eco-muted`.

### 5.2 PageHeader

**Purpose:** one orientation pattern for all six routes: where am I, what is this, what can I do.
**Props:**
```ts
interface PageHeaderProps {
  eyebrow?: string;        // e.g. "Analysis", "Output" — no "Module 02" numbering
  title: string;           // h1, text-display
  purpose: string;         // one sentence, <=120 chars — what this page does
  meta?: React.ReactNode;  // chips: city, data mode, scoring version
  actions?: React.ReactNode; // primary actions (export/print)
}
```
**Replaces:** SiteAnalysis h1+run-on intro; Forecast h1+paragraph; Mitigation h1+status line; Reports eyebrow+h1; Risk "Module 02" badge (dropped).
**A11y:** `h1` once per route; `purpose` is real `<p>`, not title attribute.
**Tokens:** `space-y-1`, title `text-display`, purpose `text-body text-eco-muted`, meta chips per §5.5, actions right-aligned `flex gap-2`.

### 5.3 Field family (Input / Select / Textarea)

**Purpose:** one control skin and one labeling pattern everywhere (today: four).
**Props (Field wrapper):**
```ts
interface FieldProps {
  label: string;            // always visible, never placeholder-only
  htmlFor: string;
  hint?: string;            // text-meta, eco-muted
  error?: string;           // text-meta, eco-critical, sets aria-invalid
  required?: boolean;
  children: React.ReactElement; // the control
}
```
**Control classes (one string, exported as `controlClass`):** `h-9 w-full rounded-sm border border-eco-border bg-eco-surface px-2 text-body text-eco-text placeholder:text-eco-muted focus-visible:ring-2 focus-visible:ring-eco-primary focus-visible:ring-offset-2 focus-visible:ring-offset-eco-bg disabled:opacity-50`.
**Select rule:** option labels are human labels ("Data centre"), never raw enums (`data_centre`); keep enum as value.
**Textarea:** `min-h-[88px] py-2`.
**A11y:** label `htmlFor`; `aria-describedby` for hint/error; errors `role="alert"`.

### 5.4 Button + IconButton

**Purpose:** one button system with predictable emphasis.
**Variants:** `primary` (eco-primary bg, dark text), `secondary` (surface + border), `outline`, `ghost`, `danger` (eco-critical); **sizes:** `sm` h-8, `md` h-9; `loading` (spinner + disabled); `icon` via IconButton.
```ts
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  icon?: React.ReactNode;
  loading?: boolean;
}
interface IconButtonProps { label: string; icon: React.ReactNode; onClick?: () => void; size?: 28 | 32; }
```
**Rules:** exactly one `primary` per view region; IconButton always has `label` → `aria-label` + `title`; hit target ≥28px desktop, ≥44px when in-page (map overlays keep 32).
**Tokens:** radius 4, focus ring per §4.1; no `ring-sky` (current `Button` uses `ring-sky-500` — replace).

### 5.5 Badge family

**Purpose:** all chips from one place: data mode, status, risk, source.
```ts
interface BadgeProps { tone: 'neutral'|'positive'|'warning'|'critical'|'info'; children: React.ReactNode; size?: 'micro'|'sm'; }
// Specializations:
// DataModeBadge  { mode: 'demo'|'api'|'synthetic'|'internet' }   → "Synthetic demo", "Backend API", "Synthetic data", "Internet feed"
// RiskPill       { score: number|null; level: RiskLevel }        → "High · 78/100" or "Insufficient data"
// SourceTag      { org: string; status: DataStatus }             → footer provenance
```
**Rules:** text always present (never color-only); `score: null` renders "Insufficient data" (`eco-muted`), not `0`; labels sentence case, chips may be uppercase `text-micro`.
**Replaces:** Badge.tsx rainbow variants (emerald/sky/amber/rose/neutral/outline) and per-panel hex chips.

### 5.6 MetricTile + DefinitionRow

**Purpose:** numbers always come with label, unit, and context.
```ts
interface MetricTileProps { label: string; value: string | number | null; unit?: string; caption?: string; tone?: 'default'|'warning'|'critical'; }
interface DefinitionRowProps { label: string; value: string | number | null; unit?: string; unavailableReason?: string; }
```
**Rules:** `value === null` → "Unavailable" + `unavailableReason` tooltip; unit rendered in `text-meta eco-muted` after value; captions ≤1 line.
**Replaces:** MacroTelemetryPanel tiles (fixes unitless "Mean air index"), SiteAnalysis `<dl>`, forecast "First/Final/Change" run-on, SlideOver metric rows (fixes `k`/`M` mixing by formatting via one helper).
**Tokens:** tile `bg-eco-surface-secondary border border-eco-border rounded-sm p-3`, label `text-meta`, value `text-data-lg`.

### 5.7 State components

**Purpose:** identical loading/empty/error/unavailable behavior everywhere.
```ts
// LoadingSkeleton: {rows?: number; variant?: 'rows'|'tiles'|'chart'}
// EmptyState:      {title: string; body: string; action?: {label: string; to?: string; onClick?: () => void}}
// ErrorState:      {title: string; cause?: string; onRetry?: () => void; demoAction?: boolean}  // demoAction renders "Switch to Synthetic demo"
// InlineAlert:     {tone: 'info'|'warning'|'critical'; title?: string; children}                 // page-level notices
```
**Rules:** no bare `<p>` states remain; loading names its scope; every error offers retry and (when data-mode-related) the demo switch.
**Replaces:** all `text-amber-300` one-liners across SiteAnalysis/Forecast/Mitigation/Risk/Reports/panels.

### 5.8 DataTable

**Purpose:** one table look for facility register, hotspot list, candidate comparison, layer list.
```ts
interface DataTableProps {
  columns: Array<{ key: string; header: string; align?: 'left'|'right'; mono?: boolean; width?: string; hideBelow?: 'md'|'lg'; }>;
  rows: React.ReactNode[][];
  empty?: React.ReactNode;      // EmptyState
  loading?: boolean;            // skeleton rows
  dense?: boolean;              // 32px rows
}
```
**Rules:** numeric columns right-aligned + `tabular-nums`; units in header or adjacent cell consistently; first cell is the row's identity; rows keyboard-focusable when clickable.
**Replaces:** SiteAnalysis table, Reports two tables, hotspot list density, CityComparison table.

### 5.9 MapPanel (map chrome)

**Purpose:** map surface that obeys the app's context and vocabulary.
**Required behavior:**
1. **City-scoped** (QA blocker): renders `facilities` from the store for `cityId` — demo mode included. `DEMO_FACILITIES` direct imports removed from `MainMap.tsx` and `SiteMapPicker.tsx`. Navi Mumbai (`cityId: null`) never appears under Mumbai.
2. **Failure state:** tile/style load failure → overlay `ErrorState` ("Map tiles unavailable — check network/token", Retry). No silent empty rectangle (today only `console.warn`).
3. **Shared legend vocabulary:** one exported `FACILITY_TYPE_COLORS` (in `theme/tokens.ts`) used by both the map legend and StatusBar legend; marker colors follow the risk/mode rules, not a rainbow.
4. **Attribution visible** (OSM/CARTO/ESRI as applicable) — legal requirement; keep compact, bottom-right, `text-micro`.
5. **Chrome grouping:** top-left = context chips (facility count, city), top-right = tools (zoom, recenter, basemap). One tool button group, no chip/tool mixing.
6. **Overlays ≥12px:** SiteMapPicker notice/coords/button text up from 10/11px; pin legend explains blue/amber dots ("Data centre" / "Other facility").

**Props:** none required beyond store; optional `mode: 'full' | 'picker'` for the SiteMapPicker variant (single click-to-pin + 15 km buffer ring + recenter).

### 5.10 Compact specs (rest of the app)

| Component | Purpose | Key rules | States |
|---|---|---|---|
| `WorldMonitorHeader` | Global top bar: brand, nav, search, view/time/layer controls | Nav labels: Dashboard / Risk / Forecast / Site analysis / Mitigation / Reports with **active-route styling**; icon buttons get labels via IconButton; drop duplicate "Demo Data" chip (single mode chip lives in PlanningContextBar); hide "Environmental Intelligence Platform" subtitle <lg | clock fallback "UTC --:--" |
| `PlanningContextBar` | Demo/API + city switch; global status | Break the run-on line into 3 zones: **context** (City select, Data select), **status** (`N records · X observed`, `role="status"`), **note** (extent, `text-meta`); error row → `InlineAlert` with "Switch to Synthetic demo" action; extent line up from 10px | loading/error/ready |
| `WorldMonitorLayerRibbon` | Map layer pills | Compute `{n}/{total}` from catalog (kill hardcoded `/12`); active pill uses `eco-primary` border tint (kill sky/emerald split); "+n more" gets a button title | empty search |
| `LeftSidebar` | Layer/filter rail | Standard width `w-80 md:w-[340px]`; render all risk tiers (fix `.slice(0,4)` dropping `low`); stop truncating source org mid-word (wrap or ellipsis + title) | — |
| `WorkspaceToolbar` (in `EcoWorkspace`) | Mission/scenario controls | Segmented zones: **Workspace select** (5 missions, labeled "Workspace"), **active workspace description** (one line), right: Scenario toggle, `{n} panels active`, "Restore panels"; statuses move into each panel header | — |
| `CityComparison` | Pune/Mumbai honesty bar | Keep `<details>`; **open by default ≥lg**; styled as PanelShell `bare`; footnote to `text-meta`; columns: City, Records (observed), Mean water /100, Mean grid /100, Mean air /100 | loading/error/unavailable |
| `ActiveHotspotsPanel` | Risk-sorted facility list | Add missing **empty state**; row = title, location, score `RiskPill`, one 2-line meta max; threshold ladder from §4.1; footer provenance via SourceTag | loading/empty/error |
| `LiveSignalsWirePanel` | Alert feed | Status text derived from `signals.length`; when none: `EmptyState` "No city alert provider connected" + hint link to hotspots; remove `DEMO_SIGNALS` dead constant; filter pills include `nominal` or drop the Nominal badge | loading/empty/error |
| `MacroTelemetryPanel` | 6 metric tiles | Use MetricTile (units on every tile: `Mean air index /100`, `Listed capacity MW`), footnote one line | unavailable per tile |
| `PolicyNewsPanel` | Internet RSS feed | Fix `react-hooks/set-state-in-effect` (QA B2): initialize state from fetch result, derive status from state; header shows `INTERNET · RSS` as muted InfoBadge with "not city-specific" caption | loading/error/empty |
| `ScenarioEngine` | What-if overlay | Already on eco palette — align radii/motion/tokens only; close button gets visible label; Apply uses primary button; keep overlay z-40 | active/inactive |
| `SlideOverDeepDive` | Facility dossier | Honest provenance (QA): `{dataStatus}` + source org; **remove `'Verified Record'` fallback** → "Operator not recorded"; keep title as `text-h2`, group sections under 3 headings (Profile / Stress & risk / Actions) instead of 6 uppercase micro-headings; standard widths `sm:w-[420px] md:w-[460px]`; `role="dialog" aria-modal`, Escape closes, focus returns to trigger | loading/N-A per field |
| `ReportsDossier` | Printable dossier | PageHeader with actions (Export dossier / Export visible CSV / Export candidates CSV / Print); sections: Planning context, Facility register (DataTable), Saved candidate comparison (DataTable, same as SiteAnalysis), Mitigation plan, Evidence & limitations; fix CSV severity mapping (`none→0, low→1, elevated→2, high→3, critical→4` or blank when unknown — label/table/CSV must agree); empty states carry actions ("Evaluate a site") | loading/error/empty |
| `SiteMapPicker` | Map click picker | City-scoped facilities (store); add pin legend; overlays ≥12px; tile failure overlay; Navi Mumbai preset removed or validated (see §7) | error overlay |
| `ApiKeyModal` | Optional keys | Group: "Built-in (no key needed)" vs "Optional keys"; save shows validation result (no fake success); copy says optional, no version-number claims; standard dialog (z-60, focus trap, Escape) | saving/saved/error |
| Orphans | `DashboardStatsBar.tsx`, `FacilityDetailPanel.tsx` | **Delete** during cleanup (duplicated by SlideOver/panels); confirm no imports remain | — |

---

## 6. Page application (Dashboard first)

**Dashboard (P1)**
1. `WorkspaceToolbar` segmented; mission select labeled; per-panel statuses derived.
2. Panels: Hotspots, Alerts, Telemetry, PolicyNews (default Mission "Command Center") — each in PanelShell with derived status + states; title equals content ("FACILITY SIGNALS" → content title "Environmental alerts").
3. Map pane header becomes city-driven: "{City} · environmental situation"; right side = legend toggle + data quality disclosure.
4. `DataQualityBanner` stays (one per dashboard) but becomes 2 lines max: mode sentence + "Sources: {list}" collapsed; `text-meta`.
5. Kill hardcoded aggregates (`EcoWorkspace.tsx:92,99,106,114,120,142-147,153,156,179-181,192`): derive from store where trivial (panel counts, alerts count); where the value is illustrative (risk posture gauge in stub missions, forecast/mitigation previews), replace numbers with an explicit `EmptyState`: "Preview not available in this workspace — open Forecast / Mitigation" + link. No fake numbers survive.
6. CityComparison open by default; PlanningContextBar/StatusBar per §5.10; LayerRibbon denominator computed.

**Site analysis (P2)** — archetype A → dashboard-grade: PageHeader (eyebrow "Analysis") + two-column ≥lg (Candidate form PanelShell | Result PanelShell) + Saved comparisons DataTable; Field family controls; enum → labels; every number labeled with unit (`Population within 5 km`, `/100` on suitability); Navi Mumbai preset validated against city bounds (inline error, submit disabled); `ErrorState`/`EmptyState` per §3.

**Forecast (P2)** — PageHeader + controls row (two Selects in a filter bar) + chart PanelShell; summary as 3 MetricTiles ("First", "Final", "Change" with signed `%`); chart colors: projection `eco-primary`, bounds `eco-muted` dashed; methodology paragraph → `<details>` disclosure; synthetic-demonstration notice stays as InlineAlert (warning tone, one line).

**Risk analysis (P2)** — PageHeader (drop "Module 02"); filter bar with facility Select (max-w-none on ≥lg); score card, contribution chart, weight tuner as three PanelShells; replace 10/11px mono industry copy with `text-meta`/`text-body` (keep mono for numbers only); add facility-data `ErrorState`; weight sliders get visible current-value labels.

**Mitigation (P2)** — PageHeader + provenance line; catalogue as PanelShell with item rows (title, category/priority/timeframe as chips — priority uses Badge tones, not prose); AI advice in its own PanelShell with privacy note as `text-meta` caption and `loading` on the button; states per §3.

**Reports (P2/P3)** — §5.10 row + print tokens §4.4; both tables via DataTable; severity CSV fix; section headings `text-h2` with anchor rhythm (not five equal-weight blocks).

**Shell (P0)** — AppHeader nav labels + active state; PlanningContextBar zones; StatusBar: remove raw enum leak (map status → sentence), fix `°N/°E` (suffix per sign), legend uses shared vocabulary.

---

## 7. Content & honesty requirements (non-negotiable)

These are comprehension defects, not cosmetics; they ship **with** the cleanup (they overlap QA blockers B1–B5):

1. **Map follows the city (B3).** `MainMap` + `SiteMapPicker` read facilities from the store for `cityId`; `DEMO_FACILITIES` direct imports removed. Acceptance: switch to Mumbai → no Pune/Navi Mumbai markers; Navi Mumbai records never listed under Mumbai.
2. **Hardcoded aggregates removed** (§6 Dashboard item 5). Acceptance: `grep "'DEMO ·\|\`SCREENING ·\|68/100\|\+8.4%"` → 0 in `EcoWorkspace.tsx`.
3. **Verification claims corrected.** `SlideOverDeepDive.tsx:99` "Verified Record" → "Not recorded"; "verified against CGWB/CEA" phrasing → "Source: synthetic pilot fixture (no external verification)" unless provenance says otherwise. Rule: the words *verified/observed/official* appear only when the data's `dataStatus` supports them.
4. **Navi Mumbai candidate.** Preferred: keep the preset but validate against selected-city bounds with inline explanation ("Outside Mumbai pilot bounds — choose Mumbai or click the map to pin within bounds"), submit disabled. No contract change. (Alternative — extending Mumbai bounds in `shared/pilot.json` — requires team sign-off; not default.)
5. **CSV/label agreement (Reports:46).** Severity numeric matches its label; unknown → empty, never 0-vs-"None".
6. **Feed honesty.** `LiveSignalsWirePanel` never claims alerts it doesn't have; `PolicyNewsPanel` labels RSS as internet, not city data.
7. **Code hygiene (B1/B2/B4/B5).** `pilotCities.ts:14` cast fixed (TS2352); `PolicyNewsPanel` effect pattern fixed (eslint); add `backend/requirements-dev.txt` with `httpx` (clean-venv test install works); README updates cite measured numbers (5,000 records/0.33 s ≈ 15k rec/s, city page p50 8.3 ms/p95 14.9 ms, deep page p50 30.3 ms, 6.8 MiB DB) and replace "three synthetic records" (`backend/README.md:37`). `.env` stays as-is (untracked handling is a separate repo-hygiene decision).

---

## 8. Accessibility (WCAG 2.2 AA targets)

- **Contrast:** all `eco-*` pairs pass AA today (worst 5.70); migration removes the failing legacy pairs (~2.4). No new colors without a measured pair.
- **Type floor:** 12px minimum for text; 11px only for uppercase chip labels (per §4.2).
- **Focus:** visible 2px `eco-primary` ring on all interactive elements (`:focus-visible`); map/icon buttons included; no `outline-none` without replacement ring.
- **Keyboard:** all controls reachable; slide-over/modal: `role="dialog" aria-modal="true"`, Escape closes, focus moves in and returns to trigger; export/print buttons are real buttons.
- **Semantics:** one `h1` per route (PageHeader); `role="status"` for async status, `role="alert"` for errors; form labels programmatic (`htmlFor`/`aria-describedby`).
- **Color independence:** risk/state always includes text ("High · 78/100"); legend labels visible.
- **Map:** controls keyboard-operable (zoom/fit exist); visible attribution; legend text ≥12px.
- **Motion:** `prefers-reduced-motion` disables transforms/pulses.
- **Touch:** interactive targets ≥28px desktop chrome, ≥44px in-content (mobile breakpoint keeps working).

---

## 9. Handoff & acceptance criteria

**Target:** `react-vite-tailwind-engineer` — implement directly in this repo (React 19 + Vite + Tailwind v4, no new deps). Toolchain on this box: `node node_modules/typescript/bin/tsc -b`, `node node_modules/eslint/bin/eslint.js .`, `node node_modules/vite/bin/vite.js build` (run from `frontend/`).

**Phasing**
- **P0 — Foundation (highest leverage):** tokens/fonts (§4), State components (§5.7), Field/Button/Badge/MetricTile/DataTable (§5.3–5.8), shell retokenization (AppHeader, PlanningContextBar, StatusBar, Ribbon), delete override block, delete orphans, fix D8 (font link, duplicate maplibre CSS).
- **P1 — Dashboard:** §6 Dashboard items 1–6 + map city-scoping (§7.1–7.3).
- **P2 — Workflow pages:** Site analysis, Forecast, Risk, Mitigation per §6.
- **P3 — Reports & polish:** dossier layout, print tokens, a11y sweep (§8), ApiKeyModal.

**Acceptance criteria (measurable)**
1. `grep -rnE '(bg|text|border|ring)-(slate|sky|blue|emerald|rose|amber|violet|cyan|purple)-[0-9]' frontend/src --include='*.tsx'` → 0 matches in mounted components.
2. `grep -rnE '#[0-9A-Fa-f]{6}' frontend/src --include='*.tsx'` → only `theme/tokens.ts` (map style/chart palettes) and existing maplibre style definitions.
3. `grep -n '!important' frontend/src/index.css` → 0 (override block deleted).
4. `grep -rnE 'text-\[(9|10|11)px\]' frontend/src --include='*.tsx'` → 0 (micro chips use `text-micro`).
5. Every route renders PageHeader (one `h1`); every panel/table/chart implements loading/empty/error per §3 (checklist per surface).
6. `EcoWorkspace.tsx` contains no hardcoded aggregate copy; panel statuses derive from store.
7. City switch updates map + every panel; Navi Mumbai never appears under Mumbai; out-of-bounds candidate blocked with explanation.
8. No "verified/observed" wording on synthetic data (`grep -rn 'Verified Record\|verified against' frontend/src` → 0).
9. Gates clean: `tsc -b`, `eslint .`, `vite build`; app boots at :5173 (demo) and :8000 backend proxy intact.
10. Manual pass at 1366×768 and 1920×1080: no clipped primary content, no horizontal scroll on page bodies; print preview of Reports shows header block + readable tables.

**Open decisions (defaults chosen so work can start):** fonts via Google Fonts link (self-host if offline demo is required — P0 toggle); CityComparison open by default (default yes ≥lg); module-numbering eyebrows dropped (default yes).

**Suggested commit slicing:** P0 tokens+primitives · P0 shell · P1 dashboard · P1 map scoping+honesty · P2 pages (one commit each) · P3 print+a11y.
