# EcoSite API Contract

Contract version: `2026-10-29.b0`

Status: frozen for Phase B0 frontend fixtures and database vocabulary review.
These examples define the target API. Endpoints marked **planned** are not yet
implemented. A later phase may add optional fields, but must not rename fields,
change units, or change enum meanings without a coordinated contract revision.

## 1. Conventions

- Base path: `/api/v1`
- JSON field names use `camelCase`.
- IDs are stable opaque strings. Clients must not parse meaning from an ID.
- Dates use `YYYY-MM-DD`.
- Timestamps use UTC ISO-8601 with `Z`, for example
  `2026-10-29T08:30:00Z`.
- Coordinate arrays are `[longitude, latitude]`.
- A missing value is `null` or an explicit unavailable metric. It is never `0`.
- Public facility coordinates are generalized locality/district coordinates.
  No public schema contains exact submitted geometry.
- Capacity records are never added unless `unit`, `capacityType` and `scope`
  are compatible.
- Public environmental observations are nearby station context, not facility
  consumption, emissions, groundwater use, or campus telemetry.
- Page requests read cached EcoSite data and never wait for a third-party API.

### Temporal classes

| Value | Meaning |
|---|---|
| `stable` | Facility identity, locality, ownership, design/disclosed capacity |
| `periodic` | Annual or otherwise periodic operator/authority reporting |
| `near_real_time` | Public station observations refreshed at provider cadence |
| `live_private` | Restricted operator/utility telemetry when available |
| `derived` | EcoSite rollups, comparisons, alerts or screening results |

### Visibility classes

- `public`
- `ministry`
- `regulator`

The presence of a visibility value does not grant access. Authorization is
enforced separately.

### Evidence classes

- `measured`
- `authority_verified`
- `operator_declared`
- `documented_public`
- `derived`
- `modelled`
- `unavailable`

### Metric availability

- `AVAILABLE`: enough valid data exists for the requested representation
- `PARTIAL`: some data exists, but coverage is incomplete
- `STALE`: a last known value exists but exceeded its freshness threshold
- `SOURCE_UNAVAILABLE`: the source failed and no current value is available
- `NOT_COVERED`: no suitable source/station covers this facility and metric
- `UNKNOWN`: a linked observation exists but its value/status is unknown

`NOT_COVERED` is derived at query time from facility/station/source coverage.
It is not persisted as a physical observation status.

### Observation quality

- `preliminary`: current operational data not yet regulatory-validated
- `validated`: provider/authority-validated data
- `unknown`: provider supplied no validation classification

## 2. Standard errors

All new endpoints use this error envelope. Existing endpoints migrate to it
when their implementation phase begins.

```json
{
  "error": {
    "code": "facility_not_found",
    "message": "Public facility not found.",
    "details": {},
    "requestId": "req_01JBC3V5PE8D6T1K7Y7Y4B2D0C"
  }
}
```

Common status/code pairs:

| HTTP | Code | Use |
|---:|---|---|
| 400 | `invalid_request` | Malformed filter combination or unsupported action |
| 401 | `authentication_required` | No valid identity |
| 403 | `access_denied` | Identity lacks access to the record/action |
| 404 | `facility_not_found` | Public facility absent or not publishable |
| 404 | `submission_not_found` | Private submission absent or inaccessible |
| 409 | `revision_conflict` | Optimistic revision is stale |
| 409 | `invalid_transition` | Workflow action is invalid for current state |
| 422 | `validation_failed` | Typed request validation failed |
| 429 | `rate_limited` | Caller exceeded an enforced quota |
| 503 | `service_unavailable` | EcoSite cannot serve the request safely |

Validation details contain safe field paths and messages, never submitted
secrets, exact private geometry, SQL, or third-party credentials.

```json
{
  "error": {
    "code": "validation_failed",
    "message": "Request validation failed.",
    "details": {
      "fields": [
        {"path": "capacityDisclosures.0.value", "message": "Must be greater than zero."}
      ]
    },
    "requestId": "req_01JBC3V5PE8D6T1K7Y7Y4B2D0C"
  }
}
```

## 3. Shared public facility shapes

### Source reference

```json
{
  "title": "Mumbai 02 data centre",
  "publisher": "Example Operator",
  "url": "https://operator.example/facilities/mumbai-02",
  "sourceClass": "operator",
  "retrievedAt": "2026-10-20"
}
```

