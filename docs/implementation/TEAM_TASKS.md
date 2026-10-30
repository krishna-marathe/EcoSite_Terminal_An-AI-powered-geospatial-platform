# EcoSite India — Four-Member Assignments and Working Agreement

**Sprint:** Phase A — alignment and Phase 02C close-out  
**Snapshot:** 27 October 2026  
**Coordination owner:** Krishna  
**Git integration branch:** **TBD by team** (latest audited working branch `krishna_updated`; do not assume local `master` is up to date).

## 1. Ownership and review partners

| Member | Primary owned modules | Review/handoff partner |
|---|---|---|
| **Krishna** | Backend database, migrations, FastAPI schemas/routers, evidence model, power/water, assessment, release integration | Omar for API consumers; Siddharth/Samarth for domain inputs |
| **Siddharth** | Official sources, dataset access/licence, source registry, GIS connectors, versioned state policy research | Krishna for observation contracts; Samarth for documents |
| **Omar** | React workflow, Project/Phase UI, document review, GIS evidence presentation, comparison and Passport | Krishna for API contracts |
| **Samarth** | Synthetic project/document fixtures, PDF/DOCX parsing, baseline document ML, evaluation, extraction candidate contract | Krishna for persistence; Siddharth for permitted source documents |

Roles above designate the **primary owner**, not a ban on pair reviews. No one should edit another owner's shared module without an agreed ticket/PR.

## 2. Active Phase A tasks — all can start in parallel

| Issue | Owner | Expected output | Dependency | State |
|---|---|---|---|---|
| `A-K1` | Krishna | Current Git baseline/branch decision proposal; safe stash review | Local Git audit | **TO DO / VERIFY** |
| `A-K2` | Krishna | `02c_001` migration + API tests on disposable DB; Phase 02C close-out | Phase 02C code in repo | **COMPLETE** |
| `A-K3` | Krishna | Draft Evidence/Document/Assertion Pydantic schema and error contract | Review `API_CONTRACTS.md` | **TO DO** |
| `A-S1` | Siddharth | P0 source registry: JRC/SRTM/Sentinel/CGWB, access/licence/processing tests | No code dependency | **RESEARCH IN PROGRESS — VERIFY STATUS** |
| `A-S2` | Siddharth | Seven-state official instrument/reference and authority matrix | No code dependency | **TO DO / VERIFY** |
| `A-O1` | Omar | Investigate 3 full-suite frontend timeouts; verify phase editor in browser | Phase 02C UI exists | **COMPLETE** |
| `A-O2` | Omar | Developer/reviewer evidence workflow wireframes and typed mock DTOs | Shared draft schema | **TO DO** |
| `A-M1` | Samarth | Document classes, JSON labels, template-safe synthetic generation spec | No code dependency | **TO DO** |
| `A-M2` | Samarth | PDF text/units parser experiment and evaluation plan | `A-M1` labels | **TO DO** |

States are initial planning values, **not claims that teammates have accepted or completed the tasks**. Each owner updates their GitHub issue/PR when work changes.

## 3. Phase A acceptance gate

1. Team has chosen and recorded one remote integration branch and PR rules.
2. Phase 02C has migration, backend/API, full frontend suite and real browser state clearly recorded (PASS or precise known limitation).
3. Draft evidence and extraction DTOs are reviewed by Krishna, Omar and Samarth.
4. P0 GIS source access/licence statuses are recorded; unknowns remain unknown.
5. No routine test mutates `backend/data/ecosite.db`; no real secrets or confidential documents are committed.
6. All four approve the P0/P1 cutline before Phase B implementation merges.

## 4. Parallel work starting in Phase B

| Owner | Work that starts immediately | Must agree on before integration |
|---|---|---|
| Krishna | Artifacts/assertions/verifications DB migrations and backend APIs | Exact artifact/claim schema, role restrictions |
| Siddharth | Source-registry connector probes + official rule/document mapping | Observation DTO and source licence rules |
| Omar | Evidence upload/review UI with mock service adapter | Evidence DTO, statuses, error codes |
| Samarth | Parser, 10–15 candidate field extractors, synthetic labelled document set | Extraction DTO and provenance/page contract |

**Rule:** frontend and AI/GIS work can proceed against **versioned mock contracts**, but not invent their own production endpoint shapes. Contract proposals are reviewed before code integration.

## 5. Branch, PR and merge process — one laptop per developer

1. Team chooses integration branch (`master` or `krishna_updated`) **after** checking remote refs. Don't rename/reset history casually.
2. Each developer fetches, fast-forward pulls integration, and creates `feature/<owner>-<task>`.
3. One bounded issue per PR; cite exact contract changes and test commands/results.
4. Krishna owns migration ordering. Shared `main.py`, schemas and generated types need explicit coordination.
5. At least one teammate reviews; merge via PR only when checks pass or limitations are consciously accepted.
6. Update `PROJECT_STATE.md` on the integration branch **after merge**, owned by Krishna. Other members update their issues/workstream docs; avoid four competing edits.
7. Never force-push integration; never blindly pop/drop stash or clean untracked work.
8. Do not commit `.env`, local databases, secrets, private developer documents, model artifacts or data with uncertain licences.

Suggested feature branches: `feature/krishna-evidence-api`, `feature/siddharth-gis-jrc`, `feature/omar-evidence-ui`, `feature/samarth-document-parser`.

## 6. Efficient AI-coding workflow

Every AI coding agent should read `AGENTS.md`, `PROJECT_STATE.md`, this file and the applicable API contract. Provide **one small task**, expected files and acceptance test; avoid repeating the entire research report.

Before switching OpenCode/Antigravity/Codex, write into the GitHub issue or branch-local handoff:

```text
Task / owner:
Branch / HEAD / dirty files:
Changed behavior and key files:
Tests actually run and results:
Remaining work / blockers:
Next action for replacement agent:
```

Do not ask the replacement agent to implement the task from scratch. It must inspect the actual working tree first.

## 7. Cadence and decision rules

- 15-minute daily check: merged work, today's deliverable, blockers.
- Twice-weekly cross-module integration: contracts then end-to-end behavior.
- If blocked by an API or external provider: use approved fixtures or source-unavailable states, not invented official data.
- Technical design calls involving schema, trust or data semantics are reviewed by Krishna plus the affected owner; material MVP scope changes require agreement of all four.
- Demo site-selection outputs must distinguish **resource readiness**, **environmental exposure**, **regulatory/site readiness**, and **evidence completeness** independently.





| A-M1 | Samarth / Krishna (temporary) | Document taxonomy and synthetic datasets | COMPLETE — ML baseline committed |
| A-M2 | Samarth / Krishna (temporary) | PDF/DOCX parsing and extraction evaluation | COMPLETE — 40/40 tests |
| A-M3 | Samarth / Krishna (temporary) | ML inference handoff | COMPLETE — pending backend integration |