# Public Facility Inventory Gap Audit - Research Pass 2

Last researched: 2026-10-29

## Scope and method

This pass checks the 19-record prototype registry against current operator
disclosures for operating data centres in Maharashtra, Telangana, Karnataka and
Tamil Nadu. It does **not** alter the public registry. Every item below must pass
normalisation, alias/deduplication and a ministry publication review before it
can become an approved snapshot.

Source priority was current operator facility pages, operator factsheets and
reports, then explicit operator opening releases. An operator footprint page
can establish a candidate, but a city or campus total must not be split across
buildings. Planned/full-build capacity is not live capacity. Exact addresses
found in source material remain restricted; this file records only generalised
localities.

## Executive finding

The 19-record seed is **not a near-complete census**. It covers only CtrlS, STT,
Iron Mountain, NTT (two Bengaluru entries) and AdaniConneX. Current primary
material confirms substantial operating footprints from Equinix, Sify, Nxtra,
Yotta and Digital Connexion, plus many omitted NTT and STT facilities. The
dashboard must continue to label the registry as a prototype inventory.

The strongest facility-level evidence below identifies 25 distinct candidates
absent from the current seed. This is a lower bound, not a final total.

## Strong primary-evidence candidate queue

These candidates are supported by current primary/operator material. They are
not automatically approved public records.