`sourceClass` is one of:

- `government`
- `operator`
- `operator_factsheet`
- `filing`
- `certification`
- `news`
- `industry_publication`
- `directory`

### Verification

```json
{
  "status": "public_operator_confirmed",
  "verifiedAt": "2026-10-20",
  "expiresAt": "2027-01-18",
  "source": {
    "title": "Mumbai 02 data centre",
    "publisher": "Example Operator",
    "url": "https://operator.example/facilities/mumbai-02",
    "sourceClass": "operator",
    "retrievedAt": "2026-10-20"
  }
}
```

`status` is one of `government_verified`, `public_operator_confirmed`, or
`credible_public_report`. An operational verification window is at most 90
days. Expired records are not returned by public endpoints.

### Capacity disclosure

```json
{
  "value": 16.0,
  "unit": "MW",
  "capacityType": "it_load",
  "scope": "operational building"
}
```

- `unit`: `MW` or `MVA`
- `capacityType`: `it_load`, `total_power`, `power_capacity`, or
  `power_capacity_unspecified`

### Public facility

```json
{
  "id": "example-mumbai-02",
  "name": "Mumbai 02",
  "operator": "Example Operator",
  "ownershipCategory": "private",
  "facilityType": "colocation",
  "stateCode": "IN-MH",
  "state": "Maharashtra",
  "city": "Mumbai",
  "locality": "Chandivali",
  "publicCoordinates": [72.889, 19.112],
  "locationPrecision": "locality",
  "operationalSince": 2022,
  "capacityDisclosures": [
    {
      "value": 16.0,
      "unit": "MW",
      "capacityType": "it_load",
      "scope": "operational building"
    }
  ],
  "verification": {
    "status": "public_operator_confirmed",
    "verifiedAt": "2026-10-20",
    "expiresAt": "2027-01-18",
    "source": {
      "title": "Mumbai 02 data centre",
      "publisher": "Example Operator",
      "url": "https://operator.example/facilities/mumbai-02",
      "sourceClass": "operator",
      "retrievedAt": "2026-10-20"
    }
  }
}
```

Enums:

- `ownershipCategory`: `private`, `government`, `ppp`, `other`, `unknown`
- `facilityType`: `colocation`, `hyperscale`, `enterprise`, `edge`,
  `government`, `other`
- `locationPrecision`: `locality`, `district`

Forbidden in every public facility response:

- `exactCoordinates`
- `restrictedGeometry`
- operator contact information
- network routes, customers, security or resilience details
- mutable private submission IDs or evidence files

## 4. Public facility list

`GET /api/v1/public-facilities`

Implemented in Phase B1 through a persistence-neutral service. SQLite approved
snapshots are the default repository after the `04b_001` migration/import; the
reviewed JSON adapter remains an explicit transition option. A selected SQLite
repository never silently falls back to JSON.

Query parameters:

| Name | Type/default | Rules |
|---|---|---|
| `state` | optional state code | `IN-MH`, `IN-TG`, `IN-KA`, `IN-TN` |
| `operator` | optional string | case-insensitive exact operator label |
| `facilityType` | optional enum | facility type above |
| `q` | optional string | name/operator/city/locality search |
| `freshness` | `current` | public API accepts only `current` in Phase B1 |
| `page` | integer, `1` | minimum 1 |
| `pageSize` | integer, `50` | 1-100 |

Response:

```json
{
  "items": [
    {
      "id": "example-mumbai-02",
      "name": "Mumbai 02",
      "operator": "Example Operator",
      "ownershipCategory": "private",
      "facilityType": "colocation",
      "stateCode": "IN-MH",
      "state": "Maharashtra",
      "city": "Mumbai",
      "locality": "Chandivali",
      "publicCoordinates": [72.889, 19.112],
      "locationPrecision": "locality",
      "operationalSince": 2022,
      "capacityDisclosures": [],
      "verification": {
        "status": "public_operator_confirmed",
        "verifiedAt": "2026-10-20",
        "expiresAt": "2027-01-18",
        "source": {
          "title": "Mumbai 02 data centre",
          "publisher": "Example Operator",
          "url": "https://operator.example/facilities/mumbai-02",
          "sourceClass": "operator",
          "retrievedAt": "2026-10-20"
        }
      }
    }
  ],
  "page": 1,
  "pageSize": 50,
  "total": 19,
  "registryVersion": "2026-10-29",
  "asOf": "2026-10-29"
}
```

