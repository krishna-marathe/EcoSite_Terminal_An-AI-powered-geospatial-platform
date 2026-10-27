# India preliminary screening boundaries

This directory contains two pinned screening datasets:

| File | Purpose | Used by |
| --- | --- | --- |
| `IND-ADM0-9469f09.geojson` + `IND-ADM0-manifest.json` | National containment check | `backend/app/geometry.py` |
| `IND-ADM1-4states.geojson` + `IND-ADM1-4states-manifest.json` | Four-state product scope | `backend/app/state_scope.py` |

Neither is a legal boundary determination.

---

## 1. National boundary (ADM0)

Bundled from [geoBoundaries gbOpen IND ADM0](https://www.geoboundaries.org/api/current/gbOpen/IND/ADM0/), boundary ID IND-ADM0-67634026, pinned repository version 9469f09. Source attribution: geoBoundaries and Wikimedia Commons. Dataset represents 2014; source update April 5, 2023; build December 12, 2023. These are provider metadata dates, not current verification dates.

Licence: [CC0 1.0 Universal Public Domain Dedication](https://creativecommons.org/publicdomain/zero/1.0/). Provider source/license links are incomplete category/file references; they are retained verbatim in the manifest, not embellished. The geometry is redistributed unchanged. The manifest records the metadata endpoint, immutable download URL, version, attribution and licence.

SHA-256: 77fb5cb03be9970e638fa38d1bd6a377ea7e158b4dfd1a511067925442233443

The downloaded bytes match the pinned Git LFS object's checksum (91,616 bytes). The file contains one valid MultiPolygon feature, including island components. It is loaded locally with checksum verification and cached; no per-request downloads occur.

A 5,000 metre review band is an application policy, not an accuracy guarantee. Distances use a local WGS84 azimuthal-equidistant projection. Covered polygons in this band are stored as review_required. Crossing/nearby outside polygons receive boundary_review_required (422) and are not saved; clearly outside polygons receive invalid_geometry (422). Island/coastline omissions and generalization can require manual review even outside that band. No automatic acceptance of offshore sites or correction of dataset geometry occurs.

Overrides retain the earlier explicit path/checksum/source configuration; partial overrides fail closed. Custom datasets are labelled unverified and require review. Restart the server after changing configuration/files. Updating the bundled release requires a reviewed manifest/checksum/code update and boundary regression tests.

---

## 2. Four-state product scope (ADM1)

The product is deliberately limited to **Telangana, Maharashtra, Karnataka and Tamil Nadu**.
The ADM0 boundary alone cannot enforce that: a polygon in Gujarat is inside India. The ADM1
layer is therefore used as a second, state-level gate.

### 2.1 Provenance

| Property | Value |
| --- | --- |
| Provider | geoBoundaries `gbOpen` IND ADM1 |
| Boundary ID | `IND-ADM1-1811400` |
| Canonical unit | State / Union Territory |
| Source | DataMeet India community, Election Commission of India |
| Metadata endpoint | `https://www.geoboundaries.org/api/current/gbOpen/IND/ADM1/` |
| Immutable download | `https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/IND/ADM1/geoBoundaries-IND-ADM1_simplified.geojson` |
| Release | `9469f09` |
| Dataset year represented | 2011 |
| Source data update | 2023-01-19 |
| Build date | 2023-12-12 |
| Licence | Creative Commons Attribution 2.5 India (CC BY 2.5 IN) |
| File | `IND-ADM1-4states.geojson` |
| Bytes | 1,779,109 |
| SHA-256 | `23f24817e39caf965f33b988b2272899daf40650ebf8b854f36f2dcd192a5cba` |
| Features | 4 |

The release file is the provider's **simplified** ADM1 GeoJSON. The four focus-state features
were filtered out unchanged; only `state_code` and `state_name` were added to each feature's
properties. The geometry was not simplified, repaired or clipped further by this project.
The manifest records the full provenance and the checksum of the filtered file.

`FOCUS_STATES` order is `IN-TG`, `IN-MH`, `IN-KA`, `IN-TN`.

### 2.2 How the gate works

`backend/app/state_scope.py` loads the file once, verifies its SHA-256 against the manifest,
and caches it. For each candidate polygon it checks:

1. The declared `state_code` is one of the four focus states.
2. The polygon is covered by the declared state's geometry (with a 1e-7° tolerance for
   floating-point edge cases).
3. If not covered, the polygon is rejected as:
   - outside the four-state union (`outside the four-state scope`),
   - inside a different focus state (`lies in <state>, not the declared <state>`), or
   - crossing a state boundary (`crosses the <state> boundary into <states>`).

A polygon that passes but lies within **1,000 m** of the declared state boundary is saved
with `boundary_screening.state_scope.status = "review_required"`. Distances use a local
WGS84 azimuthal-equidistant projection centred on the polygon.

The national ADM0 check still runs first, so the order is: valid polygon → inside India →
inside the declared focus state.

### 2.3 API behaviour

| Situation | Response |
| --- | --- |
| `state_code` not in the four states | `422` from schema validation |
| Polygon outside all four states | `422`, `detail.code = "state_scope"` |
| Polygon in a different focus state | `422`, `detail.code = "state_scope"` |
| Polygon crossing a state boundary | `422`, `detail.code = "state_scope"` |
| Boundary file missing or checksum mismatch | `503`, `detail.code = "state_scope_unavailable"` |
| Legacy candidate outside the four states | `409`, `detail.code = "state_out_of_scope"` on environmental analysis |

`GET /api/v1/data-sources/scope` returns the four states, boundary version and checksum.

### 2.4 Limitations

**Screening only, not official legal boundary verification.** Prefer
[Survey of India](https://surveyofindia.gov.in/) and its
[political maps](https://surveyofindia.gov.in/pages/political-map-of-india) for authoritative
reference. The dataset:

- represents 2011 administrative boundaries and may lag later reorganisations;
- is a simplified release, so a boundary line can be offset from the legal line;
- does not resolve disputed territory, enclaves or inter-state disputes;
- does not establish land ownership, zoning, environmental clearance or site suitability;
- does not validate that a district name matches the polygon.

The 1,000 m review band is an application policy, not an accuracy guarantee. Island and
coastline omissions can require manual review even outside the band.

### 2.5 Changing the boundary

Updating the bundled release requires a reviewed manifest/checksum/code update and boundary
regression tests (`backend/tests/test_state_scope.py`). The repository `.gitattributes`
forces LF line endings for boundary GeoJSON/JSON so the pinned SHA-256 stays valid across
platforms. Do not edit the GeoJSON in place; regenerate it, update the manifest, and re-run
the tests.
