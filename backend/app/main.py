from __future__ import annotations

import json
import math
import os
import sqlite3
import secrets
from uuid import uuid4
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from contextlib import closing
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Literal

from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy.orm import Session

from .db import DB_PATH, make_engine
from .data.registry import seed_data_sources
from .routers.projects import router as projects_router
from .routers.sites import router as sites_router
from .routers.phases import router as phases_router
from .routers.data_sources import router as data_sources_router
from .routers.environmental import router as environmental_router
from .routers.evidence import router as evidence_router
from .routers.extraction import router as extraction_router
from .routers.commitments import router as commitments_router
from .routers.comparison import router as comparison_router
from .routers.benchmarks import router as benchmarks_router
from .routers.public_facilities import router as public_facilities_router
from .routers.public_environmental import router as public_environmental_router
from .routers.risk import router as risk_router
from .routers.news import router as news_router
from .routers.ai_assist import router as ai_assist_router
from .routers.restricted_workflows import router as restricted_workflows_router
from .routers.resource_outlook import router as resource_outlook_router
from .services.public_facilities import PublicFacilityService
from .services.public_facility_sqlalchemy import SqlAlchemyPublicFacilityRepository
from .services.environmental_monitoring import EnvironmentalMonitoringService
from .services.environmental_sqlalchemy import SqlAlchemyEnvironmentalRepository
from .services.ministry_operations import MinistryOperationsService
from .services.ministry_sqlalchemy import SqlAlchemyMinistryOperationsRepository
from .services.prototype_publication import build_prototype_submission_workflow
from .services.news import build_news_service


ROOT = Path(__file__).resolve().parents[1]
try:
    from dotenv import load_dotenv
    load_dotenv(ROOT / ".env")
    load_dotenv(ROOT.parent / ".env")
except ImportError:
    pass
API_PREFIX = os.getenv("ECOSITE_API_PREFIX", "/api/v1")
CORS_ORIGINS = [origin.strip() for origin in os.getenv("ECOSITE_CORS_ORIGINS", "http://localhost:5173").split(",") if origin.strip()]

PILOT = json.loads((ROOT.parent / "shared" / "pilot.json").read_text())
CITIES = {city["id"]: city for city in PILOT["cities"]}
CityId = Literal["pune", "mumbai"]


def classify_city(coordinates: tuple[float, float]) -> str | None:
    longitude, latitude = coordinates
    for city_id, city in CITIES.items():
        west, south, east, north = city["bounds"]
        if west <= longitude <= east and south <= latitude <= north:
            return city_id
    return None


RiskLevel = Literal["low", "moderate", "high", "critical"]
DataStatus = Literal["observed", "estimated", "synthetic", "unavailable"]
InfrastructureType = Literal[
    "data_centre", "thermal_power", "hydro_power", "solar_farm", "wind_farm", "substation", "industrial"
]


class Provenance(BaseModel):
    sourceOrganization: str
    sourceUrl: str | None = None
    publicationDate: str
    lastUpdated: str
    geographicResolution: str
    dataStatus: DataStatus
    confidenceScore: int = Field(ge=0, le=100)


class Indicators(BaseModel):
    waterStress: int = Field(ge=0, le=100)
    gridPressure: int = Field(ge=0, le=100)
    airPollution: int = Field(ge=0, le=100)
    heatExposure: int = Field(ge=0, le=100)
    floodHazard: int = Field(ge=0, le=100)
    populationProximity: int = Field(ge=0, le=100)
    landSensitivity: int = Field(ge=0, le=100)
    biodiversityConstraint: int = Field(ge=0, le=100)


class NearbyPopulation(BaseModel):
    radius5km: int = Field(ge=0)
    radius15km: int = Field(ge=0)
    radius25km: int = Field(ge=0)


class HistoricalTrend(BaseModel):
    year: int
    riskScore: int
    waterDemandKld: float
    powerConsumptionMwh: float | None = None


