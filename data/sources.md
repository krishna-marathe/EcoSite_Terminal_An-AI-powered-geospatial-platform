EcoSite India — Data Centre MVP Feasibility Blueprint v1
Deep Research Report | India-wide Data Source and Technical Feasibility Audit | Research date: 26 October 2026
Executive finding and final problem definition
Feasibility verdict
Proceed with the data-centre-only EcoSite MVP, but change the product from a generic environmental “risk scoring” dashboard into an India-wide, evidence-aware site-readiness system.
The research supports an India-wide architecture because national and global sources can provide meaningful baseline evidence for satellite imagery, land-cover change, terrain, historical surface water, groundwater context, weather, air quality and some infrastructure context. However, there is no single public dataset or API that can reliably tell EcoSite the spare electrical headroom at a specific substation, the quantity of water a utility will commit to a project, or the legal development status of every parcel in India. Those facts must come from utilities, authorities and project documentation. [1]
That limitation is not a weakness in the EcoSite idea. In fact, NITI Aayog's new Data Centre Evaluation Framework, published on 14 October 2026, directly supports the hybrid model we have been developing: evaluate the full campus, validate power and water readiness, examine environmental and community conditions, link resource availability to commissioning milestones, and maintain clear responsibility for evidence. NITI explicitly says its framework is for decision support rather than creation of another regulatory layer. [2]
The 66-page regulatory research we completed earlier reached the same conclusion independently: EcoSite's strongest role is a pre-decision intelligence and evidence-reconciliation layer connecting developer requirements, utility/government evidence and location-specific environmental conditions before a site becomes expensive to change. fileciteturn0file0
Final data-centre-only problem statement
India's rapid data-centre expansion creates large, long-term requirements for electricity, water, land, connectivity and supporting infrastructure, while the information needed to establish whether a particular site can support the complete planned campus is distributed across developers, utilities, planning authorities, environmental systems and geospatial datasets.
EcoSite India will help data-centre developers and public-sector decision-makers compare candidate sites before major commitments are made by reconciling full-campus, phase-wise resource requirements with evidence-backed power and water readiness, location-specific environmental and climate constraints, applicable regulatory considerations and explicit evidence gaps.
EcoSite will not issue statutory approvals or claim that satellite observations prove utility capacity or legal compliance. Instead, it will show what is observed, what is declared, what is documented, what has actually been verified, what conflicts, what remains unknown, and what must occur before each development phase can responsibly proceed.
This problem statement is closely aligned with NITI's recommendation that states assess infrastructure availability and resource requirements before committing support, obtain a joint developer/DISCOM/STU Power Readiness and Ramp-up Plan, consider 20–30-year water balances and maintain site-readiness records covering 10–15-year expansion headroom. [3]
Product scope should be India-wide, not Pune-wide
I agree with your decision not to make Pune the product boundary.
EcoSite should have three geographical layers:
Layer	What EcoSite can reasonably promise
National baseline	Satellite/environmental screening, national datasets, project inputs and national regulatory context anywhere in India where the source data has coverage
State rule pack	Data-centre policy, relevant state institutions, electricity/water arrangements, state pollution/fire/planning context and state-specific processes
Local verified layer	Planning/zoning confirmation, DISCOM/STU evidence, water allocation, local infrastructure commitments and other site-specific authority records
This architecture follows directly from the earlier regulatory research, which found that the correct rules hierarchy is Country → State → District/ULB/Planning Authority → Project Type → Capacity → Location trigger, rather than one universal India-wide approval checklist. fileciteturn0file0
NITI likewise recommends that states publish state-wise Data Centre Approval Matrices covering the applicable approval/NOC, issuing authority, applicability, processing time, dependencies and documents, while assigning responsibility to the relevant departments and utilities. [4]
Target users
The primary users should be:
Developer / operator side: data-centre site-selection teams, infrastructure engineering teams, sustainability/EHS teams, project leadership and investment committees.
Government side: state data-centre/investment facilitation teams and authorized reviewers evaluating whether proposed investments can be supported by local infrastructure and resources.
The secondary users should be DISCOM/STU teams, water authorities, planning authorities, environmental consultants and other specialist reviewers.
I would not make the unrestricted public/citizen interface the primary MVP. NITI itself recommends publishing non-sensitive information while withholding sensitive network, resilience, customer and proprietary operating information. A future public transparency view can expose appropriate environmental findings without publishing confidential grid architecture or project engineering records. [4]
The actual EcoSite question
The product should answer:
“For the complete proposed data-centre campus and every planned development phase, what resources are required, what resources are demonstrably available, which environmental and planning constraints affect the location, what evidence supports each conclusion, what remains unresolved, and would another candidate site create fewer readiness gaps?”
That is considerably stronger than:
“This site has an environmental score of 82/100.”
The new NITI framework itself emphasizes full-campus load, future expansion, cumulative network demand, peak-summer water demand, climate/community risk and phase-by-phase resource readiness rather than a single generic score. [5]
India-wide data-source feasibility audit
The most important data conclusion
There is no need to depend on one provider such as Google Earth Engine.
The strongest architecture is a provider-independent geospatial layer:
Primary/open sources
Copernicus • ISRO/NRSC • NWDP/CGWB/CWC • CPCB/Data.gov • IMD • CEA/NPP
↓
EcoSite Source Registry
Access method • licence • update date • resolution • coverage • uncertainty • cache permission
↓
EcoSite Geospatial Analysis
Polygon intersection • historical change • distance • time-series • coverage detection
↓
Evidence Layer
Observed / derived environmental facts
Google Earth Engine can be a very useful analysis accelerator, especially during the hackathon, but it should not become the only source of truth or a permanent architectural dependency. Google's current documentation states that private companies and government users using Earth Engine operationally need paid commercial configurations, while qualifying academic, nonprofit and certain research uses can continue without charges. [6]
That matters because the hackathon may be able to use Earth Engine under an eligible research/noncommercial configuration, while a later operational government deployment may not.
Detailed source inventory
The following is the working data inventory I recommend.
Decision factor	Best candidate source	Coverage / resolution / freshness	Access and licence	Feasibility decision
Current land cover, vegetation and change	Copernicus Sentinel-2	Global; 10 m, 20 m and 60 m bands; mission design provides frequent revisit	Sentinel data are free, full and open; CDSE provides APIs and downloads with registration for data access. [7]	P0 — strong
India-specific thematic land/water layers	ISRO Bhuvan	LULC, urban land use, water bodies, geomorphology, flood hazard and other thematic layers; documented services include 1:50,000 and 1:250,000 products	Bhuvan documents OGC WMS/WMTS consumption. [8]	P0/P1 — useful corroboration
Indian EO archive / raw imagery	ISRO Bhoonidhi	Archive from 47 Indian and foreign satellite missions since 1986	STAC-style API with bearer-token authentication; ISRO states ≥5 m GSD data are free/open to registered users, while finer-than-5 m data are priced for non-government users. [9]	P1 — valuable once access tested
Alternative global EO processing	Google Earth Engine	Large Earth-science catalogue including Sentinel, Landsat, MODIS, DEM and water products	Excellent compute environment, but operational commercial/government usage can require paid configuration and each underlying dataset retains its own terms. [10]	Optional compute layer
Terrain / slope	NASA SRTM / NASADEM	Approximately 30 m DEM	Available through Earth Engine and other NASA/USGS distribution mechanisms; SRTM 30 m is explicitly documented in the catalog. [11]	P0 — strong screening layer
Historical surface water	JRC Global Surface Water	Landsat-derived surface-water history from 1984–2021	Free with attribution and available in Earth Engine. [12]	P0 — historical evidence
Historical flood occurrence	NRSC Flood Affected Area Atlas	India; satellite-derived flood history 1998–2022	Official NRSC/ISRO–NDMA atlas. [13]	P0 — historical exposure only
Groundwater resource stress	CGWB Dynamic Ground Water Resources	National assessment-unit classification; latest published national assessment is 2025	CGWB's IN-GRES framework provides GIS-based national assessment; categories include Safe, Semi-critical, Critical and Over-exploited. [14]	P0 — contextual stress
Groundwater levels	National Water Data Portal / CGWB	Station-level manual/telemetry datasets; freshness and geographical station coverage vary	NWDP offers CSV/API resources; the CGWB telemetry dataset was updated on 25 Oct 2026 and advertises CSV/API access. [15]	P0/P1 — coverage-aware
Rainfall, river levels and discharge	NWDP / CWC / IMD	Station and district/basin datasets; updates vary	NWDP exposes APIs and machine-readable formats; CWC datasets include hourly/daily river levels and discharge. [16]	P1 — flood/water context
Operational weather and warnings	IMD	Forecasts, district warnings, rainfall, QPF and nowcasts	Official API reference exists, but an anonymous test from this research environment returned HTTP 401; credentials/access setup must therefore be validated before implementation. [17]	P1 — needs auth test
Ambient air quality	CPCB via Data.gov.in	Monitoring-station measurements across India; source is real-time AQI catalog	Catalog exposes an API and is released under NDSAP/GODL; registered data.gov users can generate API keys. [18]	P1 — useful contextual baseline
Surface heat	MODIS LST	Daily global land-surface temperature at ~1 km	MODIS LST available through Earth Engine. It measures surface temperature, not human-height air temperature. [19]	P1 — heat context
Heat/climate vulnerability	IMD Climate Hazard & Vulnerability Atlas	District-scale national hazard/vulnerability information	IMD publishes nationwide hazard/vulnerability products, including district heatwave vulnerability. [20]	P1 — climate context
Aggregate electricity system	CEA / National Power Portal	National, regional and state generation/transmission/capacity information	CEA publishes APIs for transmission lines, transformation capacity, generation, power supply and other statistics; NPP provides GIS-enabled power-sector data. [21]	Context only
Actual local grid headroom	DISCOM/STU evidence	Site/node-specific	No public national dataset identified that can replace utility load-flow/technical validation. NITI explicitly requires DISCOM/STU validation for planned data-centre load. [22]	Manual/authority evidence — essential
Project water allocation	ULB/water authority/groundwater authority	Site and project specific	National hydrological datasets provide context; actual allocation/NOC must come from competent authority. NITI distinguishes basin/public-supply assessment from phase-wise contracted supply. [23]	Manual/authority evidence — essential
Protected areas	WII National Wildlife Database + current legal notifications	National inventory	WII maintains the national PA information system; exact current legal geometry/ESZ status must be reconciled with notifications and competent-authority data. [24]	Screening + manual legal confirmation
Forest / wildlife / CRZ clearance context	PARIVESH	National clearance workflows	PARIVESH hosts EC, forest, wildlife and CRZ workflows and guidance. [25]	Regulatory reference
Land zoning / permitted use	State/local statutory planning authority	Highly local	No standardized nationwide machine-readable zoning source was found in this audit; local development plans and planning-authority records remain necessary. The prior regulatory research reached the same conclusion. fileciteturn0file0	Rule-pack/manual evidence
Broad infrastructure context	PM GatiShakti Public	Selected infrastructure and socioeconomic datasets	Public platform supports catchment analysis, site suitability, connectivity and preliminary approval/NOC review through registration and 2FA. [26]	Useful reference; not core dependency
What access was actually tested during this research
This distinction is important. A website saying that an API exists is not the same as successfully integrating it.
Copernicus STAC — strongest result. I directly queried the public CDSE STAC catalogue during this research. The service returned valid STAC JSON and exposed collection/search links, confirming that anonymous machine-readable discovery is currently working. Full EO data download requires registration. [27]
NWDP — partially tested. The official groundwater resource page exposes direct CSV download links and identifies CSV/API formats. A direct resource fetch reached a CSV response, although the research web renderer could not render the text/csv payload. That is a tooling limitation rather than proof of source failure, but an application-level ingestion test is still required before we call the connector production-ready. [28]
IMD — documentation confirmed, anonymous request not accepted. The API catalogue is public, but our direct anonymous request to the city-forecast mapping endpoint returned HTTP 401. We should therefore assume authentication or approved access is required until tested with appropriate credentials. [17]
Bhuvan — documented but not runtime-validated here. ISRO documentation explicitly publishes the WMS/WMTS mechanism, but our research environment could not retrieve the GetCapabilities endpoint. The product should therefore treat Bhuvan as a candidate connector until Codex performs an actual request from the development environment. [29]
Bhoonidhi — documented/token-gated, not authenticated here. Its official documentation describes a STAC-based search API and bearer-token download workflow; ISRO instructs users to contact Bhoonidhi for API access. Our anonymous research request was not accessible, so this remains an integration candidate rather than a verified connector. [30]
Data.gov/CPCB — API model confirmed, credentials still needed. The AQI catalog advertises a Catalog API, and Data.gov documentation says registered users can generate API keys. We did not create a user key during this research. [18]
Licensing is a genuine engineering requirement
We cannot put every visible government map into EcoSite and assume redistribution is allowed.
Government Open Data License–India permits reuse, adaptation, value addition and derivative works for lawful commercial and noncommercial purposes for datasets actually released under that licence, subject to attribution and exclusions. [31]
But the National Water Data Portal demonstrates why every resource needs its own licence check: NWDP describes itself as an open data platform, while individual resources can explicitly display “No License Provided.” NWIC also states that data producers retain responsibility for the underlying information and that users must determine whether a dataset is fit for their purpose. [32]
Therefore EcoSite needs a Data Source Registry containing, at minimum:
provider · dataset · version · access_method · auth_type · licence · can_cache · can_redistribute · spatial_resolution · temporal_resolution · coverage · observation_date · last_checked · quality_notes
This is not optional technical housekeeping; it is required to prevent the application from presenting stale, wrongly licensed or geographically inappropriate evidence.
The free-data strategy
For the hackathon MVP, the safest starting combination is:
Core satellite engine: Copernicus Sentinel-2 through CDSE STAC.
India-specific corroboration: Bhuvan thematic layers where WMS access is successfully validated.
Terrain: 30 m SRTM/NASADEM.
Historical water: JRC Global Surface Water.
Historical flood exposure: NRSC Flood Affected Area Atlas.
Groundwater: CGWB assessment + NWDP monitoring where coverage exists.
Air: CPCB/Data.gov when an API key is available.
Weather: IMD after access authentication is resolved.
Power: CEA/NPP only for regional context; never for claiming site-level spare capacity.
Actual power/water readiness: developer + DISCOM/STU + competent water-authority evidence.
That gives us a meaningful India-wide baseline without pretending the public internet contains all information necessary for an infrastructure investment decision.
Project inputs, evidence responsibilities and the evidence model
The central architectural principle
The earlier 66-page research identified what should become the core technical concept of EcoSite:
Evidence belongs to individual claims, not merely to the project.
For example:
Claim A
Peak facility demand = 80 MW
Source: Developer Electrical Load Study Rev. 3
Status: Documented
Authority confirmation: None
Claim B
Sanctioned utility load = 40 MW
Source: DISCOM sanction reference
Status: Verified
Scope: Phase 1
EcoSite can then conclude:
The project requires 80 MW at full build-out, but only 40 MW is currently backed by verified utility evidence. An additional 40 MW remains unsupported unless a valid future augmentation/connection commitment is documented.
This is exactly the type of evidence reconciliation advocated in the previous regulatory report. fileciteturn0file0
Who should supply what
Information	Developer / consultant	Government / utility	Public geospatial source	EcoSite's role
Full site/campus polygon	Primary input	May confirm approved footprint	Satellite/maps corroborate location	Validate geometry and compare across documents
Facility archetype	Primary input	May appear in application/approval	—	Classify colocation, AI/HPC/GPU, hybrid, etc.
IT load and total facility load	Primary engineering input	Utility receives/assesses requested load	—	Reconcile across project revisions
Phase-wise MW ramp	Primary engineering input	DISCOM/STU confirm relevant milestones	—	Determine phase readiness
Sanctioned power	May upload evidence	DISCOM/STU authoritative source	CEA provides only context	Preserve value, date, scope and verification
Network augmentation	Proposed/requested by developer	DISCOM/STU authoritative	—	Match completion date to project phase
Cooling design	Engineering input	May be reviewed in approvals	Climate data supports conditions	Calculate resource implications
Peak-summer water demand	Engineering input	Relevant authority may review	Climate/water datasets provide context	Compare demand with evidence-backed supply
Water allocation	Developer may upload letter	Water/groundwater authority	CGWB/NWDP provides stress context, not allocation	Calculate verified supply gap
Groundwater stress	—	CGWB/state data producer	Official datasets	Spatial match and provenance
Land-cover/vegetation change	—	—	Satellite / official GIS	Derive observed evidence
Flood history	Developer may commission study	Authority datasets where available	NRSC/terrain datasets	Preliminary exposure screening
Land-use permission	Developer uploads record	Planning authority	GIS can only screen	Verify status/scope where possible
EC/forest/wildlife/CRZ status	Developer supplies references	Competent authority / PARIVESH	GIS can flag potential trigger	Reconcile references; never auto-approve
PUE/WUE/CUE design	Developer engineering input	Post-commissioning reporting/verification as applicable	Climate context	Consistency and scenario analysis
Fibre redundancy	Developer/operator input	Provider/authority records where available	Public data may be incomplete	Evidence completeness; no fabricated route availability
NITI specifically recommends classification of data-centre archetype, total-campus and phase-wise power assessment, sanctioned MW and augmentation, peak-summer water planning, design/operating PUE/WUE/CUE, climate risk and 10–15-year expansion readiness. [33]
Evidence status model
The previous research's evidence vocabulary should be adopted almost unchanged. fileciteturn0file0
Status	Meaning	Can it support a readiness conclusion?
Declared	User entered the value without supporting evidence	Scenario only
Documented	A document/reference supports it but issuer/authenticity has not been independently confirmed	Qualified screening
Verified	Relevant authority, issuer, official portal or authorized reviewer has confirmed authenticity, scope and current validity	Yes, within its stated scope
Expired	Previously valid evidence is past validity	Historical only
Superseded	Replaced by a later revision	Audit trail only
Conflicting	Two credible assertions disagree materially	Must trigger review
Missing	Required evidence unavailable	Must remain unknown
Satellite/GIS observations need a separate evidence family:
observed
remote_sensing_derived
official_geospatial_layer
modelled
field_measured
This prevents a satellite-derived flood indicator from being confused with government approval, and prevents an approval letter from being interpreted as proof that environmental conditions have not changed. This separation was a central conclusion of the prior regulatory research. fileciteturn0file0
Recommended core data model
The MVP should move away from one flattened facility record and toward an evidence graph.
Entity	Essential information
Project	owner, archetype, stage, full-campus target, confidentiality
CandidateSite	polygon, state, district, planning authority, parcel identifiers
ProjectPhase	commissioning date, IT MW, facility MW, water demand, footprint
Assertion	field, value, unit, scope, source actor, effective dates
EvidenceArtifact	document type, issuer, reference, issue/expiry dates, file hash
Verification	method, verifier, timestamp, scope, outcome
Observation	dataset, version, timestamp, resolution, geometry, method, uncertainty
Rule	jurisdiction, instrument, effective dates, trigger, required action
Finding	deterministic conclusion, evidence dependencies, severity, unresolved actions
DataSource	provider, access method, licence, resolution, update frequency, last checked
A particularly useful structure is:
Assertion
 ├── project
 ├── candidate_site
 ├── phase
 ├── field
 ├── value + unit
 ├── claimed_by
 ├── evidence_status
 └── evidence_artifacts[]
          └── verifications[]