Compatibility note: Phase B1 replaced the original item array with this
envelope. Clients written against the original prototype must read `items` and
may now send pagination filters. The frontend integration is intentionally a
separate coordinated change.

## 5. Public facility summary

`GET /api/v1/public-facilities/summary`

```json
{
  "registryVersion": "2026-10-29",
  "asOf": "2026-10-29",
  "operationalFacilityCount": 19,
  "operatorCount": 12,
  "byState": {
    "IN-MH": 8,
    "IN-TG": 4,
    "IN-KA": 3,
    "IN-TN": 4
  },
  "capacityAggregation": "disabled_mixed_measurement_boundaries"
}
```

This endpoint never returns a total capacity while records contain incompatible
units, capacity types, scopes or measurement boundaries.

## 6. Public facility detail

`GET /api/v1/public-facilities/{facilityId}`

Returns one Public facility shape from section 3. A record that is missing,
expired or not approved for publication returns `404 facility_not_found`; the
response does not reveal which case applies.

## 7. Environmental shared shapes

Environmental endpoint schemas and read-only API routes are implemented in
Phase B2 against the cached SQLite repository. A published facility with no
eligible station/observation returns explicit `NOT_COVERED` entries; storage
failure returns `503 service_unavailable`. Routes never fetch providers directly.

### Frozen metric keys and canonical units

| Metric key | Canonical unit | Family | Preferred aggregation |
|---|---|---|---|
| `aqi` | `index` | `air_quality` | latest/max |
| `pm25` | `ug/m3` | `air_quality` | mean |
| `pm10` | `ug/m3` | `air_quality` | mean |
| `no2` | `ug/m3` | `air_quality` | mean |
| `so2` | `ug/m3` | `air_quality` | mean |
| `co` | `mg/m3` | `air_quality` | mean |
| `o3` | `ug/m3` | `air_quality` | mean |
| `temperature` | `degC` | `weather` | mean/min/max |
| `relative_humidity` | `percent` | `weather` | mean |
| `rainfall` | `mm` | `weather` | sum |
| `wind_speed` | `m/s` | `weather` | mean/max |
| `wind_direction` | `degree` | `weather` | latest/vector method |
| `groundwater_depth` | `m_bgl` | `groundwater` | latest/min/max |
| `groundwater_assessment` | `category` | `groundwater` | latest |

`m_bgl` means metres below ground level. Original values and units remain in
storage/provenance even when the public API returns a canonical value.
`groundwater_assessment` is a periodic published classification (default range
`1y`), not a near-real-time telemetry metric.

### Station context

```json
{
  "stationId": "cpcb-station-123",
  "name": "Powai monitoring station",
  "provider": "Central Pollution Control Board",
  "sourceId": "cpcb_caaqms",
  "publicCoordinates": [72.905, 19.119],
  "stationType": "urban_background",
  "distanceKm": 2.4,
  "selectionMethod": "nearest_eligible",
  "effectiveAt": "2026-10-01T00:00:00Z"
}
```

`selectionMethod`: `nearest_eligible`, `same_district`, or
`manual_authority_mapping`.

### Provenance

```json
{
  "sourceId": "cpcb_caaqms",
  "provider": "Central Pollution Control Board",
  "dataset": "CAAQMS current observations",
  "sourceUrl": "https://example.gov.in/source",
  "retrievedAt": "2026-10-29T08:37:12Z",
  "evidenceClass": "measured",
  "temporalClass": "near_real_time",
  "visibility": "public"
}
```

## 8. Current environmental context

`GET /api/v1/public-facilities/{facilityId}/environmental/current`

Optional query: repeated/comma-separated `metrics`. If omitted, the service
returns all public metrics with coverage, including explicit `NOT_COVERED`
entries for standard dashboard metrics.

