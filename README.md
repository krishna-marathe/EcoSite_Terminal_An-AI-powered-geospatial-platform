# EcoSite Terminal

EcoSite Terminal is a ministry-facing platform for monitoring operating public
data centres and screening candidate data-centre sites in India. The current
scope covers four states:

- Maharashtra (`IN-MH`)
- Telangana (`IN-TG`)
- Karnataka (`IN-KA`)
- Tamil Nadu (`IN-TN`)

The application combines a provenance-aware public facility registry,
contextual environmental observations, operator registration and ministry
review workflows. It tracks data centres as the only facility class. Air,
water, climate, biodiversity, hazard and grid information is supporting context,
not a separate inventory of plants or infrastructure.

## What is implemented

### Ministry command dashboard (`/dashboard`)

- India map with operating facilities from the approved public registry
- selectable, keyboard-accessible data-centre markers
- a facility dossier with operator, generalized location, separately typed
  capacity disclosures, verification window and public source
- map, split and grid layouts
- registry totals and state/operator distribution
- environmental coverage by target state
- ministry freshness queue and source-health status
- contextual AQI, groundwater, heat, flood, biodiversity, water-demand,
  grid-demand and climate layers

The map never substitutes legacy/demo sites when the registry is loading or
unavailable. Public views use generalized locality/district coordinates and do
not expose restricted exact facility geometry.

### Public registry (`/public-facilities`)

- operating facilities only
- state, operator, type and search filters
- paginated facility list and public map
- facility profiles with provenance and verification dates
- capacity values kept separate by measurement boundary; incompatible types
  are not combined into a misleading total

The prototype database currently contains 19 approved operating facilities.
The inventory is sufficient for the prototype but is not presented as an
exhaustive national census.

### Environmental context

The API supports current observations, time ranges and state summaries for
public monitoring metrics. Environmental readings describe nearby eligible
public stations; they are not private on-site facility telemetry.

Missing coverage is represented explicitly as `NOT_COVERED`,
`SOURCE_UNAVAILABLE`, `STALE` or `UNKNOWN`. The application does not fabricate
measurements or silently replace failed provider data with fixtures. Live
provider ingestion requires separately configured and verified CPCB/IMD/NWDP
access contracts.

### Registration and ministry workflows

- operator registration (`/operator/register`)
- private exact geometry and restricted submission fields
- immutable submission revision and audit history
- ministry operations (`/ministry`)
- ministry review queue (`/ministry/review`)
- review, information-request, approval and rejection transitions
- approved publication into a separate public snapshot

The local prototype uses explicit demo identity headers for role separation.
Production government SSO, verified operator onboarding and security
accreditation are not implemented.

### Candidate-site planning

`/projects` is the primary four-state data-centre planning workspace. Candidate
states are restricted to Maharashtra, Telangana, Karnataka and Tamil Nadu.
Screening is pre-feasibility evidence, not legal clearance or an automated
statutory approval. The legacy `/site-analysis` URL redirects to `/projects`.
Projects store candidate geometry, evidence, assertions and phased plans.

## Data and trust boundaries

- Public facts, operator declarations and ministry verification remain distinct.
- Public registry entries come from approved snapshots, never directly from a
  private submission.
- Exact facility geometry is restricted; public geometry is stored separately.
- Every published fact retains source and review provenance.
- Public operational status must be revalidated at least every 90 days.
- Infrastructure proximity does not imply available capacity.
- Sensitive network, customer, resilience and cybersecurity details are not
  public fields.
- No numeric confidence score is used as a substitute for evidence and review.

## Technology

### Frontend

- React 19 and TypeScript
- Vite 8
- Tailwind CSS 4
- MapLibre GL JS
- TanStack Query
- Zustand
- Recharts and Lucide React

### Backend and storage

- Python 3.11
- FastAPI
- SQLAlchemy and Alembic
- SQLite
- Pydantic

SQLite is appropriate for the current single-node prototype. Production
multi-user deployment, national scale and high-rate private telemetry would
require a reviewed production database and operational architecture.

## Repository layout

```text
EcoTerminal/
├── backend/                  FastAPI service, migrations, CLI scripts, tests and SQLite DB
│   ├── app/                  Domain core, API routers, Pydantic schemas, SQLAlchemy models & services
│   │   ├── data/             Connector pipelines (NASA SRTM, STAC, CPCB, WorldPop, etc.)
│   │   ├── jobs/             Scheduled ingestion background jobs
│   │   ├── models/           SQLAlchemy ORM models
│   │   ├── routers/          REST API endpoints (/api/v1/*)
│   │   ├── schemas/          Pydantic validation schemas
│   │   └── services/         Database repositories & business logic services
│   ├── data/                 SQLite database (ecosite.db), boundaries, raw caches & backups
│   ├── migrations/           Alembic schema version migrations (revision 04c_001)
│   ├── scripts/              CLI utilities (init_db, database_maintenance, seeders, audits)
│   └── tests/                Complete unittest test suite (255 unit & integration tests)
├── data/                     Authoritative data catalogs, datasets & research
│   ├── official_documents/   Statutory PDFs, gazettes, policies and DISCOM schedules
│   └── research/             11 product, data & regulatory research papers
├── docs/                     System architecture, contracts, runbooks & UX specs
│   ├── assets/               Architecture diagrams, screenshots and references
│   ├── contracts/            API & database specifications
│   ├── data/                 Data source registry & verification protocols
│   ├── design/               Frontend clarity & UI/UX design specifications
│   ├── implementation/       Technical architecture, ingestion backbone & delivery boards
│   └── operations/           SQLite database operations runbook
├── frontend/                 React 19 + TypeScript + Vite SPA
│   └── src/
│       ├── app/              Application routing and React Query providers
│       ├── components/       Feature-based components (community, dashboard, facilities, map, etc.)
│       ├── data/             Geospatial overlays, reference layers & mitigations
│       ├── hooks/            Custom React hooks
│       ├── pages/            Route view pages (Dashboard, Projects, PublicFacilities, etc.)
│       ├── services/         API client and query service layers
│       ├── stores/           Zustand reactive state stores
│       ├── types/            TypeScript domain interfaces and types
│       └── utils/            Formatters, calculations, insights and GIS utilities
├── shared/                   Shared cross-stack schemas and pilot facility references
├── package.json              Unified monorepo workspace commands (backend, dev, db:init, test)
├── plan.md                   Phased implementation plan
├── tracker.md                Technical milestone and delivery status tracker
└── workdone.md               Comprehensive implementation and delivery record
```