Then:
Finding
 ├── rule_version
 ├── assertions_used[]
 ├── observations_used[]
 ├── calculation_version
 ├── result
 ├── confidence / evidence completeness
 └── required_next_action
This design gives EcoSite an auditable answer to:
“Why did the system say that?”
Handling conflicting documents
Suppose the data centre has:
Source	Water figure
DPR Rev. 2	2.0 MLD
Cooling redesign Rev. 4	2.8 MLD
Existing consent document	2.5 MLD
Water-authority allocation	1.8 MLD
EcoSite must not average them.
It should preserve their scope and dates, then report:
Latest design peak demand: 2.8 MLD
Existing regulatory record: 2.5 MLD
Verified external allocation: 1.8 MLD
Potential current supply gap against latest design: 1.0 MLD
Material document inconsistency requires reconciliation.
The earlier research explicitly recommended this approach and warned against silently selecting one conflicting value. fileciteturn0file0
This Evidence Conflict Detector is one of the strongest possible EcoSite innovations.
Resource-readiness calculations and environmental screening
Do not build another opaque sustainability score
The MVP should have four independent decision dimensions:
Dimension	Question
Resource Readiness	Are power, water and supporting requirements actually backed by deliverable evidence?
Environmental Exposure	What environmental/climate constraints are observed or indicated at this location?
Regulatory / Site Readiness	What planning/approval constraints are confirmed, potentially applicable or unresolved?
Evidence Completeness	How much of the conclusion is verified, documented, derived or missing?
A single numerical score may eventually be used as an optional comparison aid, but a high aggregate score must never override a hard constraint or an unknown critical input.
This follows NITI's approach, which separates power/energy, water/cooling, siting/environmental sustainability, economic value and governance rather than collapsing everything into one risk number. [34]
Power-readiness engine
NITI's framework is unusually specific about power. It recommends a jointly validated developer/DISCOM/STU Power Readiness and Ramp-up Plan, full-planned-load load-flow studies, feeder limits, transformer loading, thermal headroom, contingency and augmentation milestones. [22]
For every phase p, EcoSite should store:
IT_load_MW[p]
facility_peak_MW[p]
net_grid_draw_MW[p]
sanctioned_grid_MW[p]
augmentation_MW[p]
augmentation_ready_date[p]
renewable_contracted_MW[p]
storage_usable_MW[p]
storage_duration_h[p]
commissioning_date[p]
A simple cross-check is:
(Implied PUE)_p=((Facility Peak MW)_p)/((IT Load MW)_p)
If the developer declares PUE = 1.30 but the supplied IT/facility loads imply 1.55, EcoSite should generate a consistency finding, not silently select one figure.
For current grid evidence:
(Grid Sanction Coverage)_p=(Verified Sanctioned Grid MW available by phase p)/((Phase Net Grid Draw MW)_p)
capped at 100% for display.
And:
(Uncovered Grid Requirement)_p=max(0,(Phase Net Grid Draw MW)_p−(Verified Deliverable Grid MW)_p)
A proposed future substation should not be counted as current capacity. An augmentation should count for a phase only when its evidence scope and expected delivery milestone support that phase.
NITI specifically says renewable and storage-backed deductions should count only when approvals, contracted quantum, connectivity, commissioning, metering and usable storage capacity are confirmed, and that net grid draw should be recorded by milestone. [22]
Therefore:
Proposed renewable capacity ≠ verified reduction in grid demand.
Nearby substation ≠ available MW.
Requested MW ≠ sanctioned MW.
Sanctioned Phase-1 MW ≠ full-campus readiness.
Water-readiness engine
For every phase, store:
average_water_KLD
peak_summer_water_KLD
cooling_makeup_KLD
domestic_KLD
other_KLD

