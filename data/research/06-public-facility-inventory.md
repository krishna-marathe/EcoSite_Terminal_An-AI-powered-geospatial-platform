# Public Facility Inventory - Research Pass 1

Last researched: 2026-10-29

## Purpose and inclusion rule

This is a research candidate list, not yet the production seed dataset. Include
a facility only when a primary operator or government source publicly confirms
its existence, current operational status and a usable locality/city. Ownership
does not affect inclusion. Only `OPERATIONAL` records qualify for the public
dashboard.

Publication verification is valid for 90 days. The source may be older than 90
days if it is a current credible facility page that a reviewer
accessed and verified during the 90-day window. A historic announcement alone
does not satisfy current-operation verification.

Statuses must be kept separate:

- `OPERATIONAL` - the source explicitly says live, operational or gives an
  operational-since date.
- `UNDER_CONSTRUCTION` - research-only; never publish in the current dashboard.
- `PROPOSED` - research-only; never publish in the current dashboard.
- `STATUS_REVIEW_REQUIRED` - a current primary source confirms the facility but
  does not clearly establish its operational state.

Do not convert total power to IT load. Do not split a campus total among
buildings. Do not sum MW fields whose measurement boundaries differ.

## Maharashtra candidates

| Facility/campus | Operator | Public locality | Status supported by source | Public capacity statement | Primary source |
|---|---|---|---|---|---|
| MUM-1 | Iron Mountain | Navi Mumbai | Operational since 2015 | 2.3 MW total power | https://www.ironmountain.com/en-in/data-centers/locations/apac/mumbai |
| MUM-2 | Iron Mountain | Navi Mumbai | Operational/opened February 2023 | 6 MW IT load | https://www.ironmountain.com/en-in/data-centers/locations/apac/mumbai |
| Mumbai DC1 & DC2 | CtrlS | Navi Mumbai | Existing/operator footprint | 40 MW power capacity combined | https://www.ctrls.com/datacenter-mumbai/ |
| Mumbai DC3 | CtrlS | Navi Mumbai | Existing/operator footprint | 10 MW power capacity | https://www.ctrls.com/datacenter-mumbai/ |
| Mumbai DC4 | CtrlS | Navi Mumbai | Existing/operator footprint | 36.8 MW power capacity | https://www.ctrls.com/datacenter-mumbai/ |
| Mumbai DC5 | CtrlS | Navi Mumbai | Existing/operator footprint | 32 MW power capacity | https://www.ctrls.com/datacenter-mumbai/ |
| STT Mumbai DC2 | STT GDC India | Chakala, Andheri East, Mumbai | Operational since 2006 | 1.7 MW IT load | https://assets.sttelemediagdc.com/sttgdc/global_en/public/2023-11/Mumbai%20Factsheet%202_0.pdf |
| STT Pune 5 | STT GDC India | Pune | Inaugurated 3 August 2025 | 24 MW (operator newsletter context) | https://assets.sttelemediagdc.com/sttgdc/global_en/public/2026-05/STT-Newsletter-INFRAINTEL.pdf |

Research note: CtrlS publishes Mumbai DC1 and DC2 as one combined entry, so the
registry should initially treat it as a combined public campus/facility record
unless a primary source supplies separate capacity boundaries.

## Telangana candidates

| Facility/campus | Operator | Public locality | Status supported by source | Public capacity statement | Primary source |
|---|---|---|---|---|---|
| STT Hyderabad 1 | STT GDC India | HITEC City/Madhapur, Hyderabad | Operational since 2007 | 4 MW IT load | https://www.sttelemediagdc.com/in-en/locations/hyderabad |
| Hyderabad DC1 | CtrlS | Hyderabad | Existing/operator footprint | 6 MW power capacity | https://www.ctrls.com/ |
| Hyderabad DC2 | CtrlS | Hyderabad | Existing/operator footprint | 7.4 MW power capacity | https://www.ctrls.com/ |
| Hyderabad DC3 | CtrlS | Hyderabad | Live | 13 MW power capacity | https://www.ctrls.com/ai-ready-datacenter-infrastructure/ |

Items not counted as existing:

- TCS HyperVault Hyderabad: land secured for a phased campus of up to 1 GW;
  record as `PROPOSED`, not operational.
  Source: https://www.tcs.com/who-we-are/newsroom/press-release/tcs-hypervault-establish-large-scale-ai-data-center-campus-telangana
