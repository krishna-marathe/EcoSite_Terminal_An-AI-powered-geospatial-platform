# Authoritative Data Sources and Integration Research

Last checked: 2026-10-29. URLs and policy validity must be revalidated during
implementation. A source being listed does not mean its licence permits caching
or redistribution.

## National policy and standards

| Source | Intended use | Access/update | Important limitation |
|---|---|---|---|
| NITI Aayog Data Centre Evaluation Framework | National evaluation model and minimum approval evidence | Official page/PDF; versioned | Decision-support framework, not a replacement for law |
| BEE data-centre efficiency guidance | Electrical, cooling and O&M efficiency | Official PDF; static | Older guidance; metrics must use current BIS boundaries |
| BIS NBC and IS/ISO/IEC 22237 family | Building, facility and infrastructure standards | Licensed standards/official metadata | Full standards may require licensed access |
| PARIVESH/MoEFCC | EC, forest, wildlife and CRZ workflow/status | Portal/API agreement/event driven | Clearance applicability is project-specific |
| CPCB/SPCB | Consent, air, waste and pollution compliance | Portal/authority integration | Station data is not a site measurement unless representative |

Primary links:

- https://www.niti.gov.in/node/2443
- https://beeindia.gov.in/sites/default/files/datacenterbook.pdf
- https://www.bis.gov.in/standards/national-building-code/?lang=en
- https://standards.bis.gov.in/
- https://parivesh.nic.in/

## Environmental and geospatial sources

| Domain | Preferred source | Proposed refresh | Use |
|---|---|---|---|
| Weather/warnings | IMD API | Hourly/event driven | Heat, rain, wind, humidity, warnings |
| Air quality | CPCB CAAQMS/SPCB | Hourly | Ambient context and alerts |
| Land use/flood/water bodies | NRSC Bhuvan WMS/thematic data | Release/event based | Screening and change context |
| Flood early warning | National Hydrology Project/Bhuvan and state authorities | Event driven | Flood advisory and scenarios |
| Groundwater | CGWB assessment and NWDP | Annual/station dependent | Assessment category and trend |
| Protected areas/ESZ/ESA | MoEFCC and state forest/wildlife authorities | Notification driven | Legal screening constraints |
| Surface-water history | JRC Global Surface Water | Version release | Corroborating historical occurrence only |
| Satellite scenes | Copernicus Sentinel-2 STAC | Days | Scene discovery/change analysis after pixel processing |
| Terrain | SRTM/Copernicus DEM plus official surveys | Static/versioned | Screening elevation/slope, not engineering survey |

Primary links:

- IMD APIs: https://api.imd.gov.in/public/api_reference.html
- CPCB: https://app.cpcbccr.com/
- Bhuvan thematic layers: https://bhuvan.nrsc.gov.in/wiki/index.php/Thematic_Data
- Bhuvan WMS guidance: https://bhuvan.nrsc.gov.in/wiki/index.php/How_to_use_WMS_services
- NHP flood GIS: https://bhuvan.nrsc.gov.in/nhp/webgis-flood/map
- MoEFCC ESZ: https://moef.gov.in/esz-notifications
- MoEFCC ESA: https://moef.gov.in/esa-notifications

## Utility and operator integrations

These generally require ministry agreements rather than public-web scraping.

- DISCOM/STU: sanctioned load, feeder/substation capacity, outage and
  augmentation milestones.
- Water authority/ULB/industrial authority: allocations, meter readings,
  treated-water capacity and sewer capacity.
- Data-centre operator: facility meters, PUE/WUE/CUE inputs, incidents,
  expansion phases and compliance evidence.
- Pollution control board: CTE/CTO, continuous emissions/effluent data,
  inspections and notices.
- Fire/electrical/building authorities: approval and inspection status.

No public proxy or inferred proximity metric should be labelled as verified
capacity.

## Operational publication freshness

Every publicly displayed facility must have an operational-status verification
performed within the preceding 90 days. The verification records the reviewer,
retrieval time, credible source, source excerpt/fact, and source snapshot hash
where lawful. Expired records are withheld from the public API until rechecked.
An expiry means `STALE_REVIEW_REQUIRED`, not `CLOSED`.

## Credible-source hierarchy - decided

| Tier | Source class | Publication use |
|---|---|---|
| A | Government, regulator, statutory authority or official public filing | Highest-confidence evidence; supports `GOVERNMENT_VERIFIED` only when the authority verifies the specific claim |
| B | Official operator page, annual report, exchange filing or certification body | May support `PUBLIC_OPERATOR_CONFIRMED` or a certified claim |
| C | Established national/business news organisation or reputable specialist publication with named sources | May support publication after reviewer checks identity, date, location and operational wording |
| D | Commercial directory with transparent sourcing and current review date | Discovery/corroboration; publish only after reviewing its underlying evidence |
| E | Anonymous posts, social media, map labels, scraped aggregators or unsourced lists | Never sufficient for publication |

Credibility checks require a named publisher, reachable URL, retrieval or
publication date, explicit operational wording, sufficient identity for
deduplication, no unresolved higher-tier contradiction, preserved capacity
scope, and a named reviewer with a 90-day expiry.

When credible sources conflict, withhold the disputed field or facility until
review. A higher-tier source does not automatically resolve different dates or
campus phases without examining the underlying claims.

## State-policy status

### Maharashtra

The Maharashtra IT/ITeS Policy 2023 includes data centres, infrastructure
support, green power and a single-window mechanism. Policy and incentive
validity must be read from the current notification rather than copied from a
summary.

- https://industry.maharashtra.gov.in/sites/default/files/2025-09/it-policy-booklet_1_11zon.pdf
- https://midc.maharashtra.gov.in/en/investors/industrial-policies-and-incentives/

### Telangana

Official investment material identifies live and committed capacity, proposed
data-centre corridors, power infrastructure and planned treated-water supply.
These are promotional/planning claims until backed by authority records. A
next-generation data-centre policy is described as underway, so the platform
must version policy rules.

- https://invest.telangana.gov.in/sectors/data-centres/
- https://invest.telangana.gov.in/policies/

### Karnataka

The repository contains the Karnataka Data Centre Policy 2022-2027 and
operational guidelines. Current validity and amendments must be checked against
the Karnataka E&IT department before using incentive or threshold rules.

- https://www.registration.eitbt.karnataka.gov.in/KarnatakaReg_Web/public/index.php/LandingPage/policies_schemes

### Tamil Nadu

The official policy page says the 2021 policy applied through 31 March 2026.
Until an extension or replacement is verified, the system must mark it
expired/under review rather than active.

- https://it.tn.gov.in/en/Tamil_Nadu_Data_Centre_Policy_2021
- https://www.karuvoolam.tn.gov.in/documents/45087/23785221/TN_Data_Centre_Policy_2021.pdf/4a0fd1d0-27ff-8213-8def-01ecf55fbe77

## Integration priority

1. Existing repository boundaries, project polygons and source registry.
2. IMD official weather/warning API.
3. Existing JRC, Copernicus and CGWB connector outputs.
4. Bhuvan layers after service/licence verification.
5. Operator telemetry through a simulated contract first, then secure feeds.
6. Utility, PARIVESH, CPCB/SPCB and state-authority integrations after formal
   access agreements.