municipal_fresh_KLD
groundwater_KLD
surface_water_KLD
treated_wastewater_KLD
internal_reuse_KLD

allocation_KLD
allocation_valid_until
source_ready_date
storage_days
contingency_source
The primary readiness calculation should use peak-summer demand, not annual average:
(Verified Water Supply Gap)_p=max(0,(Peak Summer External Requirement)_p−∑(Verified Deliverable Source Allocations)_p)
External recycled or treated water should be counted only when the source is actually contracted, connected and available by the phase milestone. This is directly consistent with NITI's new framework. [23]
The system should preserve internal recycling separately so the same litre is not accidentally counted once as demand reduction and again as external supply.
NITI also recommends long-term seasonal catchment assessment and protection of existing users, so groundwater/basin stress must remain a separate dimension from simple allocation quantity. [23]
Thus:
Water allocation tells us what the project is permitted/committed to receive.
Groundwater/basin analysis tells us whether the wider resource system is stressed.
Neither replaces the other.
PUE, WUE and CUE
EcoSite should collect designed PUE, WUE and CUE, but it should initially be conservative about benchmarking them.
NITI specifically recommends that BEE, BIS and MeitY standardize PUE, WUE and CUE measurement boundaries and that design-stage values later be measured using consistent boundaries. [35]
Therefore MVP output should look like:
Design PUE: 1.32
Evidence: Mechanical/Electrical design Rev. 4
Assumed climate: documented
Measurement boundary: developer-declared
Benchmark status: Not independently verified
rather than claiming:
“PUE 1.32 = sustainable.”
Land-cover and vegetation screening
Sentinel-2 offers 10 m visible/NIR bands and 20 m red-edge/SWIR bands suitable for examining vegetation, soil, water and land change. [36]
For a project polygon plus configurable surrounding area, EcoSite can derive:
Current built/vegetated/open/water composition.
NDVI or related vegetation indicators.
Historical vegetation loss/change.
Expansion into currently undeveloped land.
Surface-water proximity.
These should remain remote-sensing-derived observations, not legal land-use classifications.
Bhuvan's official thematic land-use layers can be used as an India-specific corroborating dataset where access and dates are suitable. [8]
Water-body and flood screening
Historical surface-water occurrence can be established with JRC's 1984–2021 Landsat-derived water dataset. [12]
NRSC's Flood Affected Area Atlas adds official India-specific historical flood evidence from 1998–2022. [13]
Terrain can be analyzed with a 30 m DEM. [37]
A defensible MVP result would be:
“14% of the proposed campus polygon overlaps areas appearing in the historical flood-affected dataset, and the site's southern section lies in locally lower terrain.”
It should not automatically say:
“This property has a 1-in-100-year flood probability of X%.”
A return-period probability requires a suitable hydrological/hydraulic model or authoritative flood model; historical remote-sensing overlap alone does not provide it.
Groundwater screening
CGWB's national assessment categorizes assessment units based on recharge, extractable groundwater and extraction into Safe, Semi-critical, Critical or Over-exploited categories. [38]
EcoSite can spatially associate a candidate location with that contextual assessment and, where nearby stations exist, add groundwater-level time-series information from NWDP. [39]
But:
Groundwater assessment category ≠ project groundwater entitlement.
Nearby groundwater level ≠ sustainable abstraction quantity for the proposed campus.
The authority NOC/allocation remains a separate evidence object.
Heat screening
MODIS offers daily land-surface temperature products at approximately 1 km. [19]
This can support surface heat context, such as:
Site LST Anomaly=Median Site LST−Median Reference-Area LST
But LST should be labelled land-surface temperature, not “air temperature.”
IMD forecasts, station observations and hazard/vulnerability products are more appropriate for air-temperature and heat-hazard context. [40]
Air-quality screening
CPCB's Data.gov catalog provides national monitoring-station values for PM2.5, PM10, NO₂, SO₂, CO, O₃ and other pollutants. [41]
EcoSite should record:
station
distance_from_site
observation_period
pollutant
valid_observation_count
missing_fraction
source_timestamp
It should not imply that a distant monitoring station establishes the statutory baseline concentration at the proposed campus. Formal environmental assessment may require project-specific baseline monitoring.
Protected areas, forest and coastal screening
This is an area where legal accuracy must take priority over automation.
WII maintains a national protected-area information system, while PARIVESH provides forest, wildlife and CRZ clearance systems and guidance. [42]
EcoSite may perform a preliminary spatial flag, but a legally significant conclusion should require current authoritative notification/geometry.
The UI should distinguish:
Screening intersection detected
from
Competent-authority boundary confirmed
from
Clearance/approval verified
Those are three different facts.
Environmental output should look like this
Finding	Evidence class	Confidence
Historical surface-water presence detected	Remote sensing derived	Medium/high depending dataset
Site in CGWB over-exploited assessment unit	Official contextual layer	High for assessment-unit classification
80 MW campus load	Developer documented	Medium
40 MW utility sanction	Authority verified	High within scope
Future additional 40 MW	Developer declared	Low/unverified
Recycled water source	Proposed only	Unverified
Current zoning	Missing	Unknown
Potential flood concern	Derived screening	Requires engineering study
Environmental clearance applicability	Screening assessment	Competent-authority confirmation required
That is a far more trustworthy product than turning every row into a normalized 0–100 score.
State-rule architecture and coverage limitations
Why rule versioning is mandatory
A nationwide EcoSite product cannot hard-code rules once and assume they remain valid.
The current state-policy landscape demonstrates this immediately.
State	Current research finding	EcoSite implication
Maharashtra	Official sources publish the Maharashtra IT/ITeS Policy 2023 and identify data centres as a focus segment. [43]	Build a Maharashtra policy/rule adapter
Karnataka	Karnataka's official digital-economy portal lists the Data Centre Policy 2022–2027 and operational guidelines. [44]	Current rule pack can reference effective period
Uttar Pradesh	Invest UP now publishes the Uttar Pradesh Data Centre Policy 2026, including separate thresholds/categories for parks, units and edge centres. [45]	2026 policy must supersede older configuration
Tamil Nadu	The official Tamil Nadu page says its 2021 Data Centre Policy was applicable until 31 March 2026. [46]	As of 26 Oct 2026, do not silently treat the 2021 policy as current; check replacement/current instruments
West Bengal	NeGD's official state-policy listing records the 2021 policy with expiry on 5 September 2026; the state single-window repository still exposes that policy document. [47]	System must flag it as expired unless current replacement is verified
This alone proves why EcoSite needs effective dates and source-versioning.
Recommended rule object
Every rule should include:
rule_id
country
state
district_or_region
local_authority
utility_service_area