```json
{
  "facilityId": "example-mumbai-02",
  "generatedAt": "2026-10-29T08:40:00Z",
  "metrics": [
    {
      "metric": "pm25",
      "displayName": "PM2.5",
      "value": 41.2,
      "unit": "ug/m3",
      "originalValue": 41.2,
      "originalUnit": "ug/m3",
      "availability": "AVAILABLE",
      "quality": "preliminary",
      "observedAt": "2026-10-29T08:00:00Z",
      "publishedAt": "2026-10-29T08:30:00Z",
      "retrievedAt": "2026-10-29T08:37:12Z",
      "freshUntil": "2026-10-29T10:00:00Z",
      "qualityFlags": [],
      "station": {
        "stationId": "cpcb-station-123",
        "name": "Powai monitoring station",
        "provider": "Central Pollution Control Board",
        "sourceId": "cpcb_caaqms",
        "publicCoordinates": [72.905, 19.119],
        "stationType": "urban_background",
        "distanceKm": 2.4,
        "selectionMethod": "nearest_eligible",
        "effectiveAt": "2026-10-01T00:00:00Z"
      },
      "provenance": {
        "sourceId": "cpcb_caaqms",
        "provider": "Central Pollution Control Board",
        "dataset": "CAAQMS current observations",
        "sourceUrl": "https://example.gov.in/source",
        "retrievedAt": "2026-10-29T08:37:12Z",
        "evidenceClass": "measured",
        "temporalClass": "near_real_time",
        "visibility": "public"
      },
      "contextNotice": "Nearby public monitoring-station context; not an on-site facility measurement."
    },
    {
      "metric": "groundwater_depth",
      "displayName": "Groundwater depth",
      "value": null,
      "unit": "m_bgl",
      "originalValue": null,
      "originalUnit": null,
      "availability": "NOT_COVERED",
      "quality": "unknown",
      "observedAt": null,
      "publishedAt": null,
      "retrievedAt": null,
      "freshUntil": null,
      "qualityFlags": ["no_eligible_station"],
      "station": null,
      "provenance": null,
      "contextNotice": "No suitable public groundwater station is linked to this facility."
    }
  ]
}
```

Stale data keeps its last value and uses `availability: "STALE"`. A missing
value uses `null`, never zero.

## 9. Environmental time range

`GET /api/v1/public-facilities/{facilityId}/environmental`

Query parameters:

- `metrics`: comma-separated frozen metric keys; required
- `range`: `24h`, `7d`, `30d`, `90d`, `1y`; default `24h`
- `interval`: `auto`, `raw`, `hour`, `day`; default `auto`

`auto` selects raw/hourly for 24 hours, hourly/daily for 7 days, and daily for
longer ranges. The server may reject a raw interval that would exceed its point
limit rather than silently changing the requested interval.

```json
{
  "facilityId": "example-mumbai-02",
  "range": "24h",
  "interval": "hour",
  "from": "2026-10-28T09:00:00Z",
  "to": "2026-10-29T09:00:00Z",
  "generatedAt": "2026-10-29T09:00:10Z",
  "series": [
    {
      "metric": "temperature",
      "displayName": "Temperature",
      "unit": "degC",
      "availability": "PARTIAL",
      "quality": "preliminary",
      "coverageFraction": 0.9583,
      "expectedSampleCount": 24,
      "validSampleCount": 23,
      "station": {
        "stationId": "imd-aws-456",
        "name": "Mumbai AWS",
        "provider": "India Meteorological Department",
        "sourceId": "imd_aws",
        "publicCoordinates": [72.88, 19.09],
        "stationType": "automatic_weather_station",
        "distanceKm": 3.1,
        "selectionMethod": "nearest_eligible",
        "effectiveAt": "2026-10-01T00:00:00Z"
      },
      "provenance": {
        "sourceId": "imd_aws",
        "provider": "India Meteorological Department",
        "dataset": "Automatic Weather Station observations",
        "sourceUrl": "https://example.gov.in/source",
        "retrievedAt": "2026-10-29T08:50:00Z",
        "evidenceClass": "measured",
        "temporalClass": "near_real_time",
        "visibility": "public"
      },
      "points": [
        {
          "timestamp": "2026-10-29T07:00:00Z",
          "value": 29.1,
          "originalValue": 29.1,
          "originalUnit": "degC",
          "minimum": 28.7,
          "maximum": 29.5,
          "sampleCount": 4,
          "coverageFraction": 1.0,
          "qualityFlags": []
        },
        {
          "timestamp": "2026-10-29T08:00:00Z",
          "value": null,
          "originalValue": null,
          "originalUnit": null,
          "minimum": null,
          "maximum": null,
          "sampleCount": 0,
          "coverageFraction": 0.0,
          "qualityFlags": ["missing_interval"]
        }
      ],
      "contextNotice": "Nearby public monitoring-station context; not an on-site facility measurement."
    }
  ]
}
```

