# EcoSite Terminal — Environmental Intelligence Dashboard

> **Intelligent Infrastructure. Sustainable India.**
>
> A dark terminal-style workspace for screening environmental risk at infrastructure sites in the **Pune and Mumbai pilot cities**. Synthetic demo data is the default; an optional FastAPI backend serves API mode.

---

## 1. Key Capabilities & Application Modules

The application is built across six specialized intelligence modules:

### 🌐 Module 01: World Monitor Geospatial Command Center (`/dashboard`)
- **World Monitor Tactical HUD Header**:
  - Live ticking UTC clock (`UTC 08:14:22`)
  - Multi-horizon time range selectors: `[1H]`, `[24H]`, `[7D]`, `[30D]`, `[ALL]`
  - View mode switchers: `[SPLIT (Map + Signals)]`, `[MAP ONLY]`, `[GRID ONLY]`
  - Audio alert sound status toggle `[AUDIO: ON/OFF]`
  - Module navigation bar (`Dashboard`, `Risk analysis`, `Forecast`, `Site analysis`, `Mitigation`, `Reports`)
- **Tactical Layer Ribbon Dock** (Synchronized with URL `layers=...` parameter):
  - `[🔥 Hotspots]` — Cumulative stress clusters >75
  - `[💧 Aquifers]` — CGWB Over-Exploited & Critical groundwater blocks
  - `[🏭 Data Centres]` — Hyperscale cloud facilities & subsea cable landings
  - `[⚡ Thermal Power]` — Super thermal generation & stack CEMS monitors
  - `[📡 Grid Hubs]` — 765/400kV HVDC switching yards
  - `[🌪️ Air Quality]` — CPCB CAAQMS stations & PM2.5 plume tracking
  - `[☀️ Heat Anomaly]` — MODIS Land Surface Temperature >42°C hotspots
  - `[🔌 Grid Pressure]` — Substations operating above 80% thermal limit
  - `[🌊 Flood Zones]` — NDMA 100-year riverine & storm surge contours
  - `[🛡️ Waterways]` — CWC major reservoir & dam catchment status
  - `[🌱 Renewables]` — Ultra-mega solar complexes & wind energy corridors
  - `[🌲 Eco-Buffers]` — Statutory 10km Wildlife & Eco-Sensitive Zones (ESZ)
- **Live OSINT Signals Wire Panel**:
  - Real-time streaming ticker of environmental and grid events with severity badges (`CRITICAL`, `HIGH`, `ELEVATED`, `NOMINAL`), timestamps (`2m ago`), coordinates, and source agencies (`CPCB`, `CGWB`, `WRLDC`, `NDMA`).
  - Filterable by severity level with instant 1-click map fly-to and dossier expansion.
- **Ranked Environmental Hotspots Panel**:
  - Ranked matrix of critical infrastructure clusters sorted by compound risk score with live progress bars and 7-day trend deltas (`+3.4% 7d`).
- **Macro Energy & Ecological Telemetry Cards**:
  - Monitored Capacity (GW), Mean Aquifer Extraction Stage (%), Peak Grid Headroom (%), Compound Risk Index, Surrounding 5km Population Buffer, and Clean RE Generation (GW).
