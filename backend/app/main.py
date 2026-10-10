from __future__ import annotations

import json
import math
import os
import sqlite3
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Literal

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field


ROOT = Path(__file__).resolve().parents[1]
DB_PATH = Path(os.getenv("ECOSITE_DB_PATH", str(ROOT / "data" / "ecosite.db")))
API_PREFIX = os.getenv("ECOSITE_API_PREFIX", "/api/v1")
CORS_ORIGINS = [origin.strip() for origin in os.getenv("ECOSITE_CORS_ORIGINS", "http://localhost:5173").split(",") if origin.strip()]

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

    id: str
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


class FacilityIngestRecord(Facility):
    pass


class FacilityIngestRequest(BaseModel):
    sourceOrganization: str
    sourceUrl: str | None = None
    records: list[FacilityIngestRecord] = Field(min_length=1)


class SiteAssessmentRequest(BaseModel):
    name: str
    type: InfrastructureType
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    capacityMw: float = Field(ge=0)
    waterDemandKld: float | None = Field(default=None, ge=0)
    powerDemandMw: float | None = Field(default=None, ge=0)
    state: str | None = None


class ForecastRequest(BaseModel):
    location_id: str
    metric: str
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
    with sqlite3.connect(DB_PATH) as connection:
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
    with sqlite3.connect(DB_PATH) as connection:
        count = connection.execute("SELECT COUNT(*) FROM facilities").fetchone()[0]
        if count:
            return

        today = date.today().isoformat()
        seed = [
            Facility(
                id="seed-singrauli-thermal",
                name="Singrauli Super Thermal Station",
                type="thermal_power",
                state="Madhya Pradesh",
                district="Singrauli",
                coordinates=(82.6746, 24.2016),
                capacityMw=2000,
                operator="Demo seed record",
                yearCommissioned=2015,
                overallRiskScore=89,
                riskLevel="critical",
                indicators=Indicators(waterStress=74, gridPressure=45, airPollution=96, heatExposure=71, floodHazard=35, populationProximity=66, landSensitivity=68, biodiversityConstraint=62),
                keyRiskFactors=["High ambient air-pollution burden", "Thermal cooling water dependency", "Fly-ash and land sensitivity"],
                nearbyPopulation=NearbyPopulation(radius5km=42000, radius15km=188000, radius25km=620000),
                historicalTrends=[HistoricalTrend(year=y, riskScore=s, waterDemandKld=12000 + ((y - 2021) * 400)) for y, s in [(2021, 77), (2022, 81), (2023, 84), (2024, 87), (2025, 89)]],
                provenance=Provenance(sourceOrganization="EcoSite demonstration seed", sourceUrl="https://cea.nic.in", publicationDate=today, lastUpdated=today, geographicResolution="Facility point (unverified demo coordinate)", dataStatus="synthetic", confidenceScore=35),
            ),
            Facility(
                id="seed-navi-mumbai-dc",
                name="Navi Mumbai Hyperscale DC Cluster",
                type="data_centre",
                state="Maharashtra",
                district="Thane",
                coordinates=(73.0169, 19.1075),
                capacityMw=120,
                operator="Demo seed record",
                yearCommissioned=2022,
                overallRiskScore=78,
                riskLevel="high",
                indicators=Indicators(waterStress=82, gridPressure=88, airPollution=64, heatExposure=76, floodHazard=72, populationProximity=85, landSensitivity=42, biodiversityConstraint=35),
                keyRiskFactors=["Grid concentration in the 400kV corridor", "Cooling-water demand", "Coastal flood exposure"],
                nearbyPopulation=NearbyPopulation(radius5km=420000, radius15km=2150000, radius25km=7800000),
                historicalTrends=[HistoricalTrend(year=y, riskScore=s, waterDemandKld=600 + ((y - 2021) * 200), powerConsumptionMwh=280000 + ((y - 2021) * 165000)) for y, s in [(2021, 65), (2022, 70), (2023, 74), (2024, 76), (2025, 78)]],
                provenance=Provenance(sourceOrganization="EcoSite demonstration seed", sourceUrl="https://cea.nic.in", publicationDate=today, lastUpdated=today, geographicResolution="Industrial zone (unverified demo coordinate)", dataStatus="synthetic", confidenceScore=35),
            ),
            Facility(
                id="seed-bhadla-solar",
                name="Bhadla Solar Park Complex",
                type="solar_farm",
                state="Rajasthan",
                district="Jodhpur",
                coordinates=(71.914, 27.535),
                capacityMw=2245,
                operator="Demo seed record",
                yearCommissioned=2020,
                overallRiskScore=58,
                riskLevel="moderate",
                indicators=Indicators(waterStress=65, gridPressure=55, airPollution=18, heatExposure=89, floodHazard=12, populationProximity=18, landSensitivity=61, biodiversityConstraint=55),
                keyRiskFactors=["Extreme heat exposure", "Arid cleaning-water constraints", "Land and biodiversity sensitivity"],
                nearbyPopulation=NearbyPopulation(radius5km=900, radius15km=4200, radius25km=18000),
                historicalTrends=[HistoricalTrend(year=y, riskScore=s, waterDemandKld=250 + ((y - 2021) * 20)) for y, s in [(2021, 47), (2022, 51), (2023, 54), (2024, 56), (2025, 58)]],
                provenance=Provenance(sourceOrganization="EcoSite demonstration seed", sourceUrl="https://mnre.gov.in/en/re-statistics-2024-25/", publicationDate=today, lastUpdated=today, geographicResolution="Park point (unverified demo coordinate)", dataStatus="synthetic", confidenceScore=35),
            ),
        ]
        for facility in seed:
            upsert_facility(facility, connection)
        connection.commit()


