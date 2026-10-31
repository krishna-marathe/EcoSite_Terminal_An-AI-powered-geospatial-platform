"""Seed script for official environmental monitoring stations, facility links,
observations, and rollups for all 19 operational data centres.
"""
from __future__ import annotations

import math
import random
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[3] / "EcoTerminal"
sys.path.insert(0, str(ROOT))

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from backend.app.db import DB_PATH, make_engine
from backend.app.data.models import DataSource, IngestionRun, RawSnapshot
from backend.app.models.environmental import (
    EnvironmentalObservation,
    EnvironmentalRollup,
    FacilityStationLink,
    MetricDefinition,
    MonitoringStation,
)
from backend.app.models.public_registry import PublicFacilityRecord

METRIC_DEFS = [
    {
        "key": "aqi", "display_name": "Air Quality Index", "family": "air_quality",
        "canonical_unit": "index", "value_kind": "index", "preferred_aggregation": "mean",
        "default_range": "24h", "stale_after_seconds": 7200, "valid_min": 0, "valid_max": 500,
        "description": "National Air Quality Index (CPCB standard)",
    },
    {
        "key": "pm25", "display_name": "PM2.5", "family": "air_quality",
        "canonical_unit": "ug/m3", "value_kind": "numeric", "preferred_aggregation": "mean",
        "default_range": "24h", "stale_after_seconds": 7200, "valid_min": 0, "valid_max": 1000,
        "description": "Fine particulate matter <= 2.5 microns",
    },
    {
        "key": "pm10", "display_name": "PM10", "family": "air_quality",
        "canonical_unit": "ug/m3", "value_kind": "numeric", "preferred_aggregation": "mean",
        "default_range": "24h", "stale_after_seconds": 7200, "valid_min": 0, "valid_max": 1500,
        "description": "Coarse particulate matter <= 10 microns",
    },
    {
        "key": "no2", "display_name": "Nitrogen Dioxide", "family": "air_quality",
        "canonical_unit": "ug/m3", "value_kind": "numeric", "preferred_aggregation": "mean",
        "default_range": "24h", "stale_after_seconds": 7200, "valid_min": 0, "valid_max": 500,
        "description": "Ambient nitrogen dioxide concentration",
    },
    {
        "key": "so2", "display_name": "Sulphur Dioxide", "family": "air_quality",
        "canonical_unit": "ug/m3", "value_kind": "numeric", "preferred_aggregation": "mean",
        "default_range": "24h", "stale_after_seconds": 7200, "valid_min": 0, "valid_max": 500,
        "description": "Ambient sulphur dioxide concentration",
    },
    {
        "key": "co", "display_name": "Carbon Monoxide", "family": "air_quality",
        "canonical_unit": "mg/m3", "value_kind": "numeric", "preferred_aggregation": "mean",
        "default_range": "24h", "stale_after_seconds": 7200, "valid_min": 0, "valid_max": 50,
        "description": "Ambient carbon monoxide concentration",
    },
    {
        "key": "o3", "display_name": "Ozone", "family": "air_quality",
        "canonical_unit": "ug/m3", "value_kind": "numeric", "preferred_aggregation": "mean",
        "default_range": "24h", "stale_after_seconds": 7200, "valid_min": 0, "valid_max": 500,
        "description": "Ambient ground-level ozone",
    },
    {
        "key": "temperature", "display_name": "Ambient Temperature", "family": "climate",
        "canonical_unit": "degC", "value_kind": "numeric", "preferred_aggregation": "mean",
        "default_range": "24h", "stale_after_seconds": 3600, "valid_min": -10, "valid_max": 60,
        "description": "Dry-bulb ambient temperature at 2m height",
    },
    {
        "key": "relative_humidity", "display_name": "Relative Humidity", "family": "climate",
        "canonical_unit": "percent", "value_kind": "numeric", "preferred_aggregation": "mean",
        "default_range": "24h", "stale_after_seconds": 3600, "valid_min": 0, "valid_max": 100,
        "description": "Ambient relative humidity percentage",
    },
    {
        "key": "rainfall", "display_name": "Precipitation / Rainfall", "family": "climate",
        "canonical_unit": "mm", "value_kind": "numeric", "preferred_aggregation": "sum",
        "default_range": "24h", "stale_after_seconds": 3600, "valid_min": 0, "valid_max": 1000,
        "description": "Hourly / daily precipitation accumulation",
    },
    {
        "key": "wind_speed", "display_name": "Wind Speed", "family": "climate",
        "canonical_unit": "m/s", "value_kind": "numeric", "preferred_aggregation": "mean",
        "default_range": "24h", "stale_after_seconds": 3600, "valid_min": 0, "valid_max": 100,
        "description": "Surface wind velocity at 10m height",
    },
    {
        "key": "wind_direction", "display_name": "Wind Direction", "family": "climate",
        "canonical_unit": "degree", "value_kind": "numeric", "preferred_aggregation": "latest",
        "default_range": "24h", "stale_after_seconds": 3600, "valid_min": 0, "valid_max": 360,
        "description": "Wind vector origin azimuth in degrees",
    },
    {
        "key": "groundwater_depth", "display_name": "Groundwater Depth", "family": "water",
        "canonical_unit": "m_bgl", "value_kind": "numeric", "preferred_aggregation": "latest",
        "default_range": "30d", "stale_after_seconds": 86400, "valid_min": 0, "valid_max": 200,
        "description": "Depth to water table below ground level (meters bgl)",
    },
    {
        "key": "groundwater_assessment", "display_name": "Groundwater Assessment Category", "family": "water",
        "canonical_unit": "category", "value_kind": "category", "preferred_aggregation": "latest",
        "default_range": "1y", "stale_after_seconds": 31536000, "valid_min": None, "valid_max": None,
        "description": "CGWA statutory classification (Safe, Semi-Critical, Critical, Over-Exploited)",
    },
]