class Facility(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(min_length=1)
    cityId: CityId | None = None
    scoringVersion: str = PILOT["scoringVersion"]
    name: str
    type: InfrastructureType
    state: str
    district: str
    coordinates: tuple[float, float]
    capacityMw: float | None = None
    operator: str | None = None
    yearCommissioned: int | None = None
    overallRiskScore: int = Field(ge=0, le=100)
    riskLevel: RiskLevel
    indicators: Indicators
    keyRiskFactors: list[str]
    nearbyPopulation: NearbyPopulation
    historicalTrends: list[HistoricalTrend]
    provenance: Provenance


    @model_validator(mode="after")
    def validate_location(self):
        longitude, latitude = self.coordinates
        if not (math.isfinite(longitude) and math.isfinite(latitude) and -180 <= longitude <= 180 and -90 <= latitude <= 90):
            raise ValueError("Coordinates must be finite longitude/latitude within global bounds")
        city = classify_city(self.coordinates)
        if self.cityId is not None and self.cityId != city:
            raise ValueError("cityId does not match the configured planning extent")
        self.cityId = city
        return self


class FacilityIngestRecord(Facility):
    pass


class FacilityIngestRequest(BaseModel):
    sourceOrganization: str
    sourceUrl: str | None = None
    records: list[FacilityIngestRecord] = Field(min_length=1)


class SiteAssessmentRequest(BaseModel):
    cityId: CityId
    name: str
    type: InfrastructureType
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    capacityMw: float = Field(ge=0)
    waterDemandKld: float | None = Field(default=None, ge=0)
    powerDemandMw: float | None = Field(default=None, ge=0)
    state: str | None = None


class ForecastRequest(BaseModel):
    location_id: CityId
    metric: Literal["electricity_demand", "groundwater_depletion", "air_quality", "temperature_heat", "environmental_risk_index"]
    horizon_months: int = Field(ge=1, le=60)


class MitigationRequest(BaseModel):
    facility_id: str | None = None
    facility_type: InfrastructureType | Literal["all"] | None = None
    constraints: str | None = None
    focus_area: str | None = None


class NewsItem(BaseModel):
    title: str
    url: str
    source: str
    publishedAt: str
    summary: str | None = None
    dataStatus: DataStatus = "observed"


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def json_dumps(value: Any) -> str:
    return json.dumps(value, separators=(",", ":"))


def ensure_database() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with closing(sqlite3.connect(DB_PATH)) as connection, connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS facilities (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                type TEXT NOT NULL,
                state TEXT NOT NULL,
                district TEXT NOT NULL,
                longitude REAL NOT NULL,
                latitude REAL NOT NULL,
                risk_score INTEGER NOT NULL,
                risk_level TEXT NOT NULL,
                payload TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )
        connection.commit()


def seed_facilities() -> None:
    with closing(sqlite3.connect(DB_PATH)) as connection, connection:
        for record in PILOT["facilities"]:
            if not connection.execute("SELECT 1 FROM facilities WHERE id = ?", (record["id"],)).fetchone():
                upsert_facility(Facility.model_validate(record), connection)
        # Refresh derived scores for legacy rows without replacing their source data.
        for (payload,) in connection.execute("SELECT payload FROM facilities").fetchall():
            upsert_facility(Facility.model_validate_json(payload), connection)


def upsert_facility(facility: Facility, connection: sqlite3.Connection | None = None) -> None:
    score = weighted_risk(facility.indicators, facility.type)
    facility = facility.model_copy(update={"overallRiskScore": score, "riskLevel": risk_level(score), "scoringVersion": PILOT["scoringVersion"]})
    owns_connection = connection is None
    connection = connection or sqlite3.connect(DB_PATH)
    try:
        connection.execute(
            """INSERT INTO facilities (id, name, type, state, district, longitude, latitude, risk_score, risk_level, payload, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(id) DO UPDATE SET name=excluded.name, type=excluded.type, state=excluded.state,
               district=excluded.district, longitude=excluded.longitude, latitude=excluded.latitude,
               risk_score=excluded.risk_score, risk_level=excluded.risk_level, payload=excluded.payload,
               updated_at=excluded.updated_at""",
            (facility.id, facility.name, facility.type, facility.state, facility.district, facility.coordinates[0], facility.coordinates[1], facility.overallRiskScore, facility.riskLevel, facility.model_dump_json(), utc_now()),
        )
        if owns_connection:
            connection.commit()
    finally:
        if owns_connection:
            connection.close()


def facility_from_row(row: sqlite3.Row) -> Facility:
    return Facility.model_validate(json.loads(row["payload"]))


def get_connection() -> sqlite3.Connection:
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def get_facility_or_404(facility_id: str) -> Facility:
    with closing(get_connection()) as connection, connection:
        row = connection.execute("SELECT * FROM facilities WHERE id = ?", (facility_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Facility not found")
    return facility_from_row(row)


def risk_level(score: int) -> RiskLevel:
    if score >= 80:
        return "critical"
    if score >= 65:
        return "high"
    if score >= 45:
        return "moderate"
    return "low"


def weighted_risk(indicators: Indicators, facility_type: InfrastructureType = "industrial") -> int:
    weights = PILOT["sectorWeights"][facility_type]
    # Math.round parity for non-negative normalized indicators.
    return math.floor(sum(getattr(indicators, key) * weight for key, weight in weights.items()) + 0.5)


app = FastAPI(title="EcoSite Terminal API", version="0.1.0", description="Environmental infrastructure intelligence API with provenance-aware demo data.")
app.state.project_origins = {origin for origin in CORS_ORIGINS if urllib.parse.urlsplit(origin).hostname in {"localhost", "127.0.0.1", "::1"}}
PUBLIC_REGISTRY_STORE = os.getenv("ECOSITE_PUBLIC_REGISTRY_STORE", "sqlite").strip().lower()
if PUBLIC_REGISTRY_STORE not in {"json", "sqlite"}:
    raise RuntimeError("ECOSITE_PUBLIC_REGISTRY_STORE must be 'json' or 'sqlite'.")
application_data_engine = make_engine(DB_PATH)
app.state.application_data_engine = application_data_engine
if PUBLIC_REGISTRY_STORE == "sqlite":
    public_registry_repository = SqlAlchemyPublicFacilityRepository(
        lambda: Session(application_data_engine, expire_on_commit=False)
    )
    app.state.public_facility_service = PublicFacilityService(public_registry_repository)
environmental_repository = SqlAlchemyEnvironmentalRepository(
    lambda: Session(application_data_engine, expire_on_commit=False)
)
app.state.environmental_monitoring_service = EnvironmentalMonitoringService(environmental_repository)
ministry_repository = SqlAlchemyMinistryOperationsRepository(
    lambda: Session(application_data_engine, expire_on_commit=False)
)
app.state.ministry_operations_service = MinistryOperationsService(ministry_repository)
app.state.news_service = build_news_service()


app.state.submission_workflow_service = build_prototype_submission_workflow(application_data_engine)
app.include_router(projects_router, prefix=API_PREFIX)
app.include_router(sites_router, prefix=API_PREFIX)
app.include_router(phases_router, prefix=API_PREFIX)
app.include_router(data_sources_router, prefix=API_PREFIX)
app.include_router(environmental_router, prefix=API_PREFIX)
app.include_router(evidence_router, prefix=API_PREFIX)
app.include_router(extraction_router, prefix=API_PREFIX)
app.include_router(commitments_router, prefix=API_PREFIX)
app.include_router(comparison_router, prefix=API_PREFIX)
app.include_router(benchmarks_router, prefix=API_PREFIX)
app.include_router(public_facilities_router, prefix=API_PREFIX)
app.include_router(public_environmental_router, prefix=API_PREFIX)
app.include_router(risk_router, prefix=API_PREFIX)
app.include_router(restricted_workflows_router, prefix=API_PREFIX)
app.include_router(news_router, prefix=API_PREFIX)
app.include_router(ai_assist_router, prefix=API_PREFIX)
app.include_router(resource_outlook_router, prefix=API_PREFIX)
app.add_middleware(CORSMiddleware, allow_origins=CORS_ORIGINS or ["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])


@app.on_event("startup")
def startup() -> None:
    import sys
    is_testing = "unittest" in sys.modules or "pytest" in sys.modules or os.getenv("ECOSITE_TEST_MODE") == "1"
    if not is_testing:
        try:
            from backend.scripts.init_db import bootstrap_database
            bootstrap_database(DB_PATH)
        except Exception as exc:
            print(f"[EcoSite DB] Startup bootstrap notice: {exc}")
    ensure_database()
    seed_facilities()
    with closing(sqlite3.connect(DB_PATH)) as connection, connection:
        seed_data_sources(connection)
        try:
            st_count = connection.execute("SELECT count(*) FROM monitoring_stations").fetchone()[0]
            if st_count == 0:
                from backend.scripts.seed_environmental_monitoring import run_seed as seed_env_monitoring
                seed_env_monitoring()
        except Exception:
            pass


@app.on_event("shutdown")
def shutdown() -> None:
    engine = getattr(app.state, "application_data_engine", None)
    if engine is not None:
        engine.dispose()


@app.get("/health")
def health() -> dict[str, Any]:
    with closing(get_connection()) as connection, connection:
        count = connection.execute("SELECT COUNT(*) FROM facilities").fetchone()[0]
    return {"status": "ok", "service": "ecosite-api", "facility_count": count, "timestamp": utc_now()}


@app.get(f"{API_PREFIX}/cities")
def list_cities() -> list[dict[str, Any]]:
    return PILOT["cities"]


@app.get(f"{API_PREFIX}/facilities", response_model=list[Facility])
def list_facilities(city: CityId | None = None, q: str | None = None, type: InfrastructureType | None = None, risk: RiskLevel | None = None, state: str | None = None, page: int = Query(1, ge=1), page_size: int = Query(100, ge=1, le=500)) -> list[Facility]:
    clauses: list[str] = []
    values: list[Any] = []
    if city:
        west, south, east, north = CITIES[city]["bounds"]
        clauses.append("longitude BETWEEN ? AND ? AND latitude BETWEEN ? AND ?")
        values.extend([west, east, south, north])
    if q:
        clauses.append("(LOWER(name) LIKE ? OR LOWER(state) LIKE ? OR LOWER(district) LIKE ?)")
        query = f"%{q.lower()}%"
        values.extend([query, query, query])
    if type:
        clauses.append("type = ?")
        values.append(type)
    if risk:
        clauses.append("risk_level = ?")
        values.append(risk)
    if state:
        clauses.append("LOWER(state) = ?")
        values.append(state.lower())
    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    offset = (page - 1) * page_size
    with closing(get_connection()) as connection, connection:
        rows = connection.execute(f"SELECT * FROM facilities {where} ORDER BY risk_score DESC, id ASC LIMIT ? OFFSET ?", [*values, page_size, offset]).fetchall()
    return [facility_from_row(row) for row in rows]


@app.get(f"{API_PREFIX}/facilities/{{facility_id}}", response_model=Facility)
def facility_detail(facility_id: str) -> Facility:
    return get_facility_or_404(facility_id)


@app.get(f"{API_PREFIX}/environmental-layers")
def environmental_layers() -> list[dict[str, Any]]:
    return [
        {"id": "cpcb-air-quality", "name": "Air Quality", "category": "environmental", "dataStatus": "unavailable", "sourceOrganization": "CPCB", "sourceUrl": "https://cpcb.nic.in/", "isAvailable": False},
        {"id": "bhuvan-land-use", "name": "Land Use / Land Cover", "category": "environmental", "dataStatus": "unavailable", "sourceOrganization": "NRSC Bhuvan", "sourceUrl": "https://bhuvan.nrsc.gov.in/", "isAvailable": False},
        {"id": "bhuvan-flood-hazard", "name": "Flood Hazard", "category": "environmental", "dataStatus": "unavailable", "sourceOrganization": "NRSC Bhuvan", "sourceUrl": "https://bhuvan.nrsc.gov.in/wiki/index.php/How_to_use_WMS_services", "isAvailable": False},
        {"id": "cgwb-groundwater", "name": "Groundwater Stress", "category": "environmental", "dataStatus": "unavailable", "sourceOrganization": "CGWB / India-WRIS", "sourceUrl": "https://indiawris.gov.in/", "isAvailable": False},
    ]


@app.get(f"{API_PREFIX}/news", response_model=list[NewsItem])
def environmental_news(q: str = Query("environmental policy India", min_length=3, max_length=120), limit: int = Query(8, ge=1, le=20)) -> list[NewsItem]:
    """Fetch a small, attributed policy/news feed for the dashboard.

    This is intentionally server-side so the frontend does not expose feed
    parsing or run into browser CORS restrictions. Replace the RSS source with
    licensed provider adapters before production use.
    """
    feed_url = "https://news.google.com/rss/search?" + urllib.parse.urlencode({"q": q, "hl": "en-IN", "gl": "IN", "ceid": "IN:en"})
    request = urllib.request.Request(feed_url, headers={"User-Agent": "EcoSiteAI/0.1 (+https://ecosite.ai)"})
    try:
        with urllib.request.urlopen(request, timeout=8) as response:
            root = ET.fromstring(response.read())
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"News feed unavailable: {exc}") from exc

    items: list[NewsItem] = []
    for item in root.findall("./channel/item")[:limit]:
        title = (item.findtext("title") or "Untitled policy update").strip()
        link = (item.findtext("link") or "").strip()
        published = (item.findtext("pubDate") or "").strip()
        source_node = item.find("source")
        source = (source_node.text if source_node is not None else "News RSS") or "News RSS"
        summary = (item.findtext("description") or "").strip()
        items.append(NewsItem(title=title, url=link, source=source, publishedAt=published, summary=summary[:240]))
    return items


@app.get(f"{API_PREFIX}/risk-assessments/{{facility_id}}")
def risk_assessment(facility_id: str) -> dict[str, Any]:
    facility = get_facility_or_404(facility_id)
    score = weighted_risk(facility.indicators, facility.type)
    return {"facilityId": facility.id, "overallScore": score, "riskLevel": risk_level(score), "isComplianceDetermination": False, "indicators": facility.indicators.model_dump(), "weights": PILOT["sectorWeights"][facility.type], "scoringVersion": PILOT["scoringVersion"], "provenance": facility.provenance.model_dump()}


@app.post(f"{API_PREFIX}/site-assessments")
def site_assessment(request: SiteAssessmentRequest) -> dict[str, Any]:
    if classify_city((request.longitude, request.latitude)) != request.cityId:
        raise HTTPException(status_code=422, detail="Site must lie within the selected city's illustrative planning extent")
    with closing(get_connection()) as connection, connection:
        rows = connection.execute("SELECT * FROM facilities WHERE type = ?", ("substation",)).fetchall()
    substations = [facility_from_row(row) for row in rows if classify_city((row["longitude"], row["latitude"])) == request.cityId]
    distances = [6371 * 2 * math.asin(min(1, math.sqrt(
        math.sin(math.radians(f.coordinates[1] - request.latitude) / 2) ** 2
        + math.cos(math.radians(request.latitude)) * math.cos(math.radians(f.coordinates[1]))
        * math.sin(math.radians(f.coordinates[0] - request.longitude) / 2) ** 2
    ))) for f in substations]
    return {"id": f"site-{uuid4()}", "cityId": request.cityId, "name": request.name or "Proposed Evaluation Site", "type": request.type, "coordinates": [request.longitude, request.latitude], "state": request.state or "Maharashtra", "district": CITIES[request.cityId]["name"], "capacityMw": request.capacityMw, "waterDemandKld": request.waterDemandKld, "powerDemandMw": request.powerDemandMw, "groundwaterZone": "Unavailable", "substationDistanceKm": round(min(distances), 1) if distances else None, "protectedAreaDistanceKm": None, "population5km": None, "suitabilityScore": None, "suitabilityStatus": "Insufficient data", "flags": ["Environmental layers are unavailable; suitability cannot be determined.", "Distance uses registered substations inside the illustrative city extent, which may be synthetic or incomplete."], "dataStatus": "unavailable"}


@app.post(f"{API_PREFIX}/forecasts")
def forecast(request: ForecastRequest) -> dict[str, Any]:
    start = date.today().replace(day=1)
    unit, baseline, step = {
        "electricity_demand": ("MW", 1000, 18),
        "groundwater_depletion": ("m bgl", 12, 0.08),
        "air_quality": ("µg/m³", 45, 0.3),
        "temperature_heat": ("°C", 30, 0.05),
        "environmental_risk_index": ("index", 50, 0.2),
    }[request.metric]
    points = []
    for month in range(request.horizon_months):
        absolute_month = start.year * 12 + start.month - 1 + month
        month_date = date(absolute_month // 12, absolute_month % 12 + 1, 1)
        prediction = round(baseline + month * step, 2)
        points.append({"date": month_date.isoformat(), "prediction": prediction, "lower_bound": round(prediction * 0.9, 2), "upper_bound": round(prediction * 1.1, 2)})
    return {"metric": request.metric, "locationId": request.location_id, "locationName": CITIES[request.location_id]["name"], "unit": unit, "model": "synthetic-demonstration", "modelVersion": "demo-v2", "horizonMonths": request.horizon_months, "dataStatus": "synthetic", "forecast": points, "methodologyNotes": "Synthetic demonstration, not trained on observations. Bounds are illustrative ranges, not calibrated confidence intervals. Not suitable for planning decisions."}


@app.post(f"{API_PREFIX}/mitigation-plans")
def mitigation_plan(request: MitigationRequest) -> dict[str, Any]:
    facility = get_facility_or_404(request.facility_id) if request.facility_id else None
    facility_type = request.facility_type or (facility.type if facility else "all")
    return {"facilityId": facility.id if facility else None, "facilityType": facility_type, "dataStatus": "synthetic", "recommendations": [{"id": "demo-water-01", "title": "Evaluate reclaimed-water supply", "category": "Water Conservation", "priority": "High", "implementationComplexity": "Moderate", "timeframe": "6 - 12 Months", "responsibleStakeholder": "Facility sustainability lead", "supportingEvidence": "Verify against CGWB/CPCB/state water permissions.", "expectedBenefit": "Quantification requires facility water balance.", "verificationRequirements": "Site water audit and source availability confirmation."}]}


class GeminiMitigationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    facility_id: str | None = Field(default=None, max_length=200)
    facility_type: InfrastructureType | Literal["all"] | None = None
    constraints: str | None = Field(default=None, max_length=4000)
    focus_area: str | None = Field(default=None, max_length=200)


@app.post(f"{API_PREFIX}/mitigation-plans/gemini")
async def gemini_mitigation_proxy(request: Request) -> dict[str, Any]:
    # Bound input and redact validation errors: legacy payloads can contain secrets.
    body = bytearray()
    async for chunk in request.stream():
        if len(body) + len(chunk) > 16384:
            raise HTTPException(status_code=413, detail="AI request is too large.")
        body.extend(chunk)
    try:
        GeminiMitigationRequest.model_validate_json(body)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid AI request. Provider credentials and unknown fields are not accepted.") from None
    # No activation switch until server-side access controls and usage limits exist.
    raise HTTPException(status_code=503, detail="AI-assisted mitigation is currently unavailable. Standard mitigation recommendations remain accessible.")


@app.get(f"{API_PREFIX}/reports/{{report_id}}")
def report(report_id: str) -> dict[str, Any]:
    facility = get_facility_or_404(report_id) if report_id else None
    return {"id": report_id, "generatedAt": utc_now(), "dataStatus": "synthetic", "facility": facility.model_dump() if facility else None, "disclaimer": "This report is a screening summary and not an official environmental clearance or compliance determination."}


def require_ingestion_key(x_ingestion_key: str | None = Header(default=None)) -> None:
    expected = os.getenv("ECOSITE_INGESTION_KEY", "")
    if not expected:
        raise HTTPException(status_code=503, detail="Facility ingestion is disabled until ECOSITE_INGESTION_KEY is configured")
    if not x_ingestion_key or not secrets.compare_digest(x_ingestion_key.encode(), expected.encode()):
        raise HTTPException(status_code=401, detail="Invalid ingestion credentials")


@app.post(f"{API_PREFIX}/ingestion/facilities", dependencies=[Depends(require_ingestion_key)])
def ingest_facilities(request: FacilityIngestRequest) -> dict[str, Any]:
    if len({record.id for record in request.records}) != len(request.records):
        raise HTTPException(status_code=422, detail="Duplicate facility IDs in ingestion batch")
    records = [record.model_copy(update={"provenance": record.provenance.model_copy(update={"sourceOrganization": request.sourceOrganization, "sourceUrl": request.sourceUrl or record.provenance.sourceUrl})}) for record in request.records]
    with closing(get_connection()) as connection, connection:
        for record in records:
            upsert_facility(record, connection)
    return {"accepted": len(records), "sourceOrganization": request.sourceOrganization, "ingestedAt": utc_now(), "message": "Records stored atomically with provenance."}