def upsert_facility(facility: Facility, connection: sqlite3.Connection | None = None) -> None:
    owns_connection = connection is None
    connection = connection or sqlite3.connect(DB_PATH)
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
        connection.close()


def facility_from_row(row: sqlite3.Row) -> Facility:
    return Facility.model_validate(json.loads(row["payload"]))


def get_connection() -> sqlite3.Connection:
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def get_facility_or_404(facility_id: str) -> Facility:
    with get_connection() as connection:
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


def weighted_risk(indicators: Indicators) -> int:
    weights = {"waterStress": 0.22, "gridPressure": 0.20, "airPollution": 0.12, "heatExposure": 0.12, "floodHazard": 0.10, "populationProximity": 0.08, "landSensitivity": 0.08, "biodiversityConstraint": 0.08}
    return round(sum(getattr(indicators, key) * weight for key, weight in weights.items()))


app = FastAPI(title="EcoSite Terminal API", version="0.1.0", description="Environmental infrastructure intelligence API with provenance-aware demo data.")
app.add_middleware(CORSMiddleware, allow_origins=CORS_ORIGINS or ["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])


@app.on_event("startup")
def startup() -> None:
    ensure_database()
    seed_facilities()


@app.get("/health")
def health() -> dict[str, Any]:
    with get_connection() as connection:
        count = connection.execute("SELECT COUNT(*) FROM facilities").fetchone()[0]
    return {"status": "ok", "service": "ecosite-api", "facility_count": count, "timestamp": utc_now()}


@app.get(f"{API_PREFIX}/facilities", response_model=list[Facility])
def list_facilities(q: str | None = None, type: InfrastructureType | None = None, risk: RiskLevel | None = None, state: str | None = None, page: int = Query(1, ge=1), page_size: int = Query(100, ge=1, le=500)) -> list[Facility]:
    clauses: list[str] = []
    values: list[Any] = []
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
    with get_connection() as connection:
        rows = connection.execute(f"SELECT * FROM facilities {where} ORDER BY risk_score DESC LIMIT ? OFFSET ?", [*values, page_size, offset]).fetchall()
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
    score = weighted_risk(facility.indicators)
    return {"facilityId": facility.id, "overallScore": score, "riskLevel": risk_level(score), "isComplianceDetermination": False, "indicators": facility.indicators.model_dump(), "weights": {"waterStress": 0.22, "gridPressure": 0.20, "airPollution": 0.12, "heatExposure": 0.12, "floodHazard": 0.10, "populationProximity": 0.08, "landSensitivity": 0.08, "biodiversityConstraint": 0.08}, "provenance": facility.provenance.model_dump()}


@app.post(f"{API_PREFIX}/site-assessments")
def site_assessment(request: SiteAssessmentRequest) -> dict[str, Any]:
    with get_connection() as connection:
        rows = connection.execute("SELECT * FROM facilities").fetchall()
    nearest_km = 999.0
    for row in rows:
        facility = facility_from_row(row)
        distance = math.hypot((facility.coordinates[0] - request.longitude) * 111 * math.cos(math.radians(request.latitude)), (facility.coordinates[1] - request.latitude) * 111)
        nearest_km = min(nearest_km, distance)
    score = max(15, min(98, round(85 - (15 if nearest_km > 25 else 0) - (12 if request.type in ("thermal_power", "industrial") else 0))))
    return {"id": f"site-{int(datetime.now().timestamp())}", "name": request.name or "Proposed Evaluation Site", "type": request.type, "coordinates": [request.longitude, request.latitude], "state": request.state or "Identified Region", "district": "Pending official geocoding", "capacityMw": request.capacityMw, "waterDemandKld": request.waterDemandKld or (850 if request.type == "data_centre" else 250), "powerDemandMw": request.powerDemandMw or request.capacityMw, "groundwaterZone": "Unavailable", "substationDistanceKm": round(nearest_km, 1) if nearest_km < 999 else None, "protectedAreaDistanceKm": None, "population5km": None, "suitabilityScore": score, "suitabilityStatus": "Favorable with Mitigation" if score >= 55 else "High Risk / Unfavorable", "flags": ["Backend screening only; official environmental clearance is not determined.", "Environmental layers are unavailable until source datasets are ingested."], "dataStatus": "estimated"}


@app.post(f"{API_PREFIX}/forecasts")
def forecast(request: ForecastRequest) -> dict[str, Any]:
    start = date.today().replace(day=1)
    points = []
    for month in range(request.horizon_months):
        month_date = start + timedelta(days=30 * month)
        prediction = round(100 + month * 1.8, 2)
        points.append({"date": month_date.isoformat(), "prediction": prediction, "lower_bound": round(prediction * 0.9, 2), "upper_bound": round(prediction * 1.1, 2)})
    return {"metric": request.metric, "locationId": request.location_id, "locationName": request.location_id, "unit": "index", "model": "demo-baseline", "modelVersion": "demo-v1", "horizonMonths": request.horizon_months, "dataStatus": "synthetic", "forecast": points, "methodologyNotes": "Synthetic demonstration forecast. Replace with a validated model service before decision use."}


@app.post(f"{API_PREFIX}/mitigation-plans")
def mitigation_plan(request: MitigationRequest) -> dict[str, Any]:
    facility = get_facility_or_404(request.facility_id) if request.facility_id else None
    facility_type = request.facility_type or (facility.type if facility else "all")
    return {"facilityId": facility.id if facility else None, "facilityType": facility_type, "dataStatus": "synthetic", "recommendations": [{"id": "demo-water-01", "title": "Evaluate reclaimed-water supply", "category": "Water Conservation", "priority": "High", "implementationComplexity": "Moderate", "timeframe": "6 - 12 Months", "responsibleStakeholder": "Facility sustainability lead", "supportingEvidence": "Verify against CGWB/CPCB/state water permissions.", "expectedBenefit": "Quantification requires facility water balance.", "verificationRequirements": "Site water audit and source availability confirmation."}]}


@app.get(f"{API_PREFIX}/reports/{{report_id}}")
def report(report_id: str) -> dict[str, Any]:
    facility = get_facility_or_404(report_id) if report_id else None
    return {"id": report_id, "generatedAt": utc_now(), "dataStatus": "synthetic", "facility": facility.model_dump() if facility else None, "disclaimer": "This report is a screening summary and not an official environmental clearance or compliance determination."}


@app.post(f"{API_PREFIX}/ingestion/facilities")
def ingest_facilities(request: FacilityIngestRequest) -> dict[str, Any]:
    for record in request.records:
        updated = record.model_copy(update={"provenance": record.provenance.model_copy(update={"sourceOrganization": request.sourceOrganization, "sourceUrl": request.sourceUrl or record.provenance.sourceUrl})})
        upsert_facility(updated)
    return {"accepted": len(request.records), "sourceOrganization": request.sourceOrganization, "ingestedAt": utc_now(), "message": "Records stored with provenance. Validate coordinates and licensing before production use."}