instrument_name
instrument_type
authority
official_reference

effective_from
effective_to
supersedes
superseded_by

project_archetype
capacity_min
capacity_max
location_trigger

condition
result_type
required_document
required_authority
severity

last_verified_at
source_status
instrument_type should differentiate:
Statute
Rule/regulation
Government notification
Policy/incentive
Technical standard
Guidance/framework
Local development control
Utility procedure
That is crucial because NITI's 2026 framework is guidance and decision support, not a new statutory environmental clearance. [22]
Similarly, a state policy offering incentives or relaxed building provisions must not be treated as permission to ignore forest, environmental, utility or other applicable law.
Rule evaluation sequence
India-wide national base rules
          ↓
State-specific rule pack
          ↓
District / ULB / planning authority
          ↓
Electricity utility service area
          ↓
Water / groundwater authority
          ↓
Project archetype and capacity
          ↓
Parcel-specific spatial triggers
          ↓
Current evidence and document status
The result should not simply be COMPLIANT / NON-COMPLIANT.
Use:
Not applicable
Potentially applicable
Evidence required
Documented
Verified
Conflict detected
Expired evidence
Specialist / authority confirmation required
Coverage meter
An India-wide product should openly show how much it actually knows.
Example:
National baseline
Environmental layers: 8/9 available
National regulatory rules: Current
State coverage
Data-centre policy: Current
State pollution-board mapping: Partial
Groundwater authority mapping: Current
Local coverage
Statutory zoning GIS: Unavailable
Water-utility capacity API: Unavailable
DISCOM capacity API: Unavailable
Outcome:
Local regulatory coverage: Partial
Manual verification required before investment decision
This is a better design than silently giving the same apparent certainty everywhere in India.
Data availability is not equal across India
NWDP itself operates as a federated system in which data producers retain responsibility for data collection, validation and publication; station and resource availability therefore varies. [48]
Bhuvan thematic products also vary by theme and product date rather than being one continuously updated “live India” layer. [49]
Air-quality monitoring is station-based, not continuous coverage of every parcel. [41]
And local land-use plans and utility capacities remain jurisdiction-specific.
Therefore India-wide must mean a common workflow and national baseline—not identical data completeness at every coordinate.
Competitive differentiation and the innovative MVP
We cannot claim site selection itself is unique
The research found significant existing capabilities.
PM GatiShakti Public already provides selected geospatial and analytical capabilities for infrastructure context, site suitability, connectivity and preliminary approval/NOC understanding. [50]
PARIVESH already handles formal environmental, forest, wildlife and CRZ clearance workflows. [51]
DC Byte offers a dedicated commercial data-centre Site Selector with project milestones, market intelligence, flood mapping and infrastructure overlays such as power and connectivity; its global market-intelligence products track thousands of facilities. [52]
Baxtel offers data-centre site selection and procurement with infrastructure context including power availability, substations, transmission, zoning and fibre; it describes its listings coverage as global while noting concentration in the United States. [53]
Therefore we should never pitch EcoSite as “the first platform that uses GIS to select data-centre sites.”
That claim would be easy for judges to challenge.
The defensible differentiation
The research supports a more specific innovation hypothesis:
EcoSite is an India-focused, NITI-aligned pre-decision evidence and resource-readiness system that connects candidate-site environmental conditions with full-campus, phase-wise developer requirements and authority/utility evidence, explicitly distinguishing declared, documented, verified, derived, conflicting and missing information.
I did not find this exact value-level evidence-reconciliation model documented in the public descriptions of PM GatiShakti, PARIVESH, DC Byte or Baxtel reviewed in this research. That is an inference from their published product descriptions, not proof that no competitor has internal or enterprise functionality with similar capabilities. [54]
The strongest MVP innovations
Evidence Graph
Instead of attaching documents loosely to projects, every critical assertion is connected to its source, scope, phase, date and verification.
That allows EcoSite to detect:
80 MW DPR
40 MW sanction
60 MW electricity application
50 MW environmental document
and ask:
“Which capacity is actually the current project?”
This directly exploits the overlapping document requirements identified in the prior 66-page approval research. fileciteturn0file0
Resource Readiness Timeline
Not just:
Power available: Yes
but:
2027  Phase 1   20 MW required   20 MW verified     READY
2029  Phase 2   45 MW required   40 MW verified     5 MW GAP
2032  Phase 3   80 MW required   40 MW verified     40 MW GAP
                                        │
                           proposed augmentation
                           completion: unverified