For `rainfall`, `value` is the interval sum. For direction metrics, unsupported
scalar averaging is not performed. Empty series remain present with an explicit
availability and zero valid samples.

`value`/`unit` are canonical. `originalValue`/`originalUnit` preserve the
provider representation when supplied; they are `null` when the source did not
provide a value or unit.

## 10. State environmental summary

`GET /api/v1/environmental/summary`

Query:

- `state`: required four-state code
- `range`: `24h`, `7d`, `30d`, `90d`, `1y`; default `24h`
- optional `metrics`

This endpoint summarizes monitoring context associated with published
facilities. It does not attribute environmental conditions to data centres.

```json
{
  "stateCode": "IN-MH",
  "range": "24h",
  "generatedAt": "2026-10-29T09:00:10Z",
  "facilityCount": 8,
  "coveredFacilityCount": 7,
  "metrics": [
    {
      "metric": "aqi",
      "displayName": "Air Quality Index",
      "unit": "index",
      "availability": "PARTIAL",
      "coveredFacilityCount": 7,
      "currentFacilityCount": 6,
      "staleFacilityCount": 1,
      "unavailableFacilityCount": 1,
      "minimum": 62.0,
      "maximum": 148.0,
      "mean": 101.4,
      "aggregationMethod": "facility_context_mean",
      "contextNotice": "Summary of nearby public stations linked to facilities; not facility-caused pollution."
    }
  ],
  "sourceHealth": [
    {
      "sourceId": "cpcb_caaqms",
      "status": "CONNECTED",
      "lastCheckedAt": "2026-10-29T08:37:12Z",
      "lastSuccessAt": "2026-10-29T08:37:12Z"
    }
  ]
}
```

## 11. Operator registration workflow

All endpoints in this section require an authenticated operator identity.
Exact geometry is restricted.

The Phase B4/B5 HTTP routes and schemas are implemented against the reviewed
`04c_001` SQLite repositories. Storage failures fail closed with
`503 service_unavailable`.

### Prototype identity boundary

Local prototype requests use both headers below:

- `X-EcoSite-Demo-Actor: demo-operator` and
  `X-EcoSite-Demo-Role: operator`; or
- `X-EcoSite-Demo-Actor: demo-ministry-reviewer` and
  `X-EcoSite-Demo-Role: ministry_reviewer`.

Only these fixed pairs are accepted. Missing identity returns 401 and a role
mismatch returns 403. This mechanism is disabled when `ECOSITE_ENV=production`
or `ECOSITE_DEMO_AUTH_ENABLED` is not `1`. It is demonstrative authorization,
not production authentication, SSO or verified organisation onboarding.

### Create draft

`POST /api/v1/operator/facility-submissions`

```json
{
  "facilityName": "Example Mumbai Campus",
  "operatorOrganisationId": "org_example_operator",
  "facilityType": "colocation",
  "stateCode": "IN-MH",
  "city": "Mumbai",
  "locality": "Chandivali",
  "exactGeometry": {
    "type": "Point",
    "coordinates": [72.889432, 19.112345]
  }
}
```

Response `201`:

```json
{
  "id": "sub_01JBC4A0Z1C98XH0GQJTFD9A8V",
  "status": "draft",
  "revision": 1,
  "facilityName": "Example Mumbai Campus",
  "operatorOrganisationId": "org_example_operator",
  "facilityType": "colocation",
  "stateCode": "IN-MH",
  "city": "Mumbai",
  "locality": "Chandivali",
  "exactGeometry": {
    "type": "Point",
    "coordinates": [72.889432, 19.112345]
  },
  "capacityDisclosures": [],
  "evidence": [],
  "createdAt": "2026-10-29T09:10:00Z",
  "updatedAt": "2026-10-29T09:10:00Z"
}
```

### Update draft/revision

`PATCH /api/v1/operator/facility-submissions/{submissionId}`

Every mutation supplies `expectedRevision`.

