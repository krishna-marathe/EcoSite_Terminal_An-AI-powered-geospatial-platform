"""Explicitly configured CPCB data.gov.in operational connector."""
from __future__ import annotations

import json
import os
from dataclasses import dataclass
from typing import Mapping

from .operational import (
    ConnectorNotConfigured, HttpResponse, HttpTransport, HttpxTransport,
    OperationalConnectorError, OperationalObservation, parse_utc,
)


@dataclass(frozen=True)
class MetricField:
    field: str
    canonical_unit: str
    original_unit: str
    multiplier: float = 1.0


class CpcbDataGovConnector:
    source_id = "cpcb_caaqms"
    parser_version = "cpcb-datagov-v1"

    def __init__(
        self, *, endpoint: str, resource_id: str, api_key: str,
        station_id_field: str, station_name_field: str, timestamp_field: str,
        longitude_field: str, latitude_field: str,
        metric_fields: Mapping[str, MetricField], transport: HttpTransport | None = None,
        limit: int = 1000,
    ) -> None:
        required = (endpoint, resource_id, api_key, station_id_field, station_name_field, timestamp_field, longitude_field, latitude_field)
        if not all(value.strip() for value in required) or not metric_fields:
            raise ConnectorNotConfigured("CPCB connector configuration is incomplete")
        self.endpoint = endpoint.rstrip("/")
        self.resource_id = resource_id
        self.api_key = api_key
        self.station_id_field = station_id_field
        self.station_name_field = station_name_field
        self.timestamp_field = timestamp_field
        self.longitude_field = longitude_field
        self.latitude_field = latitude_field
        self.metric_fields = dict(metric_fields)
        self.transport = transport or HttpxTransport()
        self.limit = limit

    @classmethod
    def from_environment(cls, environment: Mapping[str, str] = os.environ, **kwargs):
        names = (
            "ECOSITE_CPCB_DATAGOV_ENDPOINT", "ECOSITE_CPCB_DATAGOV_RESOURCE_ID",
            "ECOSITE_CPCB_DATAGOV_API_KEY", "ECOSITE_CPCB_STATION_ID_FIELD",
            "ECOSITE_CPCB_STATION_NAME_FIELD", "ECOSITE_CPCB_TIMESTAMP_FIELD",
            "ECOSITE_CPCB_LONGITUDE_FIELD", "ECOSITE_CPCB_LATITUDE_FIELD",
            "ECOSITE_CPCB_METRIC_FIELDS_JSON",
        )
        missing = [name for name in names if not environment.get(name)]
        if missing:
            raise ConnectorNotConfigured(f"CPCB connector is not configured: missing {', '.join(missing)}")
        try:
            raw_fields = json.loads(environment[names[-1]])
            fields = {key: MetricField(**value) for key, value in raw_fields.items()}
        except (TypeError, ValueError, json.JSONDecodeError) as error:
            raise ConnectorNotConfigured("CPCB metric field configuration is invalid") from error
        return cls(
            endpoint=environment[names[0]], resource_id=environment[names[1]], api_key=environment[names[2]],
            station_id_field=environment[names[3]], station_name_field=environment[names[4]],
            timestamp_field=environment[names[5]], longitude_field=environment[names[6]],
            latitude_field=environment[names[7]], metric_fields=fields, **kwargs,
        )

    def fetch(self) -> HttpResponse:
        return self.transport.get(
            f"{self.endpoint}/{self.resource_id}",
            params={"api-key": self.api_key, "format": "json", "limit": str(self.limit)},
            headers={"User-Agent": "EcoSite-Ministry/0.1"}, timeout=60.0,
        )

    def parse(self, response: HttpResponse) -> list[OperationalObservation]:
        try:
            payload = json.loads(response.content)
            records = payload["records"]
        except (json.JSONDecodeError, KeyError, TypeError) as error:
            raise OperationalConnectorError("CPCB response does not match the configured data.gov.in contract") from error
        observations = []
        for record in records:
            try:
                station_id = str(record[self.station_id_field]).strip()
                station_name = str(record[self.station_name_field]).strip()
                observed_at = parse_utc(str(record[self.timestamp_field]))
                longitude = float(record[self.longitude_field])
                latitude = float(record[self.latitude_field])
                if not -180 <= longitude <= 180 or not -90 <= latitude <= 90:
                    raise ValueError("coordinates out of range")
            except (KeyError, TypeError, ValueError) as error:
                raise OperationalConnectorError("CPCB station or timestamp field is invalid") from error
            for metric, config in self.metric_fields.items():
                raw = record.get(config.field)
                try:
                    original = None if raw in (None, "", "NA", "N/A") else float(raw)
                except (TypeError, ValueError) as error:
                    raise OperationalConnectorError(f"CPCB {metric} value is not numeric") from error
                value = None if original is None else original * config.multiplier
                key = f"{station_id}:{metric}:{observed_at.isoformat()}"
                observations.append(OperationalObservation(
                    source_id=self.source_id, native_station_id=station_id, station_name=station_name,
                    metric_key=metric, value=value, canonical_unit=config.canonical_unit,
                    original_value=original, original_unit=config.original_unit,
                    observed_at=observed_at, retrieved_at=response.fetched_at,
                    provider_dedupe_key=key,
                    quality_flags=("provider_missing",) if value is None else (),
                    missing_reason="Provider returned no value" if value is None else None,
                    longitude=longitude, latitude=latitude,
                    station_type="continuous_ambient_air_quality_station",
                ))
        return observations

