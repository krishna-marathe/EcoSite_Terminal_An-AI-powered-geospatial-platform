# EcoSite Terminal backend

FastAPI service for provenance-aware infrastructure and environmental intelligence.

## Run locally

From this directory. The commands below call the virtual environment's
interpreter directly, so they work even on default Windows PowerShell installs
where `Activate.ps1` is blocked by the execution policy.

### Windows (PowerShell)

```powershell
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

To activate the environment instead, run `.\.venv\Scripts\Activate.ps1`. If that
fails with *"running scripts is disabled on this system"*, either allow local
scripts once with
`Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`, or use
Command Prompt and run `.\.venv\Scripts\activate.bat`.

### macOS / Linux

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python -m uvicorn app.main:app --reload --port 8000
```

Health check: `http://localhost:8000/health`

OpenAPI docs: `http://localhost:8000/docs`

The service seeds the clearly marked synthetic pilot dataset from `shared/pilot.json` (6 records across the Pune and Mumbai pilot cities, scoring version `sector-screening-v1`) into SQLite on first start, and refreshes derived risk scores on every boot. Replace or extend records through `POST /api/v1/ingestion/facilities` after validating official source data.

Measured locally during QA: ingesting 5,000 records takes 0.33 s (≈ 15k records/s); city-scoped facility page p50 8.3 ms / p95 14.9 ms; facility detail p50 30.3 ms; SQLite database 6.8 MiB.

### Tests

From the repository root (the suite imports `backend.app`, so it expects the repo root on `sys.path`):

```bash
backend/.venv/bin/python -m pip install -r backend/requirements-dev.txt
backend/.venv/bin/python -m unittest discover -s backend/tests -v
```

The suite uses FastAPI's `TestClient` (needs `httpx` from `requirements-dev.txt`) and a temporary SQLite database, so it never touches your local `ecosite.db`.

## API surface

- `GET /api/v1/facilities`
- `GET /api/v1/facilities/{facility_id}`
- `GET /api/v1/environmental-layers`
- `GET /api/v1/risk-assessments/{facility_id}`
- `POST /api/v1/site-assessments`
- `POST /api/v1/forecasts`
- `POST /api/v1/mitigation-plans`
- `GET /api/v1/reports/{report_id}`
- `POST /api/v1/ingestion/facilities`

The ingestion endpoint accepts normalized records and stores source organization, source URL, dates, geographic resolution, status, and confidence with every facility.