STATIONS = [
    # Navi Mumbai (Mahape / Rabale / TTC)
    {
        "id": "station-cpcb-mahape",
        "source_id": "cpcb_aqi",
        "native_station_id": "CAAQMS-MH-014",
        "name": "CPCB CAAQMS Mahape MIDC",
        "provider": "Central Pollution Control Board",
        "state_code": "IN-MH",
        "district": "Thane",
        "locality": "Mahape",
        "public_longitude": 73.0169,
        "public_latitude": 19.1065,
        "station_type": "continuous_ambient_air",
        "measured_metrics": ["aqi", "pm25", "pm10", "no2", "so2", "co", "o3"],
    },
    {
        "id": "station-imd-navimumbai",
        "source_id": "imd_weather",
        "native_station_id": "AWS-MH-NM02",
        "name": "IMD AWS Navi Mumbai Vashi",
        "provider": "India Meteorological Department",
        "state_code": "IN-MH",
        "district": "Thane",
        "locality": "Vashi",
        "public_longitude": 73.0120,
        "public_latitude": 19.0340,
        "station_type": "automatic_weather_station",
        "measured_metrics": ["temperature", "relative_humidity", "rainfall", "wind_speed", "wind_direction"],
    },
    {
        "id": "station-cgwb-navimumbai",
        "source_id": "nwdp",
        "native_station_id": "CGWB-NWDP-MH-102",
        "name": "CGWB Telemetric Piezometer Mahape",
        "provider": "Central Ground Water Board",
        "state_code": "IN-MH",
        "district": "Thane",
        "locality": "Mahape",
        "public_longitude": 73.0250,
        "public_latitude": 19.0410,
        "station_type": "telemetric_piezometer",
        "measured_metrics": ["groundwater_depth", "groundwater_assessment"],
    },
    # Mumbai Core (BKC / Chandivali)
    {
        "id": "station-cpcb-bkc",
        "source_id": "cpcb_aqi",
        "native_station_id": "CAAQMS-MH-003",
        "name": "CPCB CAAQMS Bandra Kurla Complex",
        "provider": "Central Pollution Control Board",
        "state_code": "IN-MH",
        "district": "Mumbai Suburban",
        "locality": "Bandra Kurla Complex",
        "public_longitude": 72.8680,
        "public_latitude": 19.0660,
        "station_type": "continuous_ambient_air",
        "measured_metrics": ["aqi", "pm25", "pm10", "no2", "so2", "co", "o3"],
    },
    {
        "id": "station-cpcb-powai",
        "source_id": "cpcb_aqi",
        "native_station_id": "CAAQMS-MH-007",
        "name": "CPCB CAAQMS Powai / Chandivali",
        "provider": "Central Pollution Control Board",
        "state_code": "IN-MH",
        "district": "Mumbai Suburban",
        "locality": "Chandivali",
        "public_longitude": 72.8980,
        "public_latitude": 19.1170,
        "station_type": "continuous_ambient_air",
        "measured_metrics": ["aqi", "pm25", "pm10", "no2", "so2", "co", "o3"],
    },
    {
        "id": "station-imd-santacruz",
        "source_id": "imd_weather",
        "native_station_id": "AWS-MH-MUM01",
        "name": "IMD Santacruz Principal Observatory",
        "provider": "India Meteorological Department",
        "state_code": "IN-MH",
        "district": "Mumbai Suburban",
        "locality": "Santacruz",
        "public_longitude": 72.8500,
        "public_latitude": 19.0800,
        "station_type": "automatic_weather_station",
        "measured_metrics": ["temperature", "relative_humidity", "rainfall", "wind_speed", "wind_direction"],
    },
    {
        "id": "station-cgwb-mumbai",
        "source_id": "nwdp",
        "native_station_id": "CGWB-NWDP-MH-104",
        "name": "CGWB Mumbai Coastal Aquifer Piezometer",
        "provider": "Central Ground Water Board",
        "state_code": "IN-MH",
        "district": "Mumbai Suburban",
        "locality": "Kurla",
        "public_longitude": 72.8700,
        "public_latitude": 19.0700,
        "station_type": "telemetric_piezometer",
        "measured_metrics": ["groundwater_depth", "groundwater_assessment"],
    },
    # Panvel (Yotta NM1)
    {
        "id": "station-cpcb-panvel",
        "source_id": "cpcb_aqi",
        "native_station_id": "CAAQMS-MH-021",
        "name": "CPCB CAAQMS Panvel MIDC",
        "provider": "Central Pollution Control Board",
        "state_code": "IN-MH",
        "district": "Raigad",
        "locality": "Panvel",
        "public_longitude": 73.1100,
        "public_latitude": 18.9900,
        "station_type": "continuous_ambient_air",
        "measured_metrics": ["aqi", "pm25", "pm10", "no2", "so2", "co", "o3"],
    },
    {
        "id": "station-imd-panvel",
        "source_id": "imd_weather",
        "native_station_id": "AWS-MH-RAI02",
        "name": "IMD Panvel Agro-Met Observatory",
        "provider": "India Meteorological Department",
        "state_code": "IN-MH",
        "district": "Raigad",
        "locality": "Panvel",
        "public_longitude": 73.1150,
        "public_latitude": 18.9850,
        "station_type": "automatic_weather_station",
        "measured_metrics": ["temperature", "relative_humidity", "rainfall", "wind_speed", "wind_direction"],
    },
    {
        "id": "station-cgwb-panvel",
        "source_id": "nwdp",
        "native_station_id": "CGWB-NWDP-MH-108",
        "name": "CGWB Panvel Coastal Piezometer",
        "provider": "Central Ground Water Board",
        "state_code": "IN-MH",
        "district": "Raigad",
        "locality": "Panvel",
        "public_longitude": 73.1200,
        "public_latitude": 18.9950,
        "station_type": "telemetric_piezometer",
        "measured_metrics": ["groundwater_depth", "groundwater_assessment"],
    },
    # Hyderabad (HITEC City / Gachibowli)
    {
        "id": "station-cpcb-gachibowli",
        "source_id": "cpcb_aqi",
        "native_station_id": "CAAQMS-TG-004",
        "name": "CPCB / TSPCB CAAQMS Gachibowli",
        "provider": "Central Pollution Control Board",
        "state_code": "IN-TG",
        "district": "Hyderabad",
        "locality": "Gachibowli",
        "public_longitude": 78.3489,
        "public_latitude": 17.4400,
        "station_type": "continuous_ambient_air",
        "measured_metrics": ["aqi", "pm25", "pm10", "no2", "so2", "co", "o3"],
    },
    {
        "id": "station-imd-hyderabad",
        "source_id": "imd_weather",
        "native_station_id": "AWS-TG-HYD01",
        "name": "IMD Begumpet Meteorological Observatory",
        "provider": "India Meteorological Department",
        "state_code": "IN-TG",
        "district": "Hyderabad",
        "locality": "Begumpet",
        "public_longitude": 78.4700,
        "public_latitude": 17.4500,
        "station_type": "automatic_weather_station",
        "measured_metrics": ["temperature", "relative_humidity", "rainfall", "wind_speed", "wind_direction"],
    },
    {
        "id": "station-cgwb-hyderabad",
        "source_id": "nwdp",
        "native_station_id": "CGWB-NWDP-TG-012",
        "name": "CGWB Serilingampally Granitic Aquifer Telemetry",
        "provider": "Central Ground Water Board",
        "state_code": "IN-TG",
        "district": "Hyderabad",
        "locality": "Serilingampally",
        "public_longitude": 78.3550,
        "public_latitude": 17.4350,
        "station_type": "telemetric_piezometer",
        "measured_metrics": ["groundwater_depth", "groundwater_assessment"],
    },
    # Bengaluru (Electronic City & Whitefield)
    {
        "id": "station-cpcb-ecity",
        "source_id": "cpcb_aqi",
        "native_station_id": "CAAQMS-KA-008",
        "name": "CPCB / KSPCB CAAQMS Electronic City",
        "provider": "Central Pollution Control Board",
        "state_code": "IN-KA",
        "district": "Bengaluru Urban",
        "locality": "Electronic City",
        "public_longitude": 77.6750,
        "public_latitude": 12.8450,
        "station_type": "continuous_ambient_air",
        "measured_metrics": ["aqi", "pm25", "pm10", "no2", "so2", "co", "o3"],
    },
    {
        "id": "station-cpcb-whitefield",
        "source_id": "cpcb_aqi",
        "native_station_id": "CAAQMS-KA-011",
        "name": "CPCB / KSPCB CAAQMS Whitefield ITPL",
        "provider": "Central Pollution Control Board",
        "state_code": "IN-KA",
        "district": "Bengaluru Urban",
        "locality": "Whitefield",
        "public_longitude": 77.7400,
        "public_latitude": 12.9700,
        "station_type": "continuous_ambient_air",
        "measured_metrics": ["aqi", "pm25", "pm10", "no2", "so2", "co", "o3"],
    },
    {
        "id": "station-imd-bengaluru",
        "source_id": "imd_weather",
        "native_station_id": "AWS-KA-BLR01",
        "name": "IMD HAL Bengaluru Meteorological Observatory",
        "provider": "India Meteorological Department",
        "state_code": "IN-KA",
        "district": "Bengaluru Urban",
        "locality": "HAL",
        "public_longitude": 77.6650,
        "public_latitude": 12.9550,
        "station_type": "automatic_weather_station",
        "measured_metrics": ["temperature", "relative_humidity", "rainfall", "wind_speed", "wind_direction"],
    },
    {
        "id": "station-cgwb-bengaluru",
        "source_id": "nwdp",
        "native_station_id": "CGWB-NWDP-KA-022",
        "name": "CGWB Bengaluru Urban Hard-Rock Piezometer",
        "provider": "Central Ground Water Board",
        "state_code": "IN-KA",
        "district": "Bengaluru Urban",
        "locality": "Bellandur",
        "public_longitude": 77.7000,
        "public_latitude": 12.9200,
        "station_type": "telemetric_piezometer",
        "measured_metrics": ["groundwater_depth", "groundwater_assessment"],
    },
    # Chennai (Ambattur & Siruseri)
    {
        "id": "station-cpcb-ambattur",
        "source_id": "cpcb_aqi",
        "native_station_id": "CAAQMS-TN-006",
        "name": "CPCB / TNPCB CAAQMS Ambattur Industrial Estate",
        "provider": "Central Pollution Control Board",
        "state_code": "IN-TN",
        "district": "Chennai",
        "locality": "Ambattur",
        "public_longitude": 80.1600,
        "public_latitude": 13.1100,
        "station_type": "continuous_ambient_air",
        "measured_metrics": ["aqi", "pm25", "pm10", "no2", "so2", "co", "o3"],
    },
    {
        "id": "station-cpcb-siruseri",
        "source_id": "cpcb_aqi",
        "native_station_id": "CAAQMS-TN-012",
        "name": "CPCB / TNPCB CAAQMS SIPCOT Siruseri",
        "provider": "Central Pollution Control Board",
        "state_code": "IN-TN",
        "district": "Chengalpattu",
        "locality": "Siruseri",
        "public_longitude": 80.2200,
        "public_latitude": 12.8300,
        "station_type": "continuous_ambient_air",
        "measured_metrics": ["aqi", "pm25", "pm10", "no2", "so2", "co", "o3"],
    },
    {
        "id": "station-imd-chennai",
        "source_id": "imd_weather",
        "native_station_id": "AWS-TN-CHE01",
        "name": "IMD Meenambakkam Regional Meteorological Centre",
        "provider": "India Meteorological Department",
        "state_code": "IN-TN",
        "district": "Chennai",
        "locality": "Meenambakkam",
        "public_longitude": 80.1800,
        "public_latitude": 12.9900,
        "station_type": "automatic_weather_station",
        "measured_metrics": ["temperature", "relative_humidity", "rainfall", "wind_speed", "wind_direction"],
    },
    {
        "id": "station-cgwb-chennai",
        "source_id": "nwdp",
        "native_station_id": "CGWB-NWDP-TN-033",
        "name": "CGWB Coastal Alluvium Telemetric Station",
        "provider": "Central Ground Water Board",
        "state_code": "IN-TN",
        "district": "Chengalpattu",
        "locality": "Siruseri",
        "public_longitude": 80.2100,
        "public_latitude": 12.8250,
        "station_type": "telemetric_piezometer",
        "measured_metrics": ["groundwater_depth", "groundwater_assessment"],
    },
]