- CtrlS Chandan Valley campus: operator labels it upcoming; record as
  `PROPOSED`/`UNDER_CONSTRUCTION` only after the specific source language is
  reviewed. Source: https://www.ctrls.com/

These pipeline items are retained only as research exclusions and will not be
sent to the public API.

## Karnataka candidates

| Facility/campus | Operator | Public locality | Status supported by source | Public capacity statement | Primary source |
|---|---|---|---|---|---|
| Bangalore DC1 | CtrlS | Bengaluru | Existing/operator footprint | 13 MW power capacity | https://www.ctrls.com/ |
| Bengaluru 2 | NTT Global Data Centers | Bengaluru | Listed as current India location | Not stated on location index | https://services.global.ntt/en-au/services-and-products/global-data-centers/global-locations/india |
| Bengaluru 3 | NTT Global Data Centers | Bengaluru | Listed as current India location | Not stated on location index | https://services.global.ntt/en-au/services-and-products/global-data-centers/global-locations/india |

Research note: NTT also lists Bengaluru 4, but the index page alone does not
establish whether it is operational. Keep it out of operational totals until a
facility page or announcement confirms status. STT states three Bengaluru data
centres and 23 MW city capacity in corporate material, but individual facility
identity/status must be verified before seeding separate records.

## Tamil Nadu candidates

| Facility/campus | Operator | Public locality | Status supported by source | Public capacity statement | Primary source |
|---|---|---|---|---|---|
| Chennai 1 | AdaniConneX | SIPCOT IT Park, Siruseri | Phase 1 live | 17 MW IT load live; 33 MW full capacity | https://www.adanienterprises.com/digital-reports/enterprises/2026/data-center.html |
| STT Chennai 2 | STT GDC India | Ambattur, Chennai | Production/operational description | More than 20 MW design IT load | https://assets.sttelemediagdc.com/sttgdc/global_en/public/2024-02/STT-Chennai-DC2_2_0.pdf |
| STT Chennai 7 | STT GDC India | SIPCOT IT Park, Siruseri | First phase operational/launched February 2026 | 7.2 MW IT load | https://www.sttgdc.com/in-en/newsroom/stt-gdc-india-strengthens-market-presence-chennai-multi-campus-expansion-and-inr-4200 |
| Chennai Datacenter Park | CtrlS | Ambattur Industrial Estate, Chennai | Launched February 2025 | 72 MW IT-load campus design | https://www.ctrls.com/ctrls-powers-indias-digital-revolution-new-chennai-datacenter-park-backed-by-rs-4000-crore-direct-and-rs-50000-crore-indirect-investment/ |

Items requiring status review:

- Iron Mountain CHN-1/CHN-2: the operator describes phased rollout beginning in
  2026 and 2028. Do not mark CHN-1 operational without an explicit opened/live
  source. Source: https://www.ironmountain.com/data-centers/locations/apac/chennai
- CapitaLand Chennai/Ambattur: the operator describes development, so it belongs
  in pipeline tracking until commissioning is confirmed.
  Source: https://www.capitaland.com/in/en/lease/data-centres.html

Status-review records are excluded from the public API until operational status
is explicitly verified.

## Cross-source findings

1. Operator pages are strong sources for public disclosure but remain operator
   claims; use evidence class `PUBLIC_OPERATOR`, not `GOVERNMENT_VERIFIED`.
2. City/campus totals often include buildings under construction. Never infer
   that the entire published city capacity is operational.
3. Names change following acquisitions. Store aliases and source-effective dates.
4. Capacity needs `value`, `unit`, `capacity_type`, `scope` and `lifecycle_status`.
5. Exact street addresses sometimes appear in factsheets. The public map should
   still use separately generated generalised geometry under the agreed policy.
6. Reputable directories and media may support publication after source review,
   but their source class and confidence must remain visible internally.

## Required second-pass work

- Verify additional operator facilities from Nxtra, NTT, Sify, Yotta, PDG,
  Equinix, Digital Realty, Pi, Web Werks/Iron Mountain and STT.
- Resolve facility-level records hidden behind city-level operator totals.
- Search government inauguration/approval releases as corroborating evidence.
- Capture retrieval time, source title, publisher and archived source hash.
- Assign `verified_at` and `verification_expires_at` (90 days) to every
  publishable operational record.
- Deduplicate campus/building aliases before creating seed data.