| State | Facility/campus candidate | Operator | Generalised locality | Operating evidence | Capacity treatment | Primary source retrieved 2026-10-29 |
|---|---|---|---|---|---|---|
| Maharashtra | Yotta NM1 | Yotta | Panvel, Navi Mumbai | Current operator page labels NM1 live; operator recorded its 2020 inauguration | Operator documents conflict between 46 MW IT, 52 MW IT and 50 MW power. Reconcile scope/effective date before publishing capacity | https://yotta.com/data-center-in-india/ ; https://yotta.com/press-releases/yotta-infrastructure-inaugurates-asias-largest-and-worlds-second-largest-uptime-institute-tier-iv-certified-data-center-yotta-nm1-at-navi-mumbai/ ; https://www.yotta.com/wp-content/uploads/2024/01/Yotta-Data-Centers.pdf |
| Maharashtra | Equinix MB1 | Equinix | Mumbai | Current India/Mumbai catalogue lists it among four Mumbai sites | No MW value found; do not infer | https://www.equinix.com/data-centers/asia-pacific-colocation/india-colocation/mumbai-data-centers |
| Maharashtra | Equinix MB2 | Equinix | Mumbai | Current operator catalogue | No MW value found | https://www.equinix.com/data-centers/asia-pacific-colocation/india-colocation/mumbai-data-centers |
| Maharashtra | Equinix MB3 | Equinix | Chandivali/Powai, Mumbai | Operator opening release dated 8 April 2026 | Cabinet counts are not MW | https://newsroom.equinix.com/2026-04-08-Equinix-Launches-Purpose-Built-IBX-Data-Center-in-Mumbai-to-Accelerate-Indias-AI-and-Cloud-Growth |
| Maharashtra | Equinix MB4 | Equinix | Mumbai | Current operator catalogue | 700 cabinets is a full two-phase total, not live MW | https://www.equinix.com/data-centers/asia-pacific-colocation/india-colocation/mumbai-data-centers |
| Maharashtra | Sify Mumbai 01 Vashi | Sify | Vashi, Navi Mumbai | Operator annual report: operational since 2000 | 0.9 MW IT in annual report; newer brochure says 0.38 MW. Reconcile | https://www.sifytechnologies.com/investors/wp-content/uploads/2025/07/Sify_Infinit_Spaces-AR_web_ready-2024-25_Single.pdf ; https://www.sifytechnologies.com/wp-content/uploads/2026/02/Sify_DC_Brochure_13Feb.pdf |
| Maharashtra | Sify Mumbai 02 Airoli | Sify | Airoli, Navi Mumbai | Operator annual report: operational since 2008 | 5.4 MW IT in annual report/current page; another brochure says 4.05 MW. Reconcile | https://www.sifytechnologies.com/investors/wp-content/uploads/2025/07/Sify_Infinit_Spaces-AR_web_ready-2024-25_Single.pdf ; https://www.sifytechnologies.com/data-center/mumbai-data-center/ |
| Maharashtra | Sify Mumbai 03 Rabale campus | Sify | Rabale, Navi Mumbai | Operator says five towers currently operational; campus operational since 2013 | Never publish the 240/377+ MW eventual campus design as live capacity | https://www.sifytechnologies.com/us/data-center/colocation-services/ ; https://www.sifytechnologies.com/investors/wp-content/uploads/2025/07/Sify_Infinit_Spaces-AR_web_ready-2024-25_Single.pdf |
| Maharashtra | NTT Mumbai 5 | NTT Global Data Centers | Mumbai | Current operator catalogue | Capacity not established | https://services.global.ntt/en-us/services-and-products/global-data-centers/global-locations/india/mumbai-data-centers |
| Maharashtra | NTT Mumbai 6 | NTT Global Data Centers | Mumbai | Current operator catalogue | Capacity not established | https://services.global.ntt/en-us/services-and-products/global-data-centers/global-locations/india/mumbai-data-centers |
| Maharashtra | NTT Mumbai 7 | NTT Global Data Centers | Chandivali, Mumbai | Current catalogue and operator release explicitly say operational | 100 MW is combined Mumbai hub load, not Mumbai 7 alone | https://services.global.ntt/en-us/newsroom/ntt-ltd-expands-its-hyperscale-data-center-footprint-in-india |
| Maharashtra | NTT Mumbai BSE | NTT Global Data Centers | Mumbai | Current operator catalogue | Capacity not established | https://services.global.ntt/en-us/services-and-products/global-data-centers/global-locations/india/mumbai-data-centers |
| Maharashtra | NTT Mumbai Vikhroli | NTT Global Data Centers | Vikhroli, Mumbai | Current operator catalogue | Capacity not established | https://services.global.ntt/en-us/services-and-products/global-data-centers/global-locations/india/mumbai-data-centers |
| Maharashtra | NTT Mumbai Vikhroli IV | NTT Global Data Centers | Vikhroli, Mumbai | Current operator catalogue | Capacity not established | https://services.global.ntt/en-us/services-and-products/global-data-centers/global-locations/india/mumbai-data-centers |
| Maharashtra | NTT Navi Mumbai 1A | NTT Global Data Centers | Navi Mumbai | Current catalogue and facility brochure | 30 MW IT facility disclosure | https://services.global.ntt/-/media/ntt/global/services-and-products/data-centers/global-locations/india/navi-mumbai-data-center/nav1-data-center-final.pdf |
| Maharashtra | STT Mumbai 1 | STT GDC India | Prabhadevi, Mumbai | Operator factsheet: operational/RFS since 2001 | 4.8 MW IT load | https://assets.sttelemediagdc.com/sttgdc/global_en/public/2025-05/stt-gdc-india-mumbai-factsheet-1.pdf |
| Telangana | Nxtra HYD 1 | Nxtra by Airtel | Kokapet, Hyderabad | Current operator facility page offers tours and active colocation | 10 MW IT power | https://www.nxtra.in/data-center-hyderabad |
| Telangana | Sify Hyderabad 01 | Sify | Financial District, Hyderabad | Operator brochure: operational since 2019 | 14.4 MW IT power | https://www.sifytechnologies.com/wp-content/uploads/2026/02/Sify_DC_Brochure_13Feb.pdf |
| Karnataka | Sify Bengaluru 01 | Sify | Electronic City, Bengaluru | Operator annual report identifies operational facility | Source conflict: 7.6 MW IT versus 4.82 MW in newer brochure. Reconcile | https://www.sifytechnologies.com/investors/wp-content/uploads/2025/07/Sify_Infinit_Spaces-AR_web_ready-2024-25_Single.pdf ; https://www.sifytechnologies.com/wp-content/uploads/2026/02/Sify_DC_Brochure_13Feb.pdf |
| Tamil Nadu | Equinix CN1 | Equinix | Chennai IT corridor | Current operator India catalogue says CN1 opened | Cabinet/area disclosures are not MW | https://www.equinix.com/data-centers/asia-pacific-colocation/india-colocation |
| Tamil Nadu | Digital Connexion MAA10 phase 1 | Digital Connexion | Ambattur, Chennai | Operator release says first phase launched | 20 MW IT phase 1; 100 MW is campus capability | https://digitalconnexion.com/resources/media/digital-connexion-makes-foray-into-india |
| Tamil Nadu | NTT Chennai 1 | NTT Global Data Centers | Chennai | Current operator India catalogue | Capacity not established | https://services.global.ntt/en-au/services-and-products/global-data-centers/global-locations/india |
| Tamil Nadu | NTT Chennai 2A | NTT Global Data Centers | Ambattur, Chennai | Current facility page markets service and says 2A operational from April 2023 | 17.4 MW maximum IT load for building A; keep B/full-campus separate | https://services.global.ntt/en-us/services-and-products/global-data-centers/global-locations/india/chennai-2-data-center |
| Tamil Nadu | Sify Chennai 01 | Sify | TIDEL Park, Chennai | Operator annual report/brochure: operational since 2000/2001 | 3.6 MW IT; newer brochure says 3.58 MW | https://www.sifytechnologies.com/investors/wp-content/uploads/2025/07/Sify_Infinit_Spaces-AR_web_ready-2024-25_Single.pdf |
| Tamil Nadu | Sify Chennai 02 Tower B | Sify | Siruseri, Chennai | Operator brochure says Tower B operational in 2024 | 25.92 MW IT; do not use 78/130+ MW full-campus design | https://www.sifytechnologies.com/wp-content/uploads/2026/02/Sify_DC_Brochure_13Feb.pdf |

## Footprints requiring facility-level resolution