```json
{
  "expectedRevision": 1,
  "capacityDisclosures": [
    {
      "value": 16.0,
      "unit": "MW",
      "capacityType": "it_load",
      "scope": "phase 1 design"
    }
  ]
}
```

The response returns the complete private submission with `revision: 2`.

### Submit for review

`POST /api/v1/operator/facility-submissions/{submissionId}/submit`

```json
{"expectedRevision": 2}
```

Response status becomes `submitted` and the revision increments. Submission
does not imply government verification or public visibility.

Operator-visible statuses:

- `draft`
- `submitted`
- `information_requested`
- `resubmitted`
- `approved`
- `rejected`
- `withdrawn`

## 12. Ministry review workflow

All endpoints require a ministry reviewer.

### Queue

`GET /api/v1/ministry/facility-submissions?status=submitted&page=1&pageSize=50`

```json
{
  "items": [
    {
      "id": "sub_01JBC4A0Z1C98XH0GQJTFD9A8V",
      "status": "submitted",
      "revision": 3,
      "facilityName": "Example Mumbai Campus",
      "operatorOrganisationId": "org_example_operator",
      "stateCode": "IN-MH",
      "city": "Mumbai",
      "submittedAt": "2026-10-29T09:30:00Z",
      "assignedReviewerId": null
    }
  ],
  "page": 1,
  "pageSize": 50,
  "total": 1
}
```

### Review detail

`GET /api/v1/ministry/facility-submissions/{submissionId}`

Returns the complete restricted submission, revision/evidence history, exact
geometry, review history and a proposed generalized public snapshot. This
schema is never reused by a public endpoint.

### Review action

`POST /api/v1/ministry/facility-submissions/{submissionId}/actions`

Request information:

```json
{
  "expectedRevision": 3,
  "action": "request_information",
  "reason": "Provide evidence for the stated operational IT load.",
  "requestedFields": ["capacityDisclosures"]
}
```

Reject:

```json
{
  "expectedRevision": 3,
  "action": "reject",
  "reason": "The supplied location evidence does not identify an operating facility."
}
```

Approve and publish:

```json
{
  "expectedRevision": 3,
  "action": "approve",
  "reason": "Evidence reviewed for prototype publication.",
  "publicSnapshot": {
    "id": "example-mumbai-campus",
    "name": "Example Mumbai Campus",
    "operator": "Example Operator",
    "ownershipCategory": "private",
    "facilityType": "colocation",
    "stateCode": "IN-MH",
    "state": "Maharashtra",
    "city": "Mumbai",
    "locality": "Chandivali",
    "publicCoordinates": [72.889, 19.112],
    "locationPrecision": "locality",
    "operationalSince": 2026,
    "capacityDisclosures": [],
    "verification": {
      "status": "government_verified",
      "verifiedAt": "2026-10-29",
      "expiresAt": "2027-01-27",
      "source": {
        "title": "Reviewed operator submission",
        "publisher": "EcoSite Ministry Reviewer",
        "url": "https://example.gov.in/reviews/sub_01JBC4A0Z1C98XH0GQJTFD9A8V",
        "sourceClass": "government",
        "retrievedAt": "2026-10-29"
      }
    }
  }
}
```

Successful action response:

```json
{
  "submissionId": "sub_01JBC4A0Z1C98XH0GQJTFD9A8V",
  "status": "approved",
  "revision": 4,
  "decision": {
    "action": "approve",
    "reason": "Evidence reviewed for prototype publication.",
    "decidedAt": "2026-10-29T10:00:00Z",
    "decidedBy": "demo-ministry-reviewer"
  },
  "publishedFacilityId": "example-mumbai-campus",
  "publicSnapshotVersion": 1
}
```

Approval creates an immutable public snapshot. It does not mutate the private
submission into a public row and does not make every submitted claim
government-verified. Each published fact retains its evidence/verification
classification.

Prototype approval accepts only a new public facility `id`, requires complete
reviewed verification/source provenance, and rejects an existing public ID.
Publication atomically creates a coherent registry release so all current
snapshots share one registry version; it never overwrites an existing
public-source facility fact.

## 13. Ministry operations

These restricted routes require the demo ministry reviewer identity:

- `GET /api/v1/ministry/operations/overview?queueLimit=100`
- `GET /api/v1/ministry/operations/source-health`
- `GET /api/v1/ministry/operations/freshness?limit=100`
- `GET /api/v1/ministry/operations/states/{stateCode}`
- `GET /api/v1/ministry/operations/facilities/{facilityId}`

