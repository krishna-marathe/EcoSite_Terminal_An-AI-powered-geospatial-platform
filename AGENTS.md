# EcoSite India — Repository Instructions for AI Coding Agents

> Applies to OpenCode, Antigravity, Codex, IDE assistants, and other coding agents. Read this file first. Last team review: **pending**.

## Mission and hard limits

EcoSite India is an **India-wide, data-centre-only, evidence-driven pre-investment site and resource-readiness platform** for the One Earth Hackathon 2026. It evaluates candidate polygons, full-campus development phases, power and water commitments, environmental observations, supporting documents, regulatory screening and gaps. **It does not grant approvals, establish legal compliance or predict verified spare utility capacity.**

- Missing/failed source data means `UNKNOWN` / `SOURCE_UNAVAILABLE`, **never zero risk**.
- Synthetic/demo data must be labelled and never presented as measured, official or verified.
- A submitted government-looking PDF is `DOCUMENTED` at most until authenticity, validity and scope are confirmed by an appropriate real verifier. Seeded reviewer accounts produce **simulated** verification only.
- Substation proximity does not establish available MW. A policy/incentive is not a clearance. A satellite layer is not legal parcel evidence.
- Preserve the existing Pune/Mumbai legacy demonstration and Siddharth's contributions while migrating incrementally.
- No new supervised site-suitability/approval predictor without genuinely independent labelled outcomes. Focus ML on document classification/extraction and human review.

## Read before every task

1. `docs/implementation/PROJECT_STATE.md` — dated status snapshot and blockers.
2. `docs/implementation/TEAM_TASKS.md` — ownership, branch and acceptance rules.
3. `docs/contracts/API_CONTRACTS.md` — current versus proposed interfaces.
4. The relevant existing source/tests and any current Phase 02 handoff files.
5. Check `git status --short`, current branch and recent commits **before editing**. Repository code and Git take precedence over any stale document snapshot.

If these files disagree with the checkout, **report the difference rather than silently rewriting the files**.

## Stack and existing foundation

- Frontend: React 19, TypeScript, Vite, MapLibre GL JS, Zustand, TanStack Query, Tailwind, Recharts, Vitest.
- Backend: FastAPI, Pydantic 2, Python 3.11, SQLAlchemy 2, Alembic and a separately retained legacy `sqlite3` facility path.
- Database: SQLite local MVP. Schemas are migrated with Alembic; do not assume the user's normal DB is migrated.
- Geometry: Shapely/PyProj, WGS84 GeoJSON Polygon; pinned India ADM0 dataset is **screening only**, not Survey of India legal boundaries.
- Current migration head in the latest audit: `02c_001`. Confirm in repo before acting.
- The new persistent Projects workspace is intentionally distinct from legacy Demo/API local-storage candidate comparisons.

## Change discipline

- Work **only on an assigned feature branch**, created from the team-approved integration branch; never force-push shared history.
- One tightly bounded task per agent turn. Inspect -> summarize intended files -> implement -> run targeted tests -> report actual results.
- Preserve unrelated staged/unstaged/untracked work; never `reset --hard`, `clean`, blindly pop a stash, or overwrite teammate changes.
- Do not modify real `.env` files or print secrets. No confidential DPRs, real utility documents, local databases, datasets with unclear reuse rights, or model weights in Git.
- Use small, reversible migrations; rehearse on an empty database and a **disposable copy** of the legacy database. Never migrate or seed the normal `backend/data/ecosite.db` without explicit approval and backup.
- Keep scoped frontend state and real API-backed state separate. No demo GIS layers in real API mode.
- Avoid unrelated refactors, new frameworks, large dependencies and speculative ML work.
- All new evidence/analysis data needs provenance, units, site/phase scope, dates, status and source/revision where appropriate.
- API schema changes: Krishna is contract owner; Omar, Siddharth and Samarth review affected contracts **before** downstream integration.

## Team boundaries

| Owner | Primary area |
|---|---|
| Krishna | Backend, migrations, contracts, evidence graph, power/water/assessment engines, integration |
| Siddharth | Dataset/access/licence research, GIS connectors, rule-pack sources and provenance |
| Omar | Frontend, map/readiness/evidence/reviewer UX, comparison and Passport |
| Samarth | Document dataset, PDF extraction, ML experiments and quality evaluation |

## Verification and handoff

For each completed task report: **branch/HEAD, files changed, implemented vs partial, commands executed and results, tests added, source/data provenance, known limitations, next dependency**. Never say a browser/API/test passed unless executed.

Useful local commands (Windows, repository root):

```powershell
npm --prefix frontend run lint -- --no-cache
npm --prefix frontend run test
npm --prefix frontend run build
backend\.venv\Scripts\python.exe -B -m unittest discover -s backend/tests -v
git diff --check
```

Run heavy suites sequentially. Do not install dependencies, run migrations or start an app against the original DB unless the assigned task authorizes it.

## AI-tool switch handoff

When changing between OpenCode, Antigravity or another tool, first capture a brief **task-specific handoff** (branch, changed files, intended behavior, tests, unfinished steps) in the PR/issue or a branch-local note. A new agent must inspect Git/source and read these docs; do not assume prior chat context is transferred.
