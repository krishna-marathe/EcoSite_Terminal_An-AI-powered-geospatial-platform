# EcoSite India — Frontend User Journeys & Interaction Specifications

**Author:** Omar (Frontend & UX Lead)  
**Status:** Approved for Phase B Implementation  
**Last Updated:** 28 October 2026  
**Governing Documents:** `roadmap.md`, `API_CONTRACTS.md`, `PROJECT_STATE.md`

---

## 1. Executive Summary & Epistemic Guardrails

EcoSite India is an **evidence-driven pre-investment site and resource-readiness screening platform** for hyperscale data centres in India.
In the frontend interface, every visual element, badge, table, and metric must strictly embody our core principles:

1. **`UNKNOWN` is never Zero Risk**: An absence of data or external failure must render as `UNKNOWN` or `SOURCE_UNAVAILABLE`, never a green score or zero liability.
2. **`DOCUMENTED` is not Verified**: Uploading an official-looking PDF merely gives an assertion the status of `DOCUMENTED`.
3. **`SIMULATED_REVIEW` is not Government Authority**: Seeded reviewer accounts produce `SIMULATED_REVIEW`. The UI must never display `GOVERNMENT_VERIFIED`.
4. **`PROXIMITY` is not Capacity**: Proximity to a substation must never be labeled as available electrical capacity.
5. **No Universal Black-Box Score**: The interface must present readiness across four independent, explainable dimensions rather than an opaque single score.

---

## 2. Target User Personas & Workspaces

The application serves three primary user personas:

### A. Developer / Infrastructure Planner (Default View)
- **Goal:** Propose a multi-phase data-centre campus, draw/upload up to three candidate polygons in target focus states (Telangana, Maharashtra, Karnataka, Tamil Nadu), declare power and cooling engineering requirements, and upload supporting project documents.
- **Key Screens:**
  - Campus Development Phasing (`/projects` -> Phase Editor)
  - Candidate Polygon Editor (`/projects` -> MapLibre Editor)
  - Evidence & Document Vault (`/projects` -> Evidence Workspace)
  - Resource Capacity Timeline (`/projects` -> Engineering Dashboard)

### B. Technical Reviewer / Consultant (Reviewer View)
- **Goal:** Review developer claims, compare against uploaded PDFs (page-by-page), examine AI-extracted candidate facts, identify contradictory evidence, and mark claims as `VERIFIED_WITHIN_SCOPE` or `CONFLICTING`.
- **Key Screens:**
  - Evidence Review Drawer (`/projects` -> Split PDF / Extraction Review)
  - Conflict Resolution Panel

### C. Investment Committee / Judge / Evaluator (Passport View)
- **Goal:** Compare up to 3 candidate polygons side-by-side across independent readiness dimensions and export an immutable, reproducible **Site Readiness Passport**.
- **Key Screens:**
  - 3-Site Comparison Matrix (`/projects` -> Site Comparison)
  - Site Readiness Passport (`/passport/:runId`)

---

## 3. Core User Journeys

### Journey 1: Campus Phasing & Requirement Declaration
1. User creates or opens a Project.
2. User enters cumulative campus development phases (e.g. Phase 1: 2027, 20 MW IT / 26 MW Facility; Phase 2: 2029, 50 MW IT / 65 MW Facility; Phase 3: 2032, 80 MW IT / 104 MW Facility).
3. The UI computes the **Implied PUE** (`FacilityPeakMW / ITPeakMW = 1.30`).
   - If user claims a design PUE of `1.15`, the UI renders a non-blocking reconciliation advisory: *"Design PUE (1.15) differs from milestone peak ratio (1.30). Check auxiliary and cooling load definitions."*
4. User declares water requirements: Peak summer demand in KLD, average KLD, and planned internal reuse.