This is tightly aligned with NITI's recommendation to match full-campus demand, sanctioned MW, year-wise energization and grid augmentation milestones. [22]
Water Source Reality Check
Peak-summer requirement                2.8 MLD
Verified municipal allocation          1.4 MLD
Proposed treated-water connection      0.8 MLD
Status of treated-water connection     DECLARED
Groundwater NOC                         NONE
──────────────────────────────────────────────
Verified supply                         1.4 MLD
Current evidence gap                    1.4 MLD
The platform refuses to count proposed recycled water until it satisfies the evidentiary conditions established in the NITI framework. [23]
Evidence Conflict Detector
The system automatically compares capacity, land area, electricity, water and project phase across uploaded DPRs, utility letters and regulatory documents.
This is probably one of the most hackathon-friendly innovations because it combines AI-assisted document understanding with deterministic, auditable rules.
AI may suggest:
“I found 2.8 MLD on page 47.”
A human confirms the extraction.
The deterministic engine then says:
“This differs from the verified 1.8 MLD allocation.”
The AI does not invent the final legal conclusion.
Site Readiness Passport
Every candidate receives an exportable report:
EcoSite Site Readiness Passport
Project identity
Campus/phases
Environmental observations
Power readiness
Water readiness
Climate exposure
Planning/regulatory evidence
Conflicts
Missing evidence
Mitigation opportunities
Next authority actions
Dataset provenance
Rule versions
Confidence limitations
This becomes the primary judge-facing output.
Alternative Site Delta
Rather than merely:
Site A = 76
Site B = 81
EcoSite says:
Site B is currently preferable because it avoids the historical flood exposure found at Site A and has a larger share of its phase-1 power requirement covered by verified evidence. However, Site B still lacks verified peak-summer water supply.
Site C has lower groundwater stress context but unresolved zoning evidence.
That is much closer to actual planning reasoning.
Coverage and Uncertainty Map
The platform should visually distinguish:
Data available
Data stale
No station nearby
Source unavailable
Authority evidence required
Legal layer unverified
That makes absence of evidence visible instead of turning it into green space on a dashboard.
MVP scope after this research
I recommend the following feature priority.
Priority	Capability	MVP?
Core	India-wide candidate polygon input	Yes
Core	Data-centre archetype and complete campus/phasing	Yes
Core	Public geospatial environmental screening	Yes
Core	Developer project/resource input	Yes
Core	Evidence states and document attachments	Yes
Core	Power readiness/gap calculation	Yes
Core	Water readiness/gap calculation	Yes
Core	Evidence conflict detection	Yes
Core	Three-site comparison	Yes
Core	Rule/version coverage engine	Yes
Core	Site Readiness Passport	Yes
Next	Automated PDF extraction	Helpful, after core reliability
Next	Satellite time-series change analysis	Yes if time permits
Next	Advanced climate scenarios	Limited
Later	Utility API integration	Requires partnerships/access
Later	Government digital verification	Requires institutional integration
Later	Nationwide fully automated legal determination	Not realistic as MVP
Later	Green-energy optimization platform	Remains optional future expansion
What to call the solution
I would now position the project as:
EcoSite India
Evidence-Driven Data Centre Site & Resource Readiness Intelligence
Tagline:
Know what the site can support before you commit to it.
Or, for the hackathon problem:
“Helping India place data centres where power, water, land and the environment can sustainably support their full lifecycle.”
Existing prototype migration and implementation priorities
We should preserve your teammate's foundation
The existing prototype already contains useful architectural pieces: a React/TypeScript map UI, FastAPI backend, map-based candidate selection, risk views, forecasts, candidate comparison, mitigation and report generation. The audit found six existing routes/modules and confirmed a working synthetic scoring contract at the data level, although the application itself still has not been runtime-verified. fileciteturn0file2
Therefore do not rebuild EcoSite from zero.
Instead, repurpose the existing modules.
Current module	Keep	Change into
Dashboard / Map	MapLibre, map UX, facility selection concepts	India-wide Candidate Site & Environmental Evidence Map
Risk Analysis	Explainability patterns and charts	Four-dimensional Readiness / Exposure / Regulatory / Evidence analysis
Forecast	Chart UI	Phase-wise MW/water ramp-up and readiness timeline
Site Evaluation	Candidate comparison structure	Site A/B/C evidence-backed data-centre comparison
Mitigation	Recommendation UX	Cooling, water, resilience and site/design mitigation scenarios
Reports	Export/dossier mechanisms	EcoSite Site Readiness Passport
What must be replaced
The current deterministic eight-indicator score is based on synthetic facility records, and the forecast system uses synthetic linear arithmetic rather than validated predictive models. Official environmental observations are not integrated. fileciteturn0file2
Those parts should be retired as decision evidence, not cosmetically relabelled.
The current schema also requires all eight indicator values and cannot naturally preserve missing observations. That is incompatible with the new evidence model, where missing must stay missing. fileciteturn0file2
The current SQLite database contains only the facility model and lacks persistent users, planning projects, candidates, scenarios or evidence records. fileciteturn0file2
For the hackathon, SQLite can remain, but its schema must expand around:
projects
candidate_sites
project_phases
assertions
evidence_artifacts
verifications
observations
data_sources
rules
findings
reports
A full spatial database migration is not required to prove the concept.
Security/correctness fixes remain blockers
Before importing developer documents or external names, the existing raw HTML injection path in map facility names should be fixed. The previous audit also identified forecast-contract mismatches, saved-mitigation overwrite behaviour, Gemini credential exposure and candidate-request race/loading issues. fileciteturn0file2
This is especially important now because the new product will handle untrusted project names, uploaded evidence and potentially confidential information.
The runtime baseline also remains unproven: the earlier audit did not execute build, lint, frontend tests, backend tests or end-to-end workflows. fileciteturn0file2
So before feature integration:
Get the existing application running, fix the confirmed security/correctness defects, establish passing tests, and only then change the data model.
That preserves your teammate's Git history and avoids debugging old and new problems simultaneously.
Recommended implementation order
Foundation gate
Existing project builds and runs.
Frontend tests pass.
Backend tests pass.
Map injection fixed.
Forecast mismatch fixed.
Mitigation persistence fixed.
Secrets model resolved.
↓
Data/evidence foundation
Project + candidate + phase model
Evidence graph
Data source registry
Rule version model
↓
First live data
Copernicus
CGWB/NWDP
NRSC historical flood
Terrain
CPCB or IMD where authentication is ready
↓
Readiness engine
Power gap
Water gap
Evidence conflict
Environmental screening
↓
Experience
Site comparison
Readiness timeline
Coverage map
Passport
This order is much safer than integrating AI first.
Multi-state demonstration, acceptance tests and final blueprint
The demo should prove India-wide architecture
I recommend using synthetic data-centre proposals on real Indian geography.
That allows us to use genuine environmental datasets without making claims about a real private project.
Demonstration case — Maharashtra
Illustrative AI/HPC campus
Full planned capacity: 80 MW
Phases: 20 → 50 → 80 MW
The synthetic project has a verified initial power commitment covering only part of the eventual campus and an incomplete water package.
This case should demonstrate:
Full-campus versus Phase-1 readiness.
Maharashtra state rule pack.
Groundwater/land-cover/flood screening.
Evidence conflict handling.
Expansion-headroom logic.
Maharashtra is suitable for the rule-pack demonstration because its official IT/ITeS Policy 2023 explicitly covers data centres as a focus segment. [43]
Demonstration case — Uttar Pradesh
Illustrative 60 MW colocation campus
Compare two candidate parcels.
One has a stronger environmental profile but incomplete utility evidence.
The other has more developed infrastructure evidence but poorer water-resource context.
This case proves that EcoSite does not automatically rank “green-looking” land above infrastructure readiness.
Uttar Pradesh is particularly useful because an official Data Centre Policy 2026 now exists, giving us a current 2026 state rule pack for the demonstration. [45]
Demonstration case — Tamil Nadu
Illustrative coastal data-centre campus
This should exercise:
Coastal/flood/climate screening.
Heat/cooling context.
Water-source analysis.
Rule expiry handling.
Tamil Nadu's official site states that its Data Centre Policy 2021 applied until 31 March 2026. Therefore the system must not display that policy as a current rule in October 2026 unless a replacement/current instrument is verified. [46]
That gives judges a subtle but powerful demonstration:
EcoSite does not just store rules. It understands whether its evidence is still current.
Acceptance tests
Test	Required result
Developer enters 80 MW; only 40 MW verified	System reports 40 MW evidence-backed gap; it does not infer nearby substation capacity
Future augmentation is merely declared	It is shown as future/unverified and does not make the current phase ready
Developer proposes recycled water	It does not reduce verified freshwater requirement until source readiness is documented/verified
Groundwater dataset unavailable	Result is Unknown / data unavailable, not “low risk”
DPR and authority document disagree	Both values survive; a conflict finding is generated
Phase-1 sanction is reused for Phase 3	System detects scope mismatch
Old state policy expires	Rule engine stops treating it as current
Satellite layer is several years old	UI exposes observation period/date
Air-quality station is far from site	Distance/representativeness warning appears
Flood atlas overlaps site	“Historical flood exposure” appears; no unsupported return-period probability is invented
Legal protected-area geometry is not authoritative	Result becomes “screening / confirmation required,” not automatic prohibition
External API fails	System preserves prior data provenance or reports unavailable; it never substitutes synthetic green values
Candidate A beats B	Report explains why, including evidence and unresolved constraints
Missing critical evidence exists	No aggregate “approved/suitable” verdict is allowed
User changes a project value	Downstream findings become stale and recalculate
Site name contains HTML/JavaScript	It renders as plain text and cannot execute
Readiness Passport is exported	All calculations, data-source versions, assumptions and evidence statuses reproduce the screen result
Demo mode remains available	Synthetic records are visibly labelled synthetic and cannot be confused with live evidence
MVP success criteria
At the end of the MVP, a judge should be able to perform this workflow:
Create Project
80 MW AI/HPC campus
↓
Select Candidate Sites
Draw/upload three polygons anywhere in supported Indian geography
↓
EcoSite Automatically Screens
Satellite + water + terrain + flood + heat + air + applicable source coverage
↓
Enter Project Requirements
Phases, IT MW, facility MW, cooling, water, backup systems
↓
Attach Evidence
Utility sanction • water allocation • planning document • relevant approvals
↓
EcoSite Reconciles
Declared vs documented vs verified • conflicts • missing evidence • phase gaps
↓
Compare Sites
Environmental exposure + resource readiness + regulatory/site status + evidence completeness
↓
Export Readiness Passport
What is known • what is unsupported • what must happen next • why one site currently deserves further investment
Go/no-go assessment by capability
Capability	Research verdict
India-wide environmental satellite screening	GO — strong
India-wide land-cover/change analysis	GO — strong
Nationwide terrain screening	GO — strong
Historical surface-water screening	GO — strong
Groundwater stress context	GO — strong at assessment-unit level
Local groundwater monitoring	GO with coverage limitations
Historical flood screening	GO, but not predictive probability
Live/recent weather	GO after IMD access validation
Air quality	GO with station/coverage limitations
Exact local grid spare capacity	NO from public data; require utility evidence
Exact project water availability	NO from satellite/public context alone; require authority evidence
Nationwide parcel zoning automation	NOT YET; local sources are fragmented
Nationwide automatic legal approval decision	NO — inappropriate MVP claim
State-aware regulatory screening	GO incrementally through versioned rule packs
Multi-state candidate comparison	GO
Evidence reconciliation	GO and should be core differentiator
AI document extraction	GO as assistive feature, not decision authority
Fully autonomous “AI approves site”	NO
Final research conclusion
The feasibility audit changes one major assumption:
EcoSite does not need a magical national database containing every answer.
Instead, its strength can come from knowing which answer must come from which type of evidence.
Satellite and national datasets tell us:
What is physically observable or environmentally indicated here?
Developer engineering information tells us:
What will the proposed data centre actually require?
Utility and government evidence tells us:
What has genuinely been committed, sanctioned or verified?
The rules engine tells us:
Which requirements and authorities are relevant to this location and project at this point in time?
And EcoSite's own intelligence layer answers:
Where do these facts agree, where do they conflict, what remains unknown, and which candidate creates the fewest unresolved problems?
That architecture is directly compatible with the direction of NITI Aayog's October 2026 Data Centre Evaluation Framework, which calls for verified full-campus resource readiness, phase-wise power and water planning, climate/community assessment and clear accountability rather than simply attracting projects first and solving infrastructure constraints later. [33]
It also avoids duplicating PM GatiShakti or PARIVESH: GatiShakti already addresses broad geospatial infrastructure planning and site suitability, while PARIVESH manages formal environmental-clearance workflows. EcoSite's proposed role sits before and between those systems, at the point where a developer or state must decide whether a candidate deserves deeper engineering work and investment. [55]
And it avoids competing with commercial site selectors solely on the number of maps or facilities in a database. DC Byte and Baxtel already demonstrate that market intelligence, power/fibre context, flood overlays and site selection are established commercial capabilities. [56]
The strongest defensible innovation is therefore the combination of:
India-wide environmental screening
+
Full-campus phase-wise resource modelling
+
Declared / Documented / Verified evidence
+
Cross-document conflict detection
+
State/local rule versioning
+
Explicit uncertainty and data-coverage disclosure
+
Alternative-site decision explanation
+
EcoSite Site Readiness Passport
The prior repository audit shows that the current application is still a synthetic Pune/Mumbai demonstration and lacks official environmental observations, validated forecasting, an evidence-aware schema and server-side project persistence. It nevertheless provides useful map, comparison, scenario and reporting components that can be evolved rather than rebuilt. fileciteturn0file2
The research verdict is therefore: GO.
But the next implementation phase should not begin with adding more dashboards, an AI chatbot, 3D visualization or a sophisticated predictive model.
The correct first engineering milestone is:
Make one synthetic data-centre proposal work end-to-end across three real Indian geographic contexts using real public environmental data, structured developer requirements, manually supplied utility evidence, a versioned state rule pack, evidence-conflict detection and a reproducible Site Readiness Passport.
Once that succeeds, EcoSite will have crossed the critical line from a visually impressive synthetic prototype to a credible India-wide data-centre pre-investment decision-support system.