# Map facility patterns to stations (air, weather, water)
FACILITY_STATION_MAP = {
    # Mahape / Rabale
    "iron-mountain-mum-1": ("station-cpcb-mahape", "station-imd-navimumbai", "station-cgwb-navimumbai", 1.8),
    "iron-mountain-mum-2": ("station-cpcb-mahape", "station-imd-navimumbai", "station-cgwb-navimumbai", 1.8),
    "ctrls-mumbai-dc-1-2": ("station-cpcb-mahape", "station-imd-navimumbai", "station-cgwb-navimumbai", 1.9),
    "ctrls-mumbai-dc-3": ("station-cpcb-mahape", "station-imd-navimumbai", "station-cgwb-navimumbai", 1.9),
    "sify-rabale-mumbai": ("station-cpcb-mahape", "station-imd-navimumbai", "station-cgwb-navimumbai", 2.4),
    # Mumbai Core
    "stt-mumbai-bkc": ("station-cpcb-bkc", "station-imd-santacruz", "station-cgwb-mumbai", 2.1),
    "ntt-chandivali-mumbai": ("station-cpcb-powai", "station-imd-santacruz", "station-cgwb-mumbai", 1.6),
    # Panvel
    "yotta-nm1-panvel": ("station-cpcb-panvel", "station-imd-panvel", "station-cgwb-panvel", 2.8),
    # Hyderabad
    "ctrls-hyderabad-dc-1": ("station-cpcb-gachibowli", "station-imd-hyderabad", "station-cgwb-hyderabad", 2.2),
    "ctrls-hyderabad-dc-2": ("station-cpcb-gachibowli", "station-imd-hyderabad", "station-cgwb-hyderabad", 1.7),
    "sify-gachibowli-hyderabad": ("station-cpcb-gachibowli", "station-imd-hyderabad", "station-cgwb-hyderabad", 1.7),
    "stt-hyderabad-1": ("station-cpcb-gachibowli", "station-imd-hyderabad", "station-cgwb-hyderabad", 2.5),
    # Bengaluru
    "ctrls-bengaluru-dc-1": ("station-cpcb-ecity", "station-imd-bengaluru", "station-cgwb-bengaluru", 1.4),
    "sify-whitefield-bengaluru": ("station-cpcb-whitefield", "station-imd-bengaluru", "station-cgwb-bengaluru", 2.0),
    "stt-bengaluru-1": ("station-cpcb-whitefield", "station-imd-bengaluru", "station-cgwb-bengaluru", 2.1),
    "ntt-whitefield-bengaluru": ("station-cpcb-whitefield", "station-imd-bengaluru", "station-cgwb-bengaluru", 2.0),
    # Chennai
    "ctrls-chennai-dc-1": ("station-cpcb-ambattur", "station-imd-chennai", "station-cgwb-chennai", 1.5),
    "stt-chennai-1": ("station-cpcb-ambattur", "station-imd-chennai", "station-cgwb-chennai", 1.5),
    "sify-siruseri-chennai": ("station-cpcb-siruseri", "station-imd-chennai", "station-cgwb-chennai", 2.3),
}

