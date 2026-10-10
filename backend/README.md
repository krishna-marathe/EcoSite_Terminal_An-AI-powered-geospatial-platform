# EcoSite Terminal backend

FastAPI service for provenance-aware infrastructure and environmental intelligence.

## Run locally

From this directory:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Health check: `http://localhost:8000/health`

OpenAPI docs: `http://localhost:8000/docs`

The service seeds three clearly marked synthetic records into SQLite on first start. Replace them through `POST /api/v1/ingestion/facilities` after validating official source data.

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