[1] [16] featureswaterdataportal - National Water Data Portal
https://nwdp.nwic.gov.in/about/featureswaterdataportal
[2] [4] [5] [22] [23] [33] [35] NITI Aayog
https://www.niti.gov.in/node/2443
[3] [34] Press Release Page | Press Information Bureau
https://www.pib.gov.in/PressReleasePage.aspx?PRID=2323840&lang=1®=48
[6] Transition to commercial projects  |  Google Earth Engine  |  Google for Developers
https://developers.google.com/earth-engine/guides/transition_to_commercial
[7] Terms and conditions | Copernicus Data Space Ecosystem
https://dataspace.copernicus.eu/terms-and-conditions
[8] [29] How to use WMS services - Bhuvan Wiki
https://bhuvan.nrsc.gov.in/wiki/index.php/How_to_use_WMS_services
[9] [30] Bhoonidhi API Specification
https://bhoonidhi.nrsc.gov.in/bhoonidhi-api/
[10] Earth Engine Data Catalog  |  Google for Developers
https://developers.google.com/earth-engine/datasets/catalog/
[11] [37] NASA SRTM Digital Elevation 30m  |  Earth Engine Data Catalog  |  Google for Developers
https://developers.google.com/earth-engine/datasets/catalog/USGS_SRTMGL1_003
[12] JRC Global Surface Water Mapping Layers, v1.4  |  Earth Engine Data Catalog  |  Google for Developers
https://developers.google.com/earth-engine/datasets/catalog/JRC_GSW1_4_GlobalSurfaceWater
[13] Version -1 (1998-2022)
https://www.nrsc.gov.in/sites/default/files/pdf/DMSP/FloodAffectedAreaAtlas_Digital.pdf
[14] [38] Ground Water Resource Assessment | CGWB
https://cgwb.gov.in/index.php/en/ground-water-resource-assessment-0
[15] [28] Ground Water Level (Telemetry - Hourly), Central Ground Water Board (CGWB) - Dataset - National Water Data Portal
https://nwdp.nwic.gov.in/dataset/ground-water-level-telemetry-hourly-central-ground-water-board-cgwb
[17] [40] IMD API Reference
https://api.imd.gov.in/public/api_reference.html
[18] [41] Real time Air Quality Index | Open Government Data (OGD) Platform India
https://www.data.gov.in/catalog/real-time-air-quality-index
[19] MODIS Collections in Earth Engine  |  Earth Engine Data Catalog  |  Google for Developers
https://developers.google.com/earth-engine/datasets/catalog/modis
[20] Press Release Page | Press Information Bureau
https://www.pib.gov.in/PressReleasePage.aspx?PRID=2238023&lang=2®=48
[21] API for Central Electricity Authority Data - Central Electricity Authority
https://cea.nic.in/api-for-central-electricity-authority-data/?lang=en
[24] [42] National Wildlife Database Cell | Wildlife Institute of India, an Autonomous Institute of MoEF, Govt. of India
https://v1.wii.gov.in/nwdc_aboutus
[25] [51] PARIVESH | Home
https://parivesh.nic.in/
[26] [50] [54] [55] Public Platform Page | National Master Plan | PM GatiShakti
https://staging1.pmgatishakti.gov.in/pmgatishakti/public_platform
[27] catalogue.dataspace.copernicus.eu
https://catalogue.dataspace.copernicus.eu/stac
[31] 761GI
https://www.meity.gov.in/static/uploads/2024/02/Gazette-Notification_OpenDataLicense_13.02.2017.pdf
[32] Rainfall Daily IMD - Rainfall StateWise Daily IMD - National Water Data Portal
https://nwdp.nwic.gov.in/en/dataset/rainfall-daily-imd/resource/acd3023c-df96-4af8-8815-a7393cb80839
[36] Sentinel-2 | Copernicus Data Space Ecosystem
https://dataspace.copernicus.eu/data-collections/copernicus-sentinel-missions/sentinel-2
[39] Ground Water Level (Telemetry - Hourly), Central Ground Water Board (CGWB) - Dataset - National Water Data Portal
https://nwdp.nwic.gov.in/en/dataset/ground-water-level-telemetry-hourly-central-ground-water-board-cgwb
[43] Industrial Policies and Incentives - MIDC
https://midc.maharashtra.gov.in/en/investors/industrial-policies-and-incentives/
[44] Policies – KDEM – Technology Enabler
https://karnatakadigital.in/policies/
[45] Official Website of InvestUP, Uttar Pradesh, India
https://invest.up.gov.in/uttar-pradesh-data-centre-policy-2026/
[46] "Tamil Nadu Data Centre Policy 2021" | Tamil Nadu Information Technology Department
https://it.tn.gov.in/en/Tamil_Nadu_Data_Centre_Policy_2021
[47] State IT Policy – NeGD – National e-Governance Division
https://negd.gov.in/state-it-policy/
[48] nwicwaterdata - National Water Data Portal
https://nwdp.nwic.gov.in/about/nwicwaterdata
[49] Thematic Data - Bhuvan Wiki
https://bhuvan.nrsc.gov.in/wiki/index.php/Thematic_Data
[52] Frequently Asked Questions | DC Byte
https://www.dcbyte.com/faq/
[53] Site Selection | Baxtel
https://baxtel.com/services/site-selection
[56] Streamlined Site Selector | DC Byte
https://www.dcbyte.com/site-selector/