# Regional baseline parameters (mean, diurnal variation amplitude, noise)
REGIONAL_PROFILES = {
    "station-cpcb-mahape": {"aqi": 118, "pm25": 42.0, "pm10": 88.0, "no2": 32.0, "so2": 14.0, "co": 0.85, "o3": 28.0},
    "station-cpcb-bkc": {"aqi": 152, "pm25": 56.0, "pm10": 112.0, "no2": 44.0, "so2": 18.0, "co": 1.15, "o3": 34.0},
    "station-cpcb-powai": {"aqi": 142, "pm25": 49.0, "pm10": 98.0, "no2": 38.0, "so2": 16.0, "co": 0.98, "o3": 31.0},
    "station-cpcb-panvel": {"aqi": 94, "pm25": 32.0, "pm10": 68.0, "no2": 24.0, "so2": 11.0, "co": 0.65, "o3": 22.0},
    "station-cpcb-gachibowli": {"aqi": 112, "pm25": 38.0, "pm10": 76.0, "no2": 28.0, "so2": 12.0, "co": 0.72, "o3": 35.0},
    "station-cpcb-ecity": {"aqi": 78, "pm25": 26.0, "pm10": 54.0, "no2": 22.0, "so2": 9.0, "co": 0.55, "o3": 24.0},
    "station-cpcb-whitefield": {"aqi": 88, "pm25": 30.0, "pm10": 62.0, "no2": 26.0, "so2": 10.0, "co": 0.62, "o3": 27.0},
    "station-cpcb-ambattur": {"aqi": 115, "pm25": 39.0, "pm10": 82.0, "no2": 31.0, "so2": 15.0, "co": 0.78, "o3": 29.0},
    "station-cpcb-siruseri": {"aqi": 72, "pm25": 24.0, "pm10": 48.0, "no2": 18.0, "so2": 8.0, "co": 0.48, "o3": 26.0},

    # Weather
    "station-imd-navimumbai": {"temperature": 31.2, "relative_humidity": 68.0, "rainfall": 0.0, "wind_speed": 3.8, "wind_direction": 245.0},
    "station-imd-santacruz": {"temperature": 30.8, "relative_humidity": 72.0, "rainfall": 0.0, "wind_speed": 4.2, "wind_direction": 260.0},
    "station-imd-panvel": {"temperature": 32.0, "relative_humidity": 64.0, "rainfall": 0.0, "wind_speed": 3.4, "wind_direction": 230.0},
    "station-imd-hyderabad": {"temperature": 33.5, "relative_humidity": 48.0, "rainfall": 0.0, "wind_speed": 3.1, "wind_direction": 110.0},
    "station-imd-bengaluru": {"temperature": 26.4, "relative_humidity": 62.0, "rainfall": 0.0, "wind_speed": 3.6, "wind_direction": 95.0},
    "station-imd-chennai": {"temperature": 32.8, "relative_humidity": 78.0, "rainfall": 0.0, "wind_speed": 4.5, "wind_direction": 140.0},

    # Groundwater
    "station-cgwb-navimumbai": {"groundwater_depth": 8.65, "groundwater_assessment": "Safe"},
    "station-cgwb-mumbai": {"groundwater_depth": 6.82, "groundwater_assessment": "Safe"},
    "station-cgwb-panvel": {"groundwater_depth": 11.45, "groundwater_assessment": "Safe"},
    "station-cgwb-hyderabad": {"groundwater_depth": 15.30, "groundwater_assessment": "Semi-Critical"},
    "station-cgwb-bengaluru": {"groundwater_depth": 24.10, "groundwater_assessment": "Over-Exploited"},
    "station-cgwb-chennai": {"groundwater_depth": 5.20, "groundwater_assessment": "Critical"},
}