- **Slide-Over Deep Dive Dossier**:
  - Slide-out intelligence dossier (matching World Monitor's deep dive drawer) displaying 6-axis radar charts, 5-year water trends, population buffers, dataset provenance, and direct action triggers.

### 📊 Module 02: Explainable Environmental Risk Analysis (`/risk-analysis`)
- **Sector-Specific Risk Weights**: Tailored weighting profiles (e.g. data centres prioritize grid load and evaporative cooling water; thermal plants prioritize SO₂/NOx/ash emissions; solar/wind prioritize land sensitivity and bird flight paths).
- **Interactive Transparent Weight Tuner**: Real-time multi-criteria slider tuner recalculating compound scores on the fly.
- **Risk Contribution Breakdown**: Recharts bar chart visualizing the percentage contribution of each vector.
- **8 Statutory Explainable Vectors**: Water stress, energy/grid pressure, air pollution, heat exposure, flood hazard, population proximity, land sensitivity, and biodiversity constraints with dataset attribution and recommended site verification actions.
- **Pre-Feasibility Disclaimer**: Explicit notification distinguishing pre-feasibility screening from statutory MoEFCC Environmental Impact Assessments (EIA).

### 📈 Module 03: ML Environmental Forecasting (`/forecast`)
- **Predictive Trajectories**: Stored historical series combined with synthetic model projections and an uncertainty band.
- **95% Confidence Uncertainty Envelopes**: Shaded bounds representing model uncertainty.
- **Environmental Metrics**: Electricity demand growth (MW), groundwater table depletion (m bgl), ambient PM2.5 air quality (µg/m³), summer surface temperature anomaly (°C), and compound environmental stress index.
- **FastAPI Integration Inspector**: Interactive toggle showing exact HTTP request and response JSON payloads matching backend specification (`POST /api/v1/forecasts`).

### 📍 Module 04: Proposed Site Evaluation (`/site-analysis`)
- **Interactive Proposal Engine**: Test proposed greenfield or brownfield coordinates within the selected pilot city's bounds.
- **Quick Preset Corridors**: Dholera SIR Gujarat, Navi Mumbai MIDC, Oragadam Tamil Nadu, Noida Expressway UP, and Kurnool AP.
- **Proximity Calculation Engine**: Distance to 400kV substations, statutory 10km Eco-Sensitive Zones (ESZ), CGWB aquifer classification, and 5km population buffers.
- **Candidate Alternative Comparison**: Multi-site comparison matrix ranking candidate sites side-by-side with clear criteria.

### ✨ Module 05: AI Mitigation Planner (`/mitigation`)
- **Structured Sustainability Roadmaps**: Concrete engineering interventions categorized by Water Conservation, Renewable Energy, Energy Efficiency, Waste & Emissions, and Ecology.
- **Action Attributes**: High/Medium/Low priority, implementation timeframe, responsible stakeholder, quantifiable environmental benefit (e.g. m³ water saved, tCO₂e avoided), and statutory compliance benchmarks.
- **Gemini AI Strategy Generator**: Interactive prompt input to synthesize tailored mitigation strategies based on site-specific constraints (e.g. ZLD mandates, target PUE, CAPEX budgets).

### 📑 Module 06: Reports & Data Explorer (`/reports`)
- **Facility Register**: Searchable and filterable table of the selected city's facilities.
- **Working CSV Data Export**:
  - `Export Facilities CSV`
  - `Export Provenance Catalog CSV`
  - `Export Mitigation Plan CSV`
- **Statutory Dataset Provenance Catalog**: Comprehensive documentation of 14 official feeds (CGWB, CPCB, CEA, CWC, NRSC Bhuvan, WII, NDMA, IMD) with update frequencies, confidence ratings, and legal basis.
- **Printable Executive Intelligence Dossier**: Print-ready format (`Ctrl+P` / `window.print()`) with high-contrast executive formatting.

---

## 2. Technology Stack

- **Framework**: React 19 + TypeScript (strict typing)
- **Bundler & Tooling**: Vite 8
- **Styling**: Tailwind CSS v4 with custom dark geospatial design tokens
- **Map Engine**: MapLibre GL JS (`maplibre-gl`)
- **State Management**: Zustand
- **Async Data Fetching**: TanStack Query (`@tanstack/react-query`)
- **Charts & Visualizations**: Recharts
- **Icons**: Lucide React
- **HTTP Client**: Axios

---

## 3. Directory Structure

```text
EcoSite/
├── .env.example
├── package.json
├── README.md
└── frontend/
    ├── .env.example
    ├── package.json
    ├── vite.config.ts
    ├── tsconfig.app.json
    ├── index.html
    └── src/
        ├── app/
        │   ├── router.tsx
        │   └── providers.tsx
        ├── components/
        │   ├── layout/
        │   │   ├── AppLayout.tsx
        │   │   ├── LeftSidebar.tsx
        │   │   ├── PlanningBar.tsx
        │   │   └── StatusBar.tsx
        │   ├── map/
        │   │   └── MainMap.tsx
        │   ├── site-analysis/
        │   │   └── SiteMapPicker.tsx
        │   ├── worldmonitor/
        │   │   ├── EcoWorkspace.tsx
        │   │   ├── SlideOverDeepDive.tsx
        │   │   ├── ScenarioEngine.tsx
        │   │   └── … dashboard panels
        │   └── ui/
        │       ├── Badge.tsx
        │       ├── Button.tsx
        │       ├── Card.tsx
        │       ├── DataConfidenceTag.tsx
        │       ├── DataTable.tsx
        │       ├── Field.tsx
        │       ├── MetricTile.tsx
        │       ├── PageHeader.tsx
        │       └── StateViews.tsx
        ├── pages/
        │   ├── Dashboard.tsx
        │   ├── RiskAnalysis.tsx
        │   ├── Forecast.tsx
        │   ├── SiteAnalysis.tsx
        │   ├── Mitigation.tsx
        │   └── Reports.tsx
        ├── services/
        │   ├── api.ts
        │   ├── facilities.ts
        │   ├── risk.ts
        │   ├── forecasts.ts
        │   ├── siteAssessments.ts
        │   └── mitigation.ts
        ├── stores/
        │   └── dashboardStore.ts
        ├── types/
        │   └── index.ts
        ├── data/
        │   ├── pilotCities.ts
        │   └── demo/
        │       ├── layers.ts
        │       ├── wmLayers.ts
        │       ├── environmentalOverlays.ts
        │       ├── forecasts.ts
        │       ├── mitigations.ts
        │       └── provenance.ts
        ├── utils/
        │   └── csvExport.ts
        ├── App.tsx
        ├── main.tsx
        └── index.css
```

---

## 4. Getting Started

### Prerequisites
- Node.js (v18 or higher recommended)
- npm (v9 or higher)
- Python 3.10+ (only required for the optional FastAPI backend)

### Installation
Run from the root directory:

```bash
npm install
```

### Development Server
Start the local development server:

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

The dev server proxies `/api` to `http://localhost:8000` (see `frontend/vite.config.ts`), so the frontend connects to the backend automatically when it is running.

### Backend Service (Optional)

The frontend runs fully in demo mode without a backend — when no API is
reachable, the built-in demo data adapter serves the synthetic datasets
described in section 5. To run the FastAPI service, see
[`backend/README.md`](backend/README.md). Quick start from the repository root:

**Windows (PowerShell):**

```powershell
py -m venv backend\.venv
backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
backend\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000 --app-dir backend
```

**macOS / Linux:**

```bash
python3 -m venv backend/.venv
backend/.venv/bin/python -m pip install -r backend/requirements.txt
backend/.venv/bin/python -m uvicorn app.main:app --reload --port 8000 --app-dir backend
```

These forms call the virtual environment's interpreter directly, so they work
regardless of PowerShell execution policy or which Python is first on `PATH`.
On Windows, `npm run backend:install` creates `backend\.venv` and installs the
dependencies, and `npm run backend` starts the service from that environment.

Health check: `http://localhost:8000/health` · OpenAPI docs: `http://localhost:8000/docs`

### Production Build
Verify that the production build completes cleanly:

```bash
npm run build
```

---

## 5. Backend API Contracts & Integration

EcoSite Terminal frontend is configured to communicate with a Python FastAPI backend service via `VITE_API_BASE_URL`.

When no backend is active, the built-in **Demo Data Adapter** automatically handles requests seamlessly with synthetic pilot datasets for Pune and Mumbai and explicit `"DEMO DATA"` provenance tags.

Measured locally during QA: 5,000-record ingestion in 0.33 s (≈ 15k records/s); city facility page p50 8.3 ms / p95 14.9 ms; facility detail p50 30.3 ms; SQLite database 6.8 MiB.

Key API endpoints:
- `GET /api/v1/facilities` — Retrieve facility list with spatial filters
- `GET /api/v1/facilities/{id}` — Retrieve facility details
- `POST /api/v1/forecasts` — Generate multi-horizon ML predictions
- `POST /api/v1/site-assessments` — Evaluate candidate coordinates
- `POST /api/v1/mitigation-plans` — Generate Gemini-assisted action plans
