# EcoSite Terminal backend

FastAPI service for provenance-aware infrastructure and environmental intelligence.

## Run locally

Use Python 3.11 for the checked baseline. From this directory, create `.venv`
only if it does not already exist. The commands below call the virtual environment's
interpreter directly, so they work even on default Windows PowerShell installs
where `Activate.ps1` is blocked by the execution policy.

### Windows (PowerShell)

```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt -r requirements-dev.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

To activate the environment instead, run `.\.venv\Scripts\Activate.ps1`. If that
fails with *"running scripts is disabled on this system"*, either allow local
scripts once with
`Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`, or use
Command Prompt and run `.\.venv\Scripts\activate.bat`.

### macOS / Linux

```bash
python3.11 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt -r requirements-dev.txt
.venv/bin/python -m uvicorn app.main:app --reload --port 8000
```

Health check: `http://localhost:8000/health`

OpenAPI docs: `http://localhost:8000/docs`

The service seeds the clearly marked synthetic pilot dataset from `shared/pilot.json` (6 records across the Pune and Mumbai pilot cities, scoring version `sector-screening-v1`) into SQLite on first start, and refreshes derived risk scores on every boot. Replace or extend records through `POST /api/v1/ingestion/facilities` after validating official source data.

Measured locally during QA: ingesting 5,000 records takes 0.33 s (≈ 15k records/s); city-scoped facility page p50 8.3 ms / p95 14.9 ms; facility detail p50 30.3 ms; SQLite database 6.8 MiB.

### Configuration

The app reads process environment variables; it does not automatically load
`.env` files. If needed, create your own `backend/.env` from the non-secret
example without replacing an existing file, and add `--env-file backend/.env`
to the root-level Uvicorn command (or `--env-file .env` from this directory).
Uvicorn standard already provides the dotenv dependency.

Leave `ECOSITE_DB_PATH` unset to use the application-relative
`backend/data/ecosite.db` default regardless of the working directory. An
explicit relative path is resolved against the launch directory: `./data/ecosite.db`
from the repository root is a different file. Use an absolute override when needed.
Normal server startup seeds and refreshes facility scores; it is not read-only.

If pip reports a nonexistent CA bundle (for example an inherited
`CURL_CA_BUNDLE` pointing into PostgreSQL), correct that machine setting or
use a valid CA bundle for the current process. Do not disable TLS verification.

### Tests

From the repository root (the suite imports `backend.app`, so it expects the repo root on `sys.path`):

```powershell
backend\.venv\Scripts\python.exe -m pip install -r backend/requirements-dev.txt
backend\.venv\Scripts\python.exe -B -m unittest discover -s backend/tests -v
```

On macOS/Linux, use `backend/.venv/bin/python` in both commands.

The suite uses FastAPI's `TestClient` and pinned `httpx==0.28.1`. Each test patches
`DB_PATH` to a temporary database before starting the client. Phase 01A verified
that the normal database hash and modification time stayed unchanged.

Windows baseline after dependency recovery: seven tests ran; the forecast test
passed and the other six errored in `tearDown` at `self.temp.cleanup()`. SQLite
connection context managers commit/roll back but do not close connections. Open
handles block deletion on Windows (`WinError 32`, followed by `WinError 267`).
No assertion failures were reported, but the suite exits 1 and is not green.
Explicit connection cleanup needs a separately reviewed application/test fix;
do not suppress cleanup errors to report a pass.

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


## External AI security

`POST /api/v1/mitigation-plans/gemini` is intentionally disabled: valid requests
return HTTP 503 with an unavailable message. Unknown fields (including legacy
`api_key`) or invalid values return a generic 422 without echoing input. Bodies
over 16 KiB return 413; constraints are limited to 4000 characters, facility IDs
and focus areas to 200 characters. No external provider call is made.

There is no environment flag to activate the endpoint in this baseline. Any
future private provider credential must come exclusively from a backend process
environment or secret manager, never Vite or a client payload. Before activation,
implement authentication, authorization, quotas/rate limits, budget controls and
redacted logging. Configuring a server key alone must not enable a public paid proxy.
The deterministic `/mitigation-plans` endpoint remains independent and available.