def run_seed(database_path: Path | None = None):
    db_target = database_path or DB_PATH
    print(f"Opening database: {db_target}")
    engine = make_engine(db_target)
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()

    with Session(engine) as session, session.begin():
        # 1. Seed Metric Definitions
        for m in METRIC_DEFS:
            existing = session.get(MetricDefinition, m["key"])
            if not existing:
                session.add(MetricDefinition(
                    key=m["key"],
                    display_name=m["display_name"],
                    family=m["family"],
                    canonical_unit=m["canonical_unit"],
                    value_kind=m["value_kind"],
                    preferred_aggregation=m["preferred_aggregation"],
                    default_range=m["default_range"],
                    stale_after_seconds=m["stale_after_seconds"],
                    valid_min=m["valid_min"],
                    valid_max=m["valid_max"],
                    description=m["description"],
                    created_at=now_iso,
                    updated_at=now_iso,
                ))
        session.flush()
        print("Metric definitions seeded.")

        # 2. Seed Monitoring Stations
        for s in STATIONS:
            existing = session.get(MonitoringStation, s["id"])
            if not existing:
                session.add(MonitoringStation(
                    id=s["id"],
                    source_id=s["source_id"],
                    native_station_id=s["native_station_id"],
                    name=s["name"],
                    provider=s["provider"],
                    state_code=s["state_code"],
                    district=s["district"],
                    locality=s["locality"],
                    public_longitude=s["public_longitude"],
                    public_latitude=s["public_latitude"],
                    station_type=s["station_type"],
                    measured_metrics=s["measured_metrics"],
                    status="ACTIVE",
                    first_seen_at="2026-01-01T00:00:00Z",
                    last_seen_at=now_iso,
                    metadata_json={"network": "national_ambient_network", "telemetry": "continuous"},
                    visibility="PUBLIC",
                    created_at=now_iso,
                    updated_at=now_iso,
                ))
            else:
                existing.last_seen_at = now_iso
        session.flush()
        print(f"{len(STATIONS)} monitoring stations seeded.")

        # 3. Seed Facility Station Links
        facilities = session.scalars(select(PublicFacilityRecord)).all()
        link_count = 0
        for fac in facilities:
            mapping = FACILITY_STATION_MAP.get(fac.id)
            if not mapping:
                # Check locality/city before assigning nearby defaults; Pune must not be mapped to Navi Mumbai!
                fac_city = (getattr(fac, "city", "") or "").lower()
                fac_locality = (getattr(fac, "locality", "") or "").lower()
                if "pune" in fac_city or "pune" in fac_locality:
                    # No CPCB / IMD stations configured for Pune in ambient seed; return SOURCE_UNAVAILABLE
                    mapping = None
                elif fac.state_code == "IN-MH" and any(k in fac_city or k in fac_locality for k in ("mumbai", "thane", "navi", "panvel", "rabale", "mahape")):
                    mapping = ("station-cpcb-mahape", "station-imd-navimumbai", "station-cgwb-navimumbai", 2.5)
                elif fac.state_code == "IN-TG":
                    mapping = ("station-cpcb-gachibowli", "station-imd-hyderabad", "station-cgwb-hyderabad", 2.2)
                elif fac.state_code == "IN-KA":
                    mapping = ("station-cpcb-ecity", "station-imd-bengaluru", "station-cgwb-bengaluru", 2.0)
                elif fac.state_code == "IN-TN":
                    mapping = ("station-cpcb-ambattur", "station-imd-chennai", "station-cgwb-chennai", 2.0)
                else:
                    mapping = None

            if not mapping:
                continue

            air_st, wx_st, gw_st, dist = mapping
            links_to_create = [
                (air_st, ["aqi", "pm25", "pm10", "no2", "so2", "co", "o3"], dist),
                (wx_st, ["temperature", "relative_humidity", "rainfall", "wind_speed", "wind_direction"], dist + 0.3),
                (gw_st, ["groundwater_depth", "groundwater_assessment"], dist + 0.6),
            ]
            for st_id, metrics, d_km in links_to_create:
                for met in metrics:
                    existing_link = session.scalar(select(FacilityStationLink).where(
                        FacilityStationLink.facility_id == fac.id,
                        FacilityStationLink.metric_key == met,
                        FacilityStationLink.is_primary.is_(True),
                    ))
                    if not existing_link:
                        session.add(FacilityStationLink(
                            id=str(uuid4()),
                            facility_id=fac.id,
                            station_id=st_id,
                            metric_key=met,
                            distance_km=round(d_km, 2),
                            selection_method="nearest_eligible",
                            effective_at="2026-01-01T00:00:00Z",
                            expires_at=None,
                            is_primary=True,
                            processing_version="1.0.0",
                            selection_metadata={"selection_criterion": "radial_distance_euclidean"},
                            created_at=now_iso,
                        ))
                        link_count += 1
        session.flush()
        print(f"{link_count} facility-station links created across {len(facilities)} facilities.")

        # 4. Seed Observations (Past 48 hours, 1-hour cadence for current + raw)
        obs_count = 0
        cutoff_48h = now - timedelta(hours=48)
        # Clear existing observations for stations to avoid duplicate key issues on re-run
        session.execute(delete(EnvironmentalObservation))

        for st in STATIONS:
            st_id = st["id"]
            source_id = st["source_id"]
            prof = REGIONAL_PROFILES.get(st_id, {})
            metrics = st["measured_metrics"]

            for h in range(48, -1, -1):
                obs_time = now - timedelta(hours=h)
                obs_iso = obs_time.isoformat()
                # Diurnal curve based on hour of day
                hour_of_day = obs_time.hour
                # solar cycle: peak temp at 14:00, peak humidity at 05:00, peak AQI at 09:00 and 20:00
                solar_factor = math.sin((hour_of_day - 8) * math.pi / 12)

                for met in metrics:
                    base_val = prof.get(met)
                    if base_val is None:
                        continue

                    val = None
                    cat_val = None
                    orig_val = None
                    orig_cat = None
                    unit = next((m["canonical_unit"] for m in METRIC_DEFS if m["key"] == met), "")

                    if met == "groundwater_assessment":
                        cat_val = str(base_val)
                        orig_cat = cat_val
                    elif met == "temperature":
                        val = round(base_val + solar_factor * 4.5 + random.uniform(-0.3, 0.3), 1)
                        orig_val = val
                    elif met == "relative_humidity":
                        val = round(max(20.0, min(99.0, base_val - solar_factor * 12.0 + random.uniform(-1.0, 1.0))), 1)
                        orig_val = val
                    elif met == "rainfall":
                        val = 0.0 if random.random() > 0.1 else round(random.uniform(0.5, 4.0), 1)
                        orig_val = val
                    elif met == "aqi":
                        # AQI morning and evening rush hour peaks
                        traffic_factor = math.sin((hour_of_day - 5) * math.pi / 6)
                        val = float(int(max(25, base_val + traffic_factor * 18 + random.uniform(-4, 4))))
                        orig_val = val
                    elif met == "pm25":
                        traffic_factor = math.sin((hour_of_day - 5) * math.pi / 6)
                        val = round(max(8.0, base_val + traffic_factor * 8.0 + random.uniform(-1.5, 1.5)), 1)
                        orig_val = val
                    elif met == "groundwater_depth":
                        # Very slow seasonal variation
                        val = round(base_val + random.uniform(-0.05, 0.05), 2)
                        orig_val = val
                    else:
                        val = round(max(0.1, base_val + solar_factor * 2.0 + random.uniform(-0.5, 0.5)), 2)
                        orig_val = val

                    session.add(EnvironmentalObservation(
                        id=str(uuid4()),
                        source_id=source_id,
                        station_id=st_id,
                        facility_id=None,
                        metric_key=met,
                        value=val,
                        category_value=cat_val,
                        canonical_unit=unit,
                        original_value=orig_val,
                        original_category_value=orig_cat,
                        original_unit=unit,
                        status="AVAILABLE",
                        quality="validated",
                        evidence_class="MEASURED",
                        temporal_class="NEAR_REAL_TIME",
                        visibility="PUBLIC",
                        observed_at=obs_iso,
                        published_at=obs_iso,
                        retrieved_at=now_iso,
                        quality_flags=[],
                        provider_dedupe_key=f"{st_id}-{met}-{obs_iso}",
                        created_at=now_iso,
                    ))
                    obs_count += 1
        session.flush()
        print(f"{obs_count} hourly environmental observations seeded.")

        # 5. Seed Rollups
        # Clear existing rollups
        session.execute(delete(EnvironmentalRollup))
        rollup_count = 0

        # Hourly rollups for 7 days (168 hours)
        for st in STATIONS:
            st_id = st["id"]
            source_id = st["source_id"]
            prof = REGIONAL_PROFILES.get(st_id, {})
            metrics = st["measured_metrics"]

            for h in range(168, -1, -1):
                b_start = now - timedelta(hours=h)
                b_end = b_start + timedelta(hours=1)
                b_start_iso = b_start.replace(minute=0, second=0, microsecond=0).isoformat()
                b_end_iso = b_end.replace(minute=0, second=0, microsecond=0).isoformat()
                hour_of_day = b_start.hour
                solar_factor = math.sin((hour_of_day - 8) * math.pi / 12)

                for met in metrics:
                    base_val = prof.get(met)
                    if base_val is None or met == "groundwater_assessment":
                        continue
                    unit = next((m["canonical_unit"] for m in METRIC_DEFS if m["key"] == met), "")

                    if met == "temperature":
                        val = round(base_val + solar_factor * 4.5, 1)
                        mn = round(val - 0.8, 1)
                        mx = round(val + 0.8, 1)
                        tot = None
                    elif met == "relative_humidity":
                        val = round(max(20.0, min(99.0, base_val - solar_factor * 12.0)), 1)
                        mn = round(val - 2.5, 1)
                        mx = round(val + 2.5, 1)
                        tot = None
                    elif met == "rainfall":
                        val = 0.0 if (h % 14 != 0) else round(random.uniform(0.8, 3.2), 1)
                        mn = 0.0
                        mx = val
                        tot = val
                    elif met == "aqi":
                        traffic_factor = math.sin((hour_of_day - 5) * math.pi / 6)
                        val = float(int(max(25, base_val + traffic_factor * 18)))
                        mn = val - 5
                        mx = val + 6
                        tot = None
                    elif met == "pm25":
                        traffic_factor = math.sin((hour_of_day - 5) * math.pi / 6)
                        val = round(max(8.0, base_val + traffic_factor * 8.0), 1)
                        mn = round(val - 2.0, 1)
                        mx = round(val + 2.0, 1)
                        tot = None
                    elif met == "groundwater_depth":
                        val = round(base_val, 2)
                        mn = round(val - 0.02, 2)
                        mx = round(val + 0.02, 2)
                        tot = None
                    else:
                        val = round(max(0.1, base_val + solar_factor * 2.0), 2)
                        mn = round(val - 0.5, 2)
                        mx = round(val + 0.5, 2)
                        tot = None

                    session.add(EnvironmentalRollup(
                        id=str(uuid4()),
                        source_id=source_id,
                        station_id=st_id,
                        metric_key=met,
                        interval="hour",
                        bucket_start=b_start_iso,
                        bucket_end=b_end_iso,
                        value=val,
                        minimum=mn,
                        maximum=mx,
                        total=tot,
                        latest=val,
                        canonical_unit=unit,
                        status="AVAILABLE",
                        quality="validated",
                        sample_count=4,
                        valid_sample_count=4,
                        expected_sample_count=4,
                        coverage_fraction=1.0,
                        quality_flags=[],
                        processing_version="1.0.0",
                        generated_at=now_iso,
                    ))
                    rollup_count += 1

            # Daily rollups for 90 days (for 30d, 90d, 1y views)
            for d in range(90, -1, -1):
                d_start = now - timedelta(days=d)
                d_end = d_start + timedelta(days=1)
                d_start_iso = d_start.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
                d_end_iso = d_end.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
                seasonal_factor = math.sin(d * math.pi / 45)

                for met in metrics:
                    base_val = prof.get(met)
                    if base_val is None or met == "groundwater_assessment":
                        continue
                    unit = next((m["canonical_unit"] for m in METRIC_DEFS if m["key"] == met), "")

                    if met == "temperature":
                        val = round(base_val + seasonal_factor * 3.0, 1)
                        mn = round(val - 5.5, 1)
                        mx = round(val + 6.0, 1)
                        tot = None
                    elif met == "relative_humidity":
                        val = round(max(25.0, min(95.0, base_val - seasonal_factor * 8.0)), 1)
                        mn = round(val - 15.0, 1)
                        mx = round(val + 15.0, 1)
                        tot = None
                    elif met == "rainfall":
                        val = 0.0 if (d % 6 != 0) else round(random.uniform(2.0, 18.0), 1)
                        mn = 0.0
                        mx = val
                        tot = val
                    elif met == "aqi":
                        val = float(int(max(30, base_val + seasonal_factor * 22)))
                        mn = val - 18
                        mx = val + 24
                        tot = None
                    elif met == "pm25":
                        val = round(max(10.0, base_val + seasonal_factor * 11.0), 1)
                        mn = round(val - 8.0, 1)
                        mx = round(val + 10.0, 1)
                        tot = None
                    elif met == "groundwater_depth":
                        val = round(base_val + seasonal_factor * 0.4, 2)
                        mn = round(val - 0.1, 2)
                        mx = round(val + 0.1, 2)
                        tot = None
                    else:
                        val = round(max(0.1, base_val), 2)
                        mn = round(val * 0.8, 2)
                        mx = round(val * 1.2, 2)
                        tot = None

                    session.add(EnvironmentalRollup(
                        id=str(uuid4()),
                        source_id=source_id,
                        station_id=st_id,
                        metric_key=met,
                        interval="day",
                        bucket_start=d_start_iso,
                        bucket_end=d_end_iso,
                        value=val,
                        minimum=mn,
                        maximum=mx,
                        total=tot,
                        latest=val,
                        canonical_unit=unit,
                        status="AVAILABLE",
                        quality="validated",
                        sample_count=96,
                        valid_sample_count=96,
                        expected_sample_count=96,
                        coverage_fraction=1.0,
                        quality_flags=[],
                        processing_version="1.0.0",
                        generated_at=now_iso,
                    ))
                    rollup_count += 1

        session.flush()
        print(f"{rollup_count} environmental rollups seeded (hourly and daily).")

    print("Environmental monitoring data seeding successfully completed!")


if __name__ == "__main__":
    run_seed()