The overview response contains state facility/current/stale/unavailable counts,
source health, and a prioritized freshness queue. Queue order is unavailable,
stale, not covered, then current; older observations are prioritized within a
status. These are operational attention signals, not automatic enforcement.

```json
{
  "generatedAt": "2026-10-29T12:00:00Z",
  "facilityCount": 8,
  "states": [
    {
      "stateCode": "IN-MH",
      "facilityCount": 8,
      "currentFacilityCount": 0,
      "staleFacilityCount": 0,
      "unavailableFacilityCount": 8
    }
  ],
  "sourceHealth": [
    {
      "sourceId": "cpcb_caaqms",
      "provider": "Central Pollution Control Board",
      "status": "NOT_CONNECTED",
      "lastCheckedAt": null,
      "lastSuccessAt": null,
      "staleFacilityCount": 0,
      "failedRunCount": 0
    }
  ],
  "freshnessQueue": [
    {
      "facilityId": "example-mumbai-02",
      "facilityName": "Mumbai 02",
      "stateCode": "IN-MH",
      "metric": "pm25",
      "status": "not_covered",
      "observedAt": null,
      "ageSeconds": null,
      "sourceId": null,
      "reason": "No eligible station link"
    }
  ]
}
```

## 14. Repository/service boundaries

The target routers depend on interfaces rather than SQLite or JSON directly:

```text
PublicFacilityRepository
  list_public_facilities(filters, page, page_size)
  get_public_facility(facility_id)
  get_public_summary()

EnvironmentalQueryService
  get_current(facility_id, metrics)
  get_range(facility_id, metrics, range, interval)
  get_state_summary(state_code, metrics, range)

SubmissionRepository
  create_draft(actor, request)
  update_draft(actor, submission_id, expected_revision, changes)
  submit(actor, submission_id, expected_revision)
  list_for_review(reviewer, filters, page, page_size)
  get_for_review(reviewer, submission_id)
  apply_review_action(reviewer, submission_id, expected_revision, action)
```

Phase B0 does not select table names or implement persistence. The Database
Agent's contract may map these interfaces to normalized tables without changing
the public JSON shapes above.

### Database-to-API vocabulary mapping

The database uses uppercase policy/evidence values and `snake_case` columns.
The API uses the lower-case public vocabulary and `camelCase` fields defined in
this document. Repositories/serializers map explicitly; ORM rows are never
returned directly.

| Database contract | API value |
|---|---|
| `MEASURED` | `measured` |
| `AUTHORITY_VERIFIED` | `authority_verified` |
| `DECLARED` | `operator_declared` |
| `DOCUMENTED` | `documented_public` when the document is approved public evidence |
| `MODELLED` | `modelled` |
| `UNAVAILABLE` | `unavailable` |
| `PUBLIC` | `public` |
| `MINISTRY` | `ministry` |
| `REGULATOR_RESTRICTED` | `regulator` |
| `STATIC_VERSIONED` | `stable` |
| `PERIODIC` | `periodic` |
| `NEAR_REAL_TIME` | `near_real_time` |
| `PRIVATE_LIVE` | `live_private` |
| `DERIVED` | `derived` |

`REMOTE_SENSING_DERIVED`, `OFFICIAL_GEOSPATIAL`, `CROWD_SOURCED` and
`SYNTHETIC_DEMO` remain internal evidence detail unless a later public contract
requires them. Synthetic demo observations must never enter real operational
responses.

## 15. Contract gates

Before Phase B1 integration:

- Database Agent confirms stable facility/source/capacity/verification IDs.
- Frontend Agent compiles types and fixtures against this document.
- Coordinator approves the list response envelope migration.

Before Phase B2 integration:

- Database Agent confirms metric keys, canonical units, station/link fields and
  rollup indexes.
- Backend tests cover stale, unavailable, not-covered, missing and partial data.
- Frontend labels every station series as nearby context.

Before Phase B4 integration:

- Authentication/authorization boundary is agreed.
- Database Agent confirms restricted geometry is physically separated.
- Privacy tests prove public serializers cannot access restricted fields.
- Snapshot immutability and audit-event persistence are tested.
