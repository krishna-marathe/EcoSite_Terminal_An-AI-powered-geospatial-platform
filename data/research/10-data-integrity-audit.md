# Document Manifest and Raw Snapshot Integrity Audit

Last audited: 2026-10-29

## Official documents

The official-document directory contains 12 files and the manifest now contains
12 unique entries with exact filename coverage.

Corrections completed:

- corrected the NITI Aayog framework SHA-256 to
  `50702d2adcfaa1e03de9210d6831904c25515f2c826058d3dee6a0ef62b97ed8`;
- added the separate 72-page Uttar Pradesh Data Centre Policy 2026 operational
  guidelines record;
- recorded its size as 4,161,103 bytes and SHA-256 as
  `48b9467b50b3e668d0c397fcf47f8615b9669ad580366a7dcf49d76e585824d2`;
- retained the UP policy notification and operational guidelines as separate
  versioned evidence records; and
- verified the byte size and SHA-256 of every declared document.

Automated coverage lives in
`backend/tests/test_document_manifest_integrity.py`.

## Raw connector snapshots

The database stores SHA-256 hashes of the uncompressed provider payload, while
files under `backend/data/raw` are gzip containers. An audit must therefore
decompress each file before comparing it with `raw_snapshots.sha256`; comparing
only the gzip-file hash would be incorrect.

Audit result at the time above:

| Classification | Count |
|---|---:|
| Valid gzip files | 113 |
| Database snapshot rows | 3 |
| Exact stored path and payload-hash matches | 3 |
| Invalid gzip files | 0 |
| Database path repairs required | 0 |
| Unlinked/orphan files retained for review | 110 |

Unlinked files by source directory:

| Source | Count |
|---|---:|
| `cgwb_assessment` | 30 |
| `copernicus_stac` | 34 |
| `jrc_gsw` | 46 |

Some unlinked files have the same uncompressed payload hash as a referenced
snapshot. They remain unlinked because only the exact path recorded by the
database is the referenced artifact. No file was deleted, moved or renamed.

The reproducible audit and guarded repair tool is
`backend/scripts/audit_raw_snapshots.py`. It is read-only by default. Its
optional `--repair-db` mode changes a database path only when exactly one file
has the stored payload hash. Ambiguous matches are never repaired.

No live database repair is required from this audit. The 110 unlinked files
need a separate retention/indexing decision after active connector/test writers
are isolated and a backup is verified.