## Local development

### Prerequisites

- Node.js 20.19+, 22.13+ or 24+
- Python 3.11 for the checked backend baseline

Do not use the incompatible Python 3.15 environment for backend verification.
Call the Python 3.11 virtual environment directly.

### Install

From the repository root:

```powershell
npm --prefix frontend ci
py -3.11 -m venv backend\.venv
backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt -r backend\requirements-dev.txt
```

On macOS/Linux, replace the virtual-environment commands with:

```bash
python3.11 -m venv backend/.venv
backend/.venv/bin/python -m pip install -r backend/requirements.txt -r backend/requirements-dev.txt
```

Do not recreate or overwrite an existing working virtual environment.

### Run

Start the backend from the repository root:

```powershell
backend\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000 --app-dir backend
```

Start the frontend in another terminal:

```powershell
npm --prefix frontend run dev
```

Open `http://localhost:5173`. Vite proxies `/api` to
`http://127.0.0.1:8000` by default.

- Health: `http://localhost:8000/health`
- OpenAPI: `http://localhost:8000/docs`

The FastAPI backend is required for registry, environmental and workflow data.
These government/public routes do not use a browser demo-mode fallback.

## Configuration

Use `frontend/.env.example` as the frontend reference and put local overrides
in `frontend/.env.local`.

- `VITE_API_BASE_URL=/api/v1` sets the browser API prefix.
- `ECOSITE_API_PROXY_TARGET` changes the development proxy target without
  exposing it to the browser.
- `VITE_MAPBOX_TOKEN` is an optional public basemap token. CARTO/ESRI defaults
  work without it.
- all `VITE_*` values are browser-visible; never place private credentials in
  frontend configuration.
- backend environment variables are read from the process first. On startup the
  service also loads `backend/.env`, then the repository-root `.env`, when
  `python-dotenv` is installed and the file exists. A value already set in the
  process wins, and a variable added to `.env` after the server started needs a
  restart.
- `ECOSITE_EARTHDATA_TOKEN` is the NASA Earthdata bearer token used by the SRTM
  connector. Without it, SRTM analysis returns "token is not configured"; the
  token is read server-side only. Create one at
  <https://urs.earthdata.nasa.gov/> and keep it out of version control.
- `ECOSITE_DB_PATH` may override the application-relative
  `backend/data/ecosite.db` path. Prefer an absolute override when needed.

Both `.env` files are ignored by Git. Never commit real tokens or paste them
into tracked files; `backend/.env.example` and `frontend/.env.example` document
the variable names only.

Production hosting must provide API routing or an explicit API URL with matching
CORS configuration.

## Primary API groups

- `/api/v1/public-facilities` and `/summary`
- `/api/v1/public-facilities/{id}`
- `/api/v1/public-facilities/{id}/environmental/current`
- `/api/v1/public-facilities/{id}/environmental`
- `/api/v1/environmental/summary`
- `/api/v1/ministry/operations/*`
- operator submission and ministry review workflow endpoints
- project, site-screening and evidence endpoints

Use the generated OpenAPI document for the complete request and response
contracts.

## Verification

Run from the repository root:

```powershell
backend\.venv\Scripts\python.exe -B -m unittest discover -s backend/tests -v
npm --prefix frontend run lint
npm --prefix frontend run test
npm --prefix frontend run build
```

Checked local baseline:

- backend: 184/184 tests passing under Python 3.11
- frontend: 220/220 tests passing
- frontend ESLint passing
- production frontend build passing
- SQLite migration revision `04c_001`
- `PRAGMA integrity_check=ok`, no foreign-key violations and no Alembic drift

The Vite build may report a non-blocking large-bundle warning. Route-level code
splitting remains a performance-hardening task.

## Security notes

- Keep the current unauthenticated/demo-identity prototype on loopback only.
- Never put provider keys, ingestion credentials or private operator data in
  Vite variables or browser storage.
- External AI assistance remains disabled. The Gemini endpoint returns an
  unavailable response and does not call an external provider.
- Any future external provider integration requires server-side secrets,
  authentication, authorization, quotas, budget controls and redacted logging.
- Do not disable TLS verification to work around local certificate problems.

See [backend/README.md](backend/README.md), [plan.md](plan.md),
[tracker.md](tracker.md) and [docs/implementation](docs/implementation/) for
implementation detail and operational runbooks.