### Journey 2: Evidence Upload & Provenance Assertion
1. Inside the Project workspace, user opens **Evidence & Document Vault**.
2. User clicks **"Upload Supporting Evidence"** and selects a file (e.g., `MSEDCL_Grid_Sanction_Phase1.pdf`).
3. User selects document type: `UTILITY_SANCTION`, `UTILITY_APPLICATION`, `WATER_ALLOCATION`, `WATER_STUDY`, `DPR`, `PLANNING`, or `OTHER`.
4. Client derives file SHA-256 and records file size, mime type, and reference ID.
5. In Demo Mode, an unmistakable badge `[SYNTHETIC_DEMO]` is affixed.
6. The uploaded artifact links to an **Assertion**:
   - `Field`: `sanctioned_grid_mw`
   - `Value`: `40 MW`
   - `Scope`: `PHASE_1` (Site A)
   - `Initial Status`: `DOCUMENTED`

### Journey 3: Resource Capacity & Gap Analysis
1. User opens the **Resource Readiness Timeline**.
2. The UI renders two synchronous Recharts series:
   - **Required Campus Load** (Cumulative line: 20 MW -> 50 MW -> 80 MW).
   - **Evidence-Backed Deliverability** (Supported steps: 40 MW sanctioned).
3. The chart visually highlights the unbacked capacity deficit:
   - *Phase 1 (2027):* 20 MW required, 40 MW supported -> **0 MW Gap** (Surplus headroom).
   - *Phase 2 (2029):* 50 MW required, 40 MW supported -> **10 MW Deficit** (Amber alert).
   - *Phase 3 (2032):* 80 MW required, 40 MW supported -> **40 MW Deficit** (Red alert: *Requires 220kV augmentation sanction*).

### Journey 4: Document Intelligence & Extraction Review
1. Reviewer opens an uploaded artifact with pending candidate extractions.
2. Split-screen view renders:
   - Left: PDF document viewer / preview focused on Page 2.
   - Right: Extraction Candidate Card:
     - Proposed field: `sanctioned_grid_mw`
     - Raw snippet: *"Sanctioned load: 40 MW at 110 kV feeder"*
     - Normalized value: `40`
     - Unit: `MW`
     - Method: `RULE_BASED` (or model version)
3. Reviewer actions:
   - **Accept Assertion**: Marks assertion as `VERIFIED_WITHIN_SCOPE` with reviewer timestamp.
   - **Edit & Accept**: Adjusts value or scope with human audit comment.
   - **Reject**: Rejects candidate with rationale (e.g., *In-principle feasibility only, not a sanction*).

### Journey 5: 3-Site Comparison & Passport Generation
1. User selects up to 3 candidate polygons (e.g., Site A - Daund, Site B - Chakan, Site C - Navi Mumbai MIDC).
2. Comparison Matrix displays four independent dimensions:
   - **Resource Readiness**: Grid deliverability % and peak summer water balance.
   - **Environmental Exposure**: Historical water occurrence % (JRC), terrain slope/relief (SRTM), Eco-Sensitive Zone distance.
   - **Regulatory Readiness**: Applicable State Data Centre Policy compliance (e.g., Maharashtra IT/ITeS Policy 2023 stamp duty exemption & power tariff subsidies).
   - **Evidence Completeness**: Ratio of verified vs declared assertions.
3. User clicks **"Generate Site Readiness Passport"**.
4. Produces an immutable, reproducible document with cryptographic checksum, input revisions, unresolved gaps, and recommended engineering next steps.

---

## 4. UI Design System & Component Tokens

Following the frontend clarity specification, all evidence and passport components use the dark terminal palette (`eco-*` design tokens):

| Token | CSS Class | Visual Meaning |
|---|---|---|
| Background Canvas | `bg-eco-bg` (`#080D16`) | Primary app surface |
| Card Surface | `bg-eco-surface` (`#0F172A`) | Elevation 1 (Panels, Cards) |
| Elevated Surface | `bg-eco-surface-2` (`#1E293B`) | Elevation 2 (Modals, Drawers) |
| Border Default | `border-eco-border` (`#334155`) | Panel borders |
| Accent Emerald | `text-eco-primary` (`#10B981`) | Verified / Healthy / Deliverable |
| Accent Amber | `text-eco-warning` (`#F59E0B`) | Documented / Gap / Warning |
| Accent Rose | `text-eco-critical` (`#EF4444`) | Deficit / Conflicting / Unbacked |
| Muted Foreground | `text-eco-muted` (`#94A3B8`) | Secondary labels, provenance |