| Operator | Current disclosed footprint | Why not bulk import | Source retrieved 2026-10-29 |
|---|---|---|---|
| Nxtra | Pune PUN 2/3/4; Bengaluru BLR 1/2/3; four Chennai sites; Mumbai MUM 1; Hyderabad HYD 1 | Individual operational dates and capacity boundaries are incomplete; HYD 1 is specific enough for the queue above | https://www.nxtra.in/ ; https://www.nxtra.in/data-center-chennai ; https://www.nxtra.in/data-center-mumbai |
| STT GDC India | ESG report shows Mumbai 6, Pune 5, Bengaluru 3, Hyderabad 1 and Chennai 5 | Totals explicitly include construction. Separate facility identities/lifecycle states; never treat ~400 MW as all live | https://assets.sttelemediagdc.com/sttgdc/global_en/public/2026-03/STT-GDC-India-ESG-Report-FY2025.pdf |
| Iron Mountain / Web Werks | Six data centres/14 MW across Mumbai, Bengaluru, Hyderabad, Pune and Noida; tour page exposes MUM-1/2, BLR-1, PUN-1, HYD-1 | MUM-1/2 appear to alias seeded Iron Mountain records. Resolve BLR/PUN/HYD ownership/name aliases | https://www.webwerks.in/imdc-faqs ; https://www.webwerks.in/book-data-center-tour |
| Sify | Current material reports 14 operating data centres and 188 MW in India | Rabale has multiple live towers but is marketed as one campus; keep campus granularity unless tower boundaries are disclosed | https://www.sifytechnologies.com/wp-content/uploads/2026/02/Sify_DC_Brochure_13Feb.pdf |

## Excluded/status-review leads

| Candidate | State | Finding and decision | Source |
|---|---|---|---|
| PDG MU1 | Maharashtra | Likely operating, but reconcile 125/150 MW and obtain explicit current operating statement before publication | https://princetondg.com/where-we-operate/ ; https://princetondg.com/wp-content/uploads/2024/07/ESG-Report-2023-24.pdf |
| PDG MU2 | Maharashtra | Current page calls it planned; exclude | https://princetondg.com/where-we-operate/ |
| PDG HY1 | Telangana | Campus/design described but not live; exclude pending opening evidence | https://princetondg.com/where-we-operate/ |
| PDG CH1 | Tamil Nadu | Planned three-building campus; exclude | https://princetondg.com/where-we-operate/ |
| NTT Bengaluru 4A/4B/4C | Karnataka | 67.2 MW page calls capacity planned and gives no operational date; keep in review | https://services.global.ntt/en-us/services-and-products/global-data-centers/global-locations/india/bengaluru-4-campus |
| Yotta Chennai park | Tamil Nadu | Older page advertised 2025 go-live, but current live-facility page does not establish Chennai operation; exclude | https://colocation.yotta.com/data-center ; https://yotta.com/data-center-in-india/ |
| Digital Connexion Mumbai | Maharashtra | Operator says building a 40 MW facility; exclude as under construction | https://digitalconnexion.com/resources/media/digital-connexion-makes-foray-into-india |

## Existing 19-record corrections/review flags

1. **STT Pune 5:** the seed stores 24 MW as `power_capacity_unspecified`;
   the operator factsheet explicitly calls it 24 MW IT load.
2. **STT Chennai 2:** the seed stores 20 MW `design_minimum`; the reviewed
   operator factsheet states 45 MW IT load and operational since 2010. Review
   effective date before publishing a replacement snapshot.
3. **CtrlS Chennai:** 72 MW is `campus_design`; never aggregate or describe it
   as current live IT load without phase commissioning evidence.
4. **NTT Bengaluru 2/3:** keeping capacity empty is correct because the reviewed
   current index does not disclose a facility capacity.
5. **STT factsheets:** first-party operator material must not be described as
   independent reporting or government verification.
6. **CtrlS homepage evidence:** Hyderabad DC1/DC2 and Bengaluru DC1 need stable
   facility-specific URLs or archived evidence before the next revalidation.

## Required collection and promotion pipeline

Every discovery should enter a private candidate record with canonical operator
and facility name, aliases, lifecycle claim, generalised location, capacity
value/unit/type/boundary, source metadata, retrieval timestamp, content hash or
archive reference, conflict notes, reviewer decision and duplicate-of link.

A candidate may become a public operating snapshot only when:

1. a current primary source supports an operating/live facility;
2. aliases have been checked against all existing snapshots;
3. campus/building/phase granularity is explicit;
4. capacity is omitted when its live boundary is ambiguous;
5. public geometry is separately generalised; and
6. a reviewer records verification and a maximum 90-day expiry.

Recommended batches:

1. Yotta NM1, Equinix MB1/2/3/4/CN1, Digital Connexion MAA10 and the seven
   named Sify facilities.
2. NTT Mumbai/Chennai facility pages and capacity factsheets.
3. Nxtra and STT facility factsheets, separating live and construction.
4. Web Werks/Iron Mountain alias reconciliation and PDG MU1 status.

No collection batch should write directly to approved snapshot tables.
