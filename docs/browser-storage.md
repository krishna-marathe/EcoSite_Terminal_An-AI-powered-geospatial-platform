# Browser saved-data context (Phase 01C.3)

Browser storage is local to this origin and browser profile. It is not project
persistence or a Site Readiness Passport. API mode describes how data was fetched;
it does not mean independently verified observations. Keep payload data-status
labels, including synthetic, in every context.

## Keys and versions

| Key | Purpose |
| --- | --- |
| `ecosite-pilot-project-v2` | Zustand envelope, version 2; state schemaVersion 2, cityId, dataMode, savedCandidates and savedScenarios |
| `ecosite-mitigation-v2-{demo|api}-{cityId}-{encodeURIComponent(facilityId)}` | One scoped mitigation plan |
| `ecosite-pilot-project-v1` | Retained legacy candidates, city scenarios and preferences; never rewritten by v2 |
| `ecosite-mitigation-{cityId}-{facilityId}` | Retained legacy plan; never rewritten or exported by v2 |
| `ECOSITE_MAPBOX_TOKEN` | Existing optional public basemap preference; unaffected |
| `ECOSITE_GEMINI_API_KEY` | Existing credential retirement only; Gemini stays disabled |

Every new candidate, scenario or mitigation record has schemaVersion 1, dataMode
(demo/api), cityId, id, updatedAt (ISO timestamp), and payload. Candidate IDs come
from existing assessments. Scenario IDs are city IDs. Plan IDs are facility IDs:
current plans are facility-based, not candidate-linked. New relationships are not
invented. Candidate and scenario collections retain both modes; the store exposes
only the active mode to existing consumers. Removal and clearing affect only the
active mode/city. No new candidate count limit is imposed.

Plans initialize only when the scoped key is absent. Revisit loads a valid saved
plan, including constraints and catalogue/AI source labels, without modifying its
bytes or timestamp. A legacy plan does not become the new default: it stays
isolated while an independent, clearly illustrative catalogue may initialize in
the active context. Invalid scoped plans remain untouched and produce a warning;
the standard catalogue is still viewable but is not saved over invalid data.

## Compatibility and validation

The old mode preference only describes the last selected mode. It cannot identify
the origin of every old candidate or plan. Synthetic status is also insufficient:
the API may return synthetic records. Therefore all unscoped legacy records are
treated as LEGACY_UNSCOPED and excluded from comparisons and exports in both modes.
Only validated city/mode preferences are copied on first load when v2 is absent.
Other old preferences and scenarios remain byte-for-byte in the old key. No legacy
records are copied into a mode, so repeated startup cannot duplicate migration.

Runtime validation checks envelope versions, modes, cities, IDs, timestamps and
payload fields before use. Invalid or unsupported dashboard storage is kept intact;
the app starts with an empty active context and a warning. Writes to that key are
blocked until manual recovery, so in-memory changes in that condition do not survive
reload. Storage-access failures also produce a controlled hydration warning.

There is no automatic deletion, provenance inference, migration wizard or recovery
button. Back up raw keys before any future manual recovery/import. A later workflow
must establish origin explicitly before importing legacy records. Do not rename an
old key to v2 or label all old records API-backed. Concurrent-tab conflict resolution
is not implemented; avoid editing the same browser context in multiple tabs.

## Reports

The dossier is schemaVersion 2. Its builder filters validated candidate, scenario
and plan envelopes by active mode/city; plans must reference an in-scope facility.
JSON includes dataMode, CSV includes Mode, filenames include mode, and print repeats
mode. Reports preserve synthetic labels and explain that API mode is not external
verification. Candidate CSV, mitigation CSV and print use the same scoped dossier.
The existing CSV serialization and formula-injection protection are unchanged.
