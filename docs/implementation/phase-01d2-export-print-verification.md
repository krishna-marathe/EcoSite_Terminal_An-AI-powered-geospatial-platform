# Phase 01D.2 — Export and print verification

Date: 2026-10-27. Verdict: **PARTIAL** — real downloads verified; native print preview and paper layout NOT VERIFIED. Phase 02 not started.

## Scope and isolation

Inspected existing report/store-context diffs and Reports.tsx, Reports.css, planningReport.ts, csvExport.ts and savedContext.ts. No production or test code changed. Prior team changes retained. Frontend served on 127.0.0.1:5189 with an empty temporary env directory; backend on 127.0.0.1:18002 with ECOSITE_DB_PATH pointing to a temporary test.db. No normal database startup. Fresh standalone Chrome 155.0.8059.85 context and separate temporary headed profile used; user browser storage untouched.

## Browser procedure and results

1. Open Reports in a clean context; initial Demo facility CSV downloaded.
2. Use Site analysis to evaluate and save a uniquely named Demo candidate containing a comma and quotes. Open Mitigation to initialize its catalogue plan.
3. Switch to API, evaluate/save an API candidate through the temporary backend, and initialize its plan. Give the two test-only plan records distinct titles/constraints in isolated browser storage; no application/storage-contract change.
4. Open Reports in API and Demo modes. Download facilities CSV, candidates CSV, mitigation CSV and dossier JSON in each mode using real browser clicks and Playwright download events. Save each downloaded file and read it from disk. No Blob interception, synthetic download replacement or button-only success assertion.
5. Parse the files using Python standard-library csv and json, with assertions. All eight downloads succeeded with download.failure() null.

File pattern: ecosite-{demo|api}-pune-2026-10-27-{facilities.csv|candidates.csv|mitigation.csv|dossier.json}. Per mode: 3 facility rows, 1 candidate row, 1 mitigation row. CSVs have UTF-8 BOM and quoted fields; the comma/quotes round-trip exactly. JSON schemaVersion is 2 with the matching dataMode, candidate and plan. No opposite-mode candidate or plan appears. Candidate suitability remains null in JSON and Unavailable in CSV. Demo candidate status is synthetic; API candidate status is unavailable. Backend seed facilities are synthetic in both retrieval paths and retain that explicit provenance. JSON environmental state is DEMO_SYNTHETIC or API_UNAVAILABLE as appropriate; limitations explicitly deny automatic API verification.

Download sizes, in bytes:

| Mode | Facilities CSV | Candidates CSV | Mitigation CSV | Dossier JSON |
|---|---:|---:|---:|---:|
| Demo | 759 | 357 | 441 | 7303 |
| API | 756 | 352 | 439 | 7638 |

## Browser/tool limitations

Integrated VS Code Electron 43 / Chromium 150 did not emit a download event or create a file, even with a fresh BrowserContext and an explicit CDP download path. Standalone Chrome downloaded the same exports successfully, so no application export defect was established.

An isolated headed Chrome profile was opened and the report Print button invoked. The automation call did not return; native preview was not inspected. Computer Use then stopped because it could not determine the current browser URL confidently enough to enforce policy. Native UI interaction stopped. **Print-preview opening and printed report content/layout readability are NOT VERIFIED**; neither DOM inspection nor mocked window.print tests are counted as native-preview verification.

Remaining manual check: open Reports with a saved candidate and plan in each mode, click Print, inspect every page for readable tables, complete content, mode/limitations labels, no clipped columns and hidden navigation/actions; cancel without printing.

## Validation

Executed sequentially, all exit code 0:

- npm --prefix frontend run lint -- --no-cache
- npm --prefix frontend run test — 116/116 tests, 13 files; includes existing CSV escaping/formula protection and context/export tests. No new tests because no application fix was made.
- npm --prefix frontend run build — TypeScript and Vite passed; existing >500 kB bundle warning remains.
- backend\.venv\Scripts\python.exe -m unittest discover -s backend/tests -v — 17/17 passed.
- git diff --check — passed; existing CRLF normalization notices only.

Normal backend/data/ecosite.db SHA-256 before and after: 669505be79419bd771ff2c2ccae1b1fbfa1b1a8aeaec8996571e157f00a9697a. No schema, secrets, storage-contract, feature or dependency changes. No staging, commits, resets or cleaning; inaccessible .pytest_cache untouched. Only this verification report was added in Phase 01D.2.
