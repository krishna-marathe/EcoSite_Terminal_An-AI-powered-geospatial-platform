Implementation Plan 
Krishna Siddhartha Omar Samarth

EcoSite India — Four-Member Master Implementation Plan
Version 2.0 · 27 October 2026 · One Earth Hackathon 2026
Team: Krishna · Siddharth · Omar · Samarth
Product: EcoSite India — Evidence-Driven Data Centre Site & Resource Readiness Intelligence
Goal: Complete a credible, innovative, working MVP as quickly as possible while giving all four members independent, coordinated workstreams.
I've reviewed the latest repository audit, our earlier feasibility and regulatory research, and the technical architecture. I've also checked key official data-source documentation against the proposed implementation.
Executive decision
We should freeze the product scope and divide development into four parallel workstreams, rather than having everyone independently research or code different ideas.
The central product question remains:
Can a proposed data-centre campus be supported at a particular Indian location through its full development lifecycle, and what environmental conditions, infrastructure capacity gaps, documentary conflicts and regulatory uncertainties should be resolved before investment?
This direction is consistent with NITI Aayog's Data Centre Evaluation Framework, released on 14 October 2026, which examines power, water, siting, environmental sustainability, economic value and governance together. 

niti.gov.in+1
Our hackathon MVP will be a pre-investment screening and evidence reconciliation platform, not an automatic approval authority.
Four workstreams — one integrated product
Krishna
Backend architecture, database, resource engines, integration
Siddharth
Dataset roadmap, official sources, GIS ingestion, regulatory research
Omar
Frontend, user journeys, developer/government workspaces, Passport UI
Samarth
AI/ML, document extraction, synthetic datasets, model evaluation
Integration principle
Krishna owns the backend/API contracts, Omar consumes those contracts, Siddharth supplies source-attributed observations and rule metadata, and Samarth supplies reviewable document-extraction candidates. All four contribute tests and jointly approve integration.
1. Current project status — what we must not rebuild
The latest OpenCode audit at commit 0d19f0d establishes the following baseline:
Component	Current position	Next action
Existing React/FastAPI/MapLibre prototype	Reusable foundation	Preserve
Security and application stabilization	Implemented	Maintain regression tests
Project database and CRUD	Implemented	Extend
India-wide candidate polygons	Implemented	Reuse
India ADM0 screening boundary	Bundled and versioned	Retain screening disclaimer
Development-phase model/API/UI	Implemented	Finish final acceptance
Power and water readiness engine	Not implemented	Krishna
Evidence/document database	Not implemented	Krishna + Samarth
Real GIS observations	Not implemented	Siddharth
Government/developer workflow	Not implemented	Omar + Krishna
State regulatory packs	Not implemented	Siddharth + Krishna
Site comparison and Passport	Not implemented	Omar + Krishna
Trained suitability model	Not implemented	Not required for MVP
The backend passed 56 tests in the latest audit, while the frontend passed 129 of 132 tests; three timeouts remain to investigate. The current normal SQLite database also has not been upgraded to the latest migration revision.
We must distinguish implemented source code from tested production readiness.
2. Freeze the MVP scope
Target release: EcoSite India MVP 1.0
Committed scope
A judge should be able to:
Create a proposed data-centre campus with a full-capacity development plan.
Draw or import up to three Indian candidate-site polygons.
View real, source-attributed environmental observations.
Enter engineering requirements for power, water and cooling.
Upload utility, planning and project documents.
Extract candidate facts and review their source pages.
Distinguish declared, documented, verified, expired, conflicting and missing evidence.
Inspect phase-wise resource gaps and relevant state-rule screening.
Compare three sites across independent readiness dimensions.
Export a reproducible Site Readiness Passport.
The system should never turn missing information into zero risk, infer spare grid capacity from substation proximity, or claim a legal clearance merely because a document was uploaded.
Geographic scope
We'll continue with the seven-state structure from our research:
Coverage	States	Implementation depth
Tier A	Maharashtra, Karnataka, Uttar Pradesh, Gujarat, Odisha	Curated state policy metadata, authorities, effective dates, key evidence requirements
Tier B	Tamil Nadu, Telangana	Policy lifecycle, uncertain instrument status and incomplete-coverage handling
National	Other Indian states	Candidate geometry and environmental screening wherever sources support it; local rules marked incomplete
Nationwide geographical coverage does not mean nationwide automated zoning, groundwater entitlement or utility approval.
Three things we will explicitly defer
First, a supervised ML model that predicts whether a data centre will be approved or sustainable. We do not have verified labelled Indian project outcomes to train that responsibly.
Second, a fully automated government approval system. Authentic confirmation by authorized government users or official systems cannot be simulated and described as real verification.
Third, twenty or thirty environmental API integrations. We will implement a small set of reliable sources first, with honest availability and provenance metadata.
Part I — Product architecture and technical contracts
3. Complete system architecture
We should keep the current modular-monolith approach and extend it, not replace the existing stack.
React + TypeScript + MapLibre
Developer workspace · Reviewer workspace · GIS · Comparison · Passport
FastAPI + Pydantic
Authentication · Projects · Evidence · Observations · Assessments · Reports
Engineering engines
Power, water, conflicts, rule evaluation, comparison
Environmental engine
Raster statistics, observations, source coverage
Document intelligence
PDF/DOCX parsing, OCR fallback, optional AI extraction
Regulatory engine
Versioned state rules, applicability, missing approvals
SQLite + SQLAlchemy + Alembic
Projects · Assertions · Documents · Observations · Assessments · Audit records
Private file storage
Cached datasets
Background jobs
Recommended technology stack
Layer	Decision	Reason
Frontend	Existing React 19, TypeScript, Vite	Already working
UI	Existing Tailwind and components	Avoid rebuilding
Map	Existing MapLibre GL JS	Polygon and raster visualization
Charts	Recharts	Phase timelines
API	FastAPI + Pydantic	Typed contracts
Database	SQLite + SQLAlchemy 2 + Alembic	Already introduced in Phase 02
GIS geometry	Shapely + PyProj	Already used
Raster	Rasterio + NumPy	Clipping and analysis
GIS ingestion	Python requests/httpx + source-specific clients	Controlled connectors
PDF parsing	PyMuPDF	Page-level evidence
DOCX parsing	python-docx	Structured office documents
OCR	Optional, only for scanned pages	Reduce complexity
AI/ML	scikit-learn / optional pretrained transformer or server-side LLM	Assist document classification/extraction
Storage	Private local files + SHA-256	Hackathon simplicity
Background work	Persisted job table + single worker	Restart-safe analysis
Testing	Vitest + unittest/FastAPI TestClient	Existing setup
Deployment	Single local instance first	No premature cloud complexity
Do not introduce Kubernetes, Kafka, Spark, microservices or a new frontend framework.
SQLite remains appropriate for a local demonstration. For authenticated concurrent government/developer use, plan a later PostgreSQL/PostGIS migration.
4. Define user roles and permissions
We need to distinguish who entered a claim from who has authority to verify it.
This should be reflected in the database and UI.
Role	Main capabilities	Restriction
Platform Admin	Configure sources, system users and rule versions	Cannot automatically approve a site
Developer / Industry	Create projects, phases, sites, requirements, upload documents	Cannot self-certify external utility capacity
Consultant / Engineer	Submit studies, review technical claims, add specialist findings	Verification limited to professional scope
Government / Authority Reviewer	Review assigned evidence, confirm or reject claims within jurisdiction	Cannot edit developer's original evidence
Utility / Water Authority Reviewer	Confirm relevant sanctioned capacity or allocation	Cannot verify unrelated authorities' claims
Read-only Evaluator	View permitted reports and findings	Cannot change or verify evidence
What is realistic for the hackathon?
Implement a small role-based prototype with three usable interfaces: Developer, Reviewer and Admin.
The reviewer interface can demonstrate the verification workflow with simulated accounts. It must not imply that an actual DISCOM, municipality or government official authenticated those documents.
A meaningful future government deployment requires actual identity verification, organization affiliation, jurisdiction-based authorization and auditability. Until then, the UI should display Demo Verification rather than Government Verified for simulated reviewers.
Role workflow
Developer submits a proposal
Documents support individual claims
System extracts and identifies gaps
Authorized reviewer confirms scope and source
Readiness engines calculate evidence-backed results
Passport records conclusions and remaining actions
For the MVP, use authenticated demo users with fixed seeded roles if implementing a complete authentication flow would delay the core functionality. Loopback-only access is not equivalent to authentication; do not expose those workflows publicly without proper access controls.
5. Database architecture — final target
Phase 02 already provides projects, candidate_sites and project_phases. We should add entities incrementally.
Group	Database tables	Owner
Identity	organizations, users, memberships	Krishna
Campus	Existing projects, candidate_sites, project_phases	Krishna
Engineering	power_commitments, water_commitments, optional site_design_scenarios	Krishna
Evidence	assertions, evidence_artifacts, assertion_evidence, verifications	Krishna
Extraction	document_extractions, extraction_reviews	Samarth + Krishna
Data	data_sources, source_access_tests, observations	Siddharth + Krishna
Regulatory	rule_instruments, rules, rule_evaluations	Siddharth + Krishna
Analysis	analysis_jobs, assessment_runs, findings, finding_dependencies	Krishna
Reporting	reports, report_artifacts	Krishna + Omar
Governance	audit_events	Krishna
Evidence-graph relationship
Project
 ├── Candidate Sites
 │    ├── Environmental Observations
 │    ├── Site-specific Commitments
 │    └── Regulatory Screening
 │
 ├── Development Phases
 │    ├── Power Requirements
 │    └── Water Requirements
 │
 ├── Assertions
 │    ├── Supporting Documents
 │    ├── Extraction Candidates
 │    └── Verifications
 │
 └── Assessment Runs
      ├── Resource Findings
      ├── Environmental Findings
      ├── Evidence Conflicts
      └── Site Readiness Passport
Every claim should include project/site/phase scope, source, canonical unit, effective dates, provenance and a supersession relationship where applicable.
Every assessment should freeze input revisions, evidence IDs, rule-pack versions and dataset versions so historical results remain reproducible.
Important additional schema requirements
For power_commitments, store connection point, utility, quantity, MW/MVA unit, commitment stage, scope, milestone date, evidence reference and validity.
For water_commitments, store source type, allocation quantity in KLD, seasonality, connection readiness, legal/contractual status, validity, physical-delivery evidence and whether it is external supply or internal reuse.
For observations, store dataset version, period, geometry hash, method, unit, spatial resolution, coverage, quality flags and missing-data reason.
One design rule: projects can have common engineering requirements, but site-specific commitments must belong to the relevant candidate. A sanction for Site A must never be counted as available at Site B.
6. API ownership contracts
Krishna should maintain the canonical OpenAPI contract. Omar, Siddharth and Samarth should implement against that contract rather than inventing incompatible request structures.
API group	Initial endpoints	Consumer
Project	Existing /api/v1/projects	Omar
Sites	Existing project sites APIs	Omar
Phases	Existing project phases APIs	Omar
Evidence	/projects/{id}/evidence, /assertions	Omar, Samarth
Extraction	/evidence/{id}/extract, /extractions/{id}/confirm	Samarth, Omar
Resource commitments	/projects/{id}/power-commitments, /water-commitments	Omar
GIS	/sites/{id}/environmental-analysis, /analysis-jobs/{id}	Siddharth, Omar
Readiness	/projects/{id}/readiness-runs	Omar
Rules	/projects/{id}/regulatory-screening	Omar
Comparison	/projects/{id}/comparisons	Omar
Passport	/assessment-runs/{id}/passport	Omar
These new routes are proposed contracts, not implemented routes. Their concrete request/response schemas should be frozen before frontend work.
Every endpoint needs consistent authorization, validation errors, version semantics and an explicit way to represent UNKNOWN, UNAVAILABLE and NOT_APPLICABLE.
Part II — Complete data strategy
7. The four categories of EcoSite data
Siddharth should build the data roadmap around four distinct categories.
Category	Example	How EcoSite obtains it
Public geospatial observations	Sentinel-2, DEM, historical surface water	API/download and GIS processing
Official published administrative data	Groundwater assessment, state rules, policy documents	Dataset download, document curation
Project-specific developer evidence	DPR, peak power, cooling, water balance	Form entry and uploaded documents
Project-specific authority evidence	Grid sanction, water allocation, planning confirmation	Authorized/manual upload, reviewer confirmation, possible future official integrations
This is crucial because there is no single public dataset containing every site's actual power headroom, water allocation, planning approval and future environmental resilience.
The missing project-specific information is exactly why EcoSite needs a document and verification workflow.
8. Real environmental datasets — recommended integration priority
The following source documentation is publicly available. Availability of a portal does not establish that our connector has successfully authenticated, processed a candidate polygon or obtained redistribution permission. Siddharth must verify those separately.
Priority	Source	What we calculate	How to obtain it
P0	NASA SRTMGL1	Elevation, slope, relief	Authenticated tile download, clip
P0	JRC Global Surface Water	Historical water occurrence, site/buffer overlap	Versioned raster download
P0	Copernicus STAC	Scene discovery, vegetation context	STAC + authenticated processing
P0	CGWB assessments	Groundwater stress at assessment-unit level	Official published files and spatial matching
P1	NWDP groundwater	Nearby monitoring-station context	CSV/API
P1	ISRO Bhuvan	Flood/LULC corroboration	Validated WMS/WMTS
P1	CPCB/OGD AQI	Nearest monitored air quality	API/CSV, subject to availability
P1	CEA data	Regional power-system context	API/reports
P1	Census API	Historical population/community context	Published 2001/2011 aggregates
P1	OpenStreetMap	Roads, receptors, emergency infrastructure	Cached extracts/queries
P2	IMD / NRSC / local utilities	Weather, flood and specialized hazard context	Authenticated feeds, official layers or manual evidence
NASA's SRTM is approximately 30 m data; JRC's current download page lists its 1984–2024 historical water release; Copernicus documents the current STAC endpoint and authenticated openEO processing. CGWB publishes assessment-unit resource categories, while NWDP provides station observations where available. These datasets measure different things and cannot be treated as interchangeable. 

NASA Earthdata+5
Priority implementation order
Start with JRC + SRTM. They support deterministic raster calculations and create the first real environmental evidence cards.
Then implement Sentinel-2 for vegetation/site-surface context.
Then add CGWB assessment-unit context when the geographic join and dataset version are reliable.
Do not download India-wide archives. Request only candidate-site tiles and configurable buffers, cache those results and store the data source's version.
Key source limitations
Sentinel-2: NDVI can indicate vegetation conditions; it cannot determine legal land-use permission.
JRC: Historical water occurrence is not a flood return-period probability.
SRTM: Screening-level elevation is not a detailed site survey or hydrological model.
CGWB: An assessment-unit groundwater category is not a project's groundwater entitlement.
CEA: Public generation/transmission information does not establish spare MW at a particular substation. CEA does offer transmission and transformation-capacity information, but project-specific deliverability requires utility evidence. 

Central Electricity Authority
Census: Public API data mainly covers 2001 and 2011 published aggregates. It must not be labelled current 2026 population. 

Government of India
9. Siddharth's dataset roadmap deliverable
Before coding each connector, Siddharth should populate a shared data_source_registry.csv or equivalent structured registry.
Field	Why required
source_id, dataset_name, provider	Identity
official_url, exact_endpoint	Traceability
data_category	GIS, policy, authority, developer
access_method	REST, WMS, CSV, GeoTIFF, PDF, manual
authentication	Whether a key/account is needed
license, attribution, redistribution_allowed	Legal use
coverage	Geographic support
resolution, observation_period, latest_release	Scientific validity
join_key_or_geometry	How to match a candidate
test_status	Verified vs untested
fallback	Manual file, cached observation, unavailable
owner, next_action	Responsibility
A source progresses through these gates:
Discovered
Access tested
Processing tested
Validated
Integrated
One real test means: a selected candidate polygon produces an observation with a value, unit, source version, time period, coverage and processing method.
A portal link alone does not satisfy this.
10. Government and developer data requirements
This is the part where the platform becomes useful even when public APIs are incomplete.
Developer-supplied information
Category	MVP parameters
Campus	Name, type, full-buildout MW, intended site, parcel reference
Phasing	Commissioning dates, cumulative IT/facility peak MW
Power	Connection point, requested MW, sanctioned MW, grid readiness
Cooling	Air/liquid/hybrid cooling, design PUE, cooling configuration
Water	Average KLD, peak-summer KLD, source mix, internal reuse
Resilience	Backup generation, BESS, power/network redundancy
Land	Ownership/lease status, area, permitted use, planning authority
Physical	Drainage, terrain survey, access, fire and emergency plan
Social	Community, traffic, existing water users, nearby receptors
Documentation	DPR, technical studies, applications, letters, certificates
Government or authorized-reviewer information
Responsible entity	Information expected
DISCOM/STU	Sanction, capacity scope, connection/augmentation schedule, technical studies
Water provider/groundwater authority	Allocation, permitted abstraction, validity, source constraints
Planning/industrial authority	Land-use compatibility, relevant planning evidence
SPCB/other environmental authority	Relevant consent/clearance status and conditions
Fire/electrical authorities	Applicable inspections or approvals
Government investment/nodal agency	Policy eligibility or incentive status
Qualified independent specialist	Survey, hazard assessment or technical certification within scope
These are authority categories, not proof that every document is legally mandatory for every site. Applicability varies with location, project characteristics and applicable law.
The official PARIVESH system already handles formal environment, forest, wildlife and CRZ workflows; EcoSite should reference appropriate official records rather than replacing that approval process. 

India
If the government doesn't supply actual data
We do not invent it.
EcoSite should record:
NO_OFFICIAL_EVIDENCE_AVAILABLE
Then issue a finding such as:
The proposed 80 MW campus does not yet have independently established grid deliverability. Obtain the relevant utility sanction and engineering study.
For demonstrations, synthetic authority documents can illustrate the workflow, but must carry an unmistakable SYNTHETIC_DEMO label throughout the database, UI and exported report.
11. Regulatory intelligence and seven-state packs
Siddharth researches official instruments; Krishna implements the rule engine; Omar presents applicability and gaps.
Each rule needs jurisdiction, issuing authority, legal instrument type, official reference, applicability trigger, effective period, supersession, required evidence and last-review date.
The initial state plan should contain:
State	First implementation
Maharashtra	Data-centre-relevant state policy references and nodal/authority mapping
Karnataka	State data-centre policy and operational procedure references
Uttar Pradesh	2026 policy categories and applicable policy metadata
Gujarat	2026–29 policy metadata, version and instrument validity
Odisha	Published data-centre policy and responsible institutions
Tamil Nadu	Expired 2021 policy handling; verify replacement/current status
Telangana	Incomplete current standalone-policy evidence; show verification required
For example, Uttar Pradesh's official 2026 policy distinguishes data-centre parks, units and edge centres; Gujarat publishes an August 2026 policy resolution; Tamil Nadu states the applicability of its 2021 policy ended on 31 March 2026. These are useful real tests of a versioned rule engine. 

invest.up.gov.in+2
For P0, do not encode every municipal building by-law. Start with policy metadata, authority mapping, a small set of verified applicability triggers and clear local-coverage limitations.
Part III — Models, synthetic datasets and document intelligence
12. What Samarth should actually build
Samarth will own AI/ML, but we should not train a site-suitability prediction model simply to say the project uses AI.
That would require real labelled examples of Indian data-centre proposals, independently validated infrastructure conditions, regulatory outcomes and ideally long-term operational results. We do not currently have that dataset.
Instead, Samarth should build something more valuable and feasible:
EcoSite Document Intelligence — a model-assisted evidence extraction and inconsistency detection pipeline.
It will transform difficult PDF/DOCX documents into structured, reviewable data.
DPR / Utility Letter / Water Allocation
PDF, DOCX or scanned document
Text and layout extraction
Page, bounding box, text, table
Document classification and field extraction
Rules + optional trained classifier or LLM
Human confirmation
Verify proposed value, units, dates and scope
Evidence graph and conflict engine
Structured facts, supporting pages and unresolved differences
12.1 Three ML components
Component	Suggested approach	Priority
Document type classifier	TF-IDF + logistic regression or linear SVM baseline; fine-tune compact transformer only if justified	P0
Field extraction	PyMuPDF + rules/unit parsers, optionally pretrained NER or LLM structured extraction	P0
Evidence discrepancy detection	Deterministic normalization and scope-aware comparison	P0
Advanced document-layout model	LayoutLM-style model if enough labelled examples exist	P2
Site-suitability prediction	No trustworthy outcome labels yet	Defer
Flood prediction / grid-headroom prediction	Not justified by current data	Defer
Training should focus on the document classifier and, conditionally, the information extractor, not on replacing engineering or legal checks with an opaque model.
13. Creating datasets when real datasets aren't available
We should create three clearly separated data collections.
Dataset A — Synthetic project scenarios
Use a Python generator to create hypothetical data-centre campuses with controlled parameters.
Suggested development target: 300–500 synthetic scenario records.
Each record can contain:
{
  "scenario_id": "SYN-0001",
  "project_type": "AI_HPC",
  "phase_facility_mw": [20, 50, 80],
  "phase_it_mw": [15, 38, 60],
  "phase_peak_water_kld": [600, 1400, 2800],
  "declared_grid_sanction_mw": 40,
  "source_type": "SYNTHETIC_DEMO"
}
Those numbers are illustrative, not representative estimates of Indian data-centre resource requirements.
The generator should deliberately include realistic logical conditions: missing commitments, expired documents, conflicting design revisions, insufficient allocations, delayed augmentation and invalid units.
Use it to test the deterministic engines. Do not train a sustainability predictor to rediscover labels generated by your own rules and then claim it learned real-world feasibility.
Dataset B — Synthetic documents for model development
Create fictional examples of utility letters, water allocations, engineering studies and DPR extracts.
Suggested initial target:
Document class	Synthetic development examples
DPR / Engineering Study	50–75
Grid Application / Sanction	50–75
Water Requirement / Allocation	50–75
Planning / Authority Correspondence	50–75
These are planning targets, not evidence that such a dataset exists.
Generate distinct document layouts, wording, date formats, tables, revision styles and missing fields. Vary values consistently, including units such as MW/MVA and KLD/MLD.
Every synthetic document must be watermarked and machine-labelled SYNTHETIC_DEMO. Do not imitate genuine official reference numbers, signatures or seals in a way that could confuse a fictional document with a real one.
Dataset C — Real public reference documents
Siddharth supplies official public policy documents, forms, standards and legitimately available examples. Samarth turns suitable documents into a manually reviewed evaluation dataset.
Use public documents only after checking licensing, personal information and whether reuse for training is permitted.
Important: State policy PDFs are not equivalent to real utility sanctions or developer DPRs. A model trained on policy documents alone will not reliably extract information from engineering submissions.
14. Exact AI dataset structure
Samarth and Krishna should agree on this candidate-extraction format.
{
  "document_id": "doc_001",
  "document_type": "UTILITY_SANCTION",
  "page_number": 2,
  "field_key": "sanctioned_grid_mw",
  "extracted_text": "Sanctioned load: 40 MW",
  "normalized_value": 40,
  "unit": "MW",
  "phase_scope": "PHASE_1",
  "method": "RULE_BASED",
  "confidence": 0.97,
  "review_status": "PENDING"
}
The confidence here is illustrative. Actual values should come from a calibrated extraction model or documented heuristic; never invent a probability and present it as measured confidence.
Initial fields to extract
Group	Fields
Document	Type, reference, issuer, issue date, expiry
Project	Name, site, phase, document revision
Power	IT MW, facility MW, sanctioned MW, connection voltage
Water	Average KLD, peak-summer KLD, allocated KLD
Planning	Site area, permitted-use reference, relevant authority
Milestones	Commissioning date, augmentation-ready date
Start with 10–15 high-value fields, not hundreds.
15. Model-training and evaluation workflow
Step 1
Collect and classify permitted documents
Step 2
Generate synthetic training examples
Step 3
Annotate a small independent gold-standard evaluation set
Step 4
Build deterministic rules and a lightweight classifier baseline
Step 5
Train or fine-tune only if the baseline is insufficient
Step 6
Evaluate on held-out document templates and source types
Step 7
Add human review, confidence/abstention and error tracking
Step 8
Package a pinned, reproducible model artifact
Concrete training experiment
For document classification, Samarth starts with scikit-learn:
Text extraction → TF-IDF → Logistic Regression → Document Type
Then evaluates a pretrained transformer only if it materially improves classification on unseen documents.
For field extraction, the first baseline is:
Regex/units + section identification + page references
A structured LLM or pretrained extraction model can be evaluated afterward, with the same test set.
Evaluation rules
Separate train, validation and test sets by document template/family and issuer, not random pages from the same template.
Never put near-duplicate synthetic documents in both training and test data.
Evaluate on a manually annotated, non-training sample of real or legally reusable public documents where possible.
Report precision, recall and F1 for classification/extraction, plus exact normalized value accuracy, unit accuracy and page-reference accuracy.
Include scanned, low-quality, contradictory, missing-field and unfamiliar documents.
Measure latency, memory requirements and inference costs on available hardware.
Permit the model to return NOT_FOUND or NEEDS_REVIEW.
For example, an initial engineering target could be high precision for automatically proposed MW/KLD values, but no extraction should become verified evidence without human confirmation. If results are weak on genuinely unseen documents, retain the rule-based baseline and mark AI extraction experimental.
Model release stages
Release	Model capability	Recommended decision
M0	Deterministic PDF/units parser	Mandatory
M1	Lightweight document classifier	Useful first ML deliverable
M2	Optional structured LLM/pretrained extractor	Evaluate if time permits
M3	Custom fine-tuned document model	Only if sufficient labels and demonstrated improvement
M4	Site prediction models	Future research, not MVP
Samarth therefore has a meaningful AI/ML workstream even without training a large deep-learning model.
Part IV — Engineering and regulatory engines
16. Power readiness engine — Krishna
The engine should use the existing cumulative ProjectPhase records and new site-scoped power commitments.
Important distinctions:
Required facility peak MW ≠ sanctioned MW ≠ energized MW ≠ verified deliverable MW.
For each phase \(p\):
\[ \text{Gap}_p=\max(0,\text{RequiredGridMW}_p-\text{SupportedDeliverableMW}_p) \]
Supported deliverability is counted only where the evidence covers that project, candidate site, milestone, validity period and applicable network scope.
The engine should also calculate sanction coverage separately from actually deliverable capacity.
Example
Phase	Grid requirement	Verified deliverability	Unsupported amount
2027	20 MW	20 MW	0 MW
2029	50 MW	40 MW	10 MW
2032	80 MW	40 MW	40 MW
For this synthetic fixture, the verified 40 MW commitment is assumed to remain valid through the later phases. If it is Phase-1-only, that later coverage must not be assumed.
If evidence is missing, the result must distinguish unsupported by available evidence from physically unavailable grid capacity.
PUE consistency
For matched simultaneous design loads:
\[ PUE_{\mathrm{implied}}=\frac{\text{FacilityPeakMW}}{\text{ITPeakMW}} \]
For 80 MW facility peak and 60 MW IT peak, implied PUE is approximately 1.333.
If the documented design PUE is 1.20, flag the disagreement and request reconciliation of measurement boundaries and load assumptions.
Do not silently replace the developer's number.
17. Water readiness engine — Krishna
Use peak-summer requirements, not average annual consumption alone.
\[ \text{ExternalRequirement} =\max(0,\text{PeakDemand}-\text{ValidInternalReuse}) \]
\[ \text{UnsupportedWater} =\max(0,\text{ExternalRequirement}-\text{VerifiedExternalSupply}) \]
Prevent double counting of reused water, multiple allocation documents covering one source, or a proposed recycled-water connection that is not ready.
Separate water allocation coverage from environmental water stress.
A site with a fully documented supply arrangement can still have significant environmental concerns.
18. Environmental analysis engine — Siddharth + Krishna
The first provider-independent geospatial workflow should be:
Candidate Polygon
       ↓
Geometry validation
       ↓
Requested buffer and dataset coverage
       ↓
Source-specific tile/record retrieval
       ↓
Raster/vector analysis
       ↓
Observation + provenance
       ↓
Environmental finding
       ↓
Site comparison and Passport
First four observation families:
Source	MVP indicators
JRC	Water-occurrence overlap, proximity and coverage
SRTM	Elevation, slope, relief
Sentinel-2	Median NDVI, valid pixel fraction, observation date
CGWB	Assessment-unit category and publication year
Each must preserve scientific limitations.
A suitable API response structure is:
{
  "indicator": "historical_water_overlap_pct",
  "value": 8.4,
  "unit": "%",
  "source": "JRC_GSW",
  "status": "AVAILABLE",
  "evidence_class": "REMOTE_SENSING_DERIVED",
  "coverage_fraction": 0.98,
  "dataset_version": "configured_version",
  "processing_version": "1.0"
}
This is a schema illustration, not a real JRC result.
For source outages, return SOURCE_UNAVAILABLE; never substitute zero water exposure or synthetic green values.
19. Evidence conflict and regulatory engines
The evidence conflict engine is deterministic.
Example:
Source	Claim
Current engineering design	80 MW
Utility application	60 MW
Sanction	40 MW
Those quantities are not necessarily contradictory, because they may describe different milestones or commitment types.
But if two currently applicable Phase-1 engineering submissions both claim different peak requirements, the conflict engine should flag the mismatch.
For regulatory screening, implement a limited set of versioned rules with conditions such as state, effective date, campus archetype, capacity, resource source and location-specific trigger.
Use structured rule expressions, not arbitrary executable Python strings or eval.
Regulatory outputs should say POTENTIALLY_APPLICABLE, EVIDENCE_REQUIRED, VERIFIED_WITHIN_SCOPE, AUTHORITY_CONFIRMATION_REQUIRED or COVERAGE_UNAVAILABLE rather than automatically declaring a project legally compliant.
Part V — Four-member execution and collaboration plan
20. Ownership: exactly who develops what
This division is designed to let everyone work at the same time, with minimal file conflicts.
Member	Primary ownership	Coding deliverables	Research / other duties
Krishna — Technical Lead	Backend, architecture, integration	Database migrations, FastAPI, evidence graph, power/water engines, assessments	API contracts, integration gates, technical review
Siddharth — Data & GIS Lead	Datasets, source validation, GIS, state rules	GIS connectors, source registry, raster processing, rule-pack data	Dataset licensing, API keys, official documents, data-quality research
Omar — Frontend & UX Lead	Complete user interface	Developer/reviewer pages, evidence upload, resource timeline, GIS panels, comparison, Passport	User journeys, usability, browser acceptance
Samarth — AI/ML Lead	Document intelligence and model experiments	PDF parsing, document classifier, extraction pipeline, evaluation scripts	Synthetic datasets, annotations, model validation, ML documentation
Integration boundaries
Krishna ↔ Omar
Krishna provides Pydantic/OpenAPI contracts; Omar builds typed frontend clients and UI components against them.
Siddharth ↔ Krishna
Siddharth implements connector adapters and data transformations; Krishna integrates them into analysis jobs and database observations.
Samarth ↔ Krishna
Samarth's extractor returns candidate claims with document/page references; Krishna's evidence API saves only reviewed or explicitly declared assertions.
Siddharth ↔ Samarth
Siddharth provides suitable public documents and templates; Samarth builds labelled document datasets. Both track provenance and reuse permissions.
The dependency to avoid is Omar waiting for backend APIs or Samarth waiting for real documents. Agree on schemas first; both can use contract-based test fixtures while the actual implementations are built.
Part VI — Accelerated phased implementation roadmap
21. Timeline recommendation
For four reasonably available developers, I recommend a five-week execution target, beginning with the current Phase 02C closure.
This is a planning estimate assuming approximately 4–6 focused hours per person per development day, working dependencies are resolved promptly, and significant external APIs are not blocked.
Recommended five-week roadmap
Indicative execution schedule, not a promised completion date
Week 1
Integration baseline + Phase 02C + evidence contracts
Week 2
Evidence foundation + power/water engines
Week 3
Real GIS + document extraction + first ML baseline
Week 4
State packs + comparison + Passport integration
Week 5
End-to-end testing, hardening and hackathon demo
If the hackathon deadline is closer, use the minimum viable vertical slice described below and defer optional connectors, extensive regulatory coverage and custom model fine-tuning.
22. Phase-by-phase tasks for all four members
Phase A — Team synchronization and Phase 02C closure
Target: 1–2 focused days
Member	Task	Deliverable
Krishna	Verify 02c_001 on disposable DB, investigate backend/API integration, close Phase 02C	Passing phase CRUD/migration gate
Siddharth	Finalize P0 source shortlist and run first access tests	Dataset registry v1
Omar	Verify phase editor browser flow and investigate frontend test timeouts	Phase UI acceptance report
Samarth	Set up document taxonomy, labels and synthetic generator specification	ML dataset specification v1
Gate A: 02C is verified, all members agree on one Git baseline, and the next API/data contracts are reviewed.
Phase B — Evidence foundation
Target: 4–5 focused days
Member	Task	Deliverable
Krishna	Evidence/document/assertion schema, migrations, upload API, basic reviewer authorization	Persisted evidence foundation
Siddharth	Curate document categories, authority requirements and source references	Evidence requirement matrix
Omar	Document upload, assertion review and evidence-status interface	Evidence workspace
Samarth	PyMuPDF/DOCX parsing, unit normalization, page references	Baseline extraction service
Gate B: Upload a synthetic grid-sanction document, confirm its extracted 40 MW assertion, preserve the source page, and show its status without falsely claiming government verification.
Phase C — Power/water readiness and conflict detection
Target: 4–5 focused days
Member	Task	Deliverable
Krishna	Power/water commitments, deterministic engines, unit tests	Phase-wise resource readiness API
Siddharth	Utility/water authority pathways and state resource evidence categories	Official-evidence requirements
Omar	Phase-readiness timeline, gaps, evidence details	Engineering dashboard
Samarth	Conflict fixtures, normalization, extraction test set	Conflict detector input pipeline
Gate C: The system demonstrates the 20→50→80 MW phased case, correctly identifies a 40 MW supported-capacity limitation, and flags a 2.8 MLD versus 1.8 MLD water-demand/supply discrepancy.
These fixtures should test the distinction between evidence-backed commitments and actual resource availability.
Phase D — Real environmental data
Target: 5–7 focused days; some work overlaps Phase C
Member	Task	Deliverable
Krishna	Observation schema, persisted job execution, GIS API integration	Reproducible analysis-run API
Siddharth	JRC, SRTM, Sentinel and CGWB connector validation	Source-backed observations
Omar	Environmental result cards, map overlays, data-quality displays	Environmental workspace
Samarth	Data validation utilities and anomaly/missing-value test fixtures	GIS quality-evaluation support
Gate D: At least three independent real environmental indicators work for a real Indian candidate polygon, with version, coverage, date, unit and uncertainty metadata. Prefer four P0 sources, but do not fabricate a failed connector.
Phase E — Document AI/ML improvement
Target: 3–5 focused days; parallel with Phase D
Member	Task	Deliverable
Krishna	Connect reviewed extraction results to assertion API	Extraction-to-evidence integration
Siddharth	Supply permitted public templates and evaluate document-source relevance	Reference corpus
Omar	Highlight extracted fields/pages and provide correction actions	Human-review UI
Samarth	Train/evaluate classifier; compare rules vs optional advanced model	Versioned ML baseline and metrics
Gate E: Model results are evaluated against held-out documents and require human review. Unsupported documents produce NEEDS_REVIEW, not invented high-confidence claims.
Phase F — Regulatory packs, site comparison and Passport
Target: 5–7 focused days
Member	Task	Deliverable
Krishna	Rules engine, assessment snapshots, comparison logic, Passport API	Reproducible decision output
Siddharth	Five Tier-A and two Tier-B curated rule packs	Versioned regulatory content
Omar	Three-site comparison and Passport interface/export	Complete decision journey
Samarth	Extraction/conflict explanations and final evaluation	Explainable model-assisted evidence
Gate F: Compare three candidate sites across resource readiness, environmental exposure, regulatory/site readiness and evidence completeness—without an arbitrary all-purpose score.
The exported Passport must include assumptions, source versions, findings, conflicting claims and unresolved actions.
Phase G — Final validation and deployment
Target: 3–5 focused days
All four members jointly own the integrated release.
Area	Owner responsible for sign-off
API/database/security	Krishna
GIS correctness and dataset provenance	Siddharth
UX/browser/report correctness	Omar
AI evaluation and synthetic-data labelling	Samarth
Full demo and submission narrative	All four
The application should be demonstrated on a controlled environment with reproducible fixtures and cached geospatial results where live services are unreliable.
23. The fastest possible MVP — priority cutline
For a faster release, separate capabilities into three commitments:
Priority	Must contain	Decision
P0 — Hackathon-critical	Persistent project/sites/phases, evidence upload, power/water gaps, 2–3 real GIS indicators, basic state-rule screening, comparison, Passport	Build first
P1 — Strong differentiation	Automated document extraction, conflict intelligence, four GIS sources, seven-state packs, provenance-rich dashboards	Build in parallel where possible
P2 — Later	Fine-tuned large document model, live utility APIs, all municipal rules, advanced forecasts, public government portal, nationwide detailed spatial analysis	Defer
The P0 demo should work even if the AI classifier is unavailable. The core decision logic must remain deterministic.
Part VII — GitHub collaboration system
24. One shared Git baseline
The latest audit reports:
Current krishna_updated and tracked remote refs at 0d19f0d.
A stale local master.
An older stash containing potentially overlapping work.
A clean working tree at the time of that audit.
The team should agree that one remote integration branch is authoritative—preferably master if everyone accepts it—and use separate feature branches for development.
Before doing this, verify the latest remote state with Git. The audit reflects one moment in time, and the repository could have advanced since then.
Proposed branch conventions
Member	Branch examples
Krishna	feature/evidence-backend, feature/resource-engine
Siddharth	feature/gis-connectors, feature/state-rule-packs
Omar	feature/evidence-frontend, feature/passport-ui
Samarth	feature/document-intelligence, feature/ml-evaluation
Use a pull-request workflow:
Feature branch from agreed integration HEAD
Small bounded implementation
Tests and self-review
Pull request with changed contracts and test evidence
Teammate approval and merge
Essential collaboration rules
No direct feature pushes to the integration branch.
No force-pushing shared history.
One primary owner per module/file group.
Migrations are sequential and reviewed by Krishna.
API/schema changes are agreed before Omar builds dependent UI.
Do not commit actual PDFs containing confidential information, real API credentials, .env files, databases or model training data with unclear licences.
Do not apply the old stash blindly; inspect its overlap with committed work.
Every PR includes tested commands, actual results and known limitations.
A lightweight GitHub Actions CI workflow should run frontend lint/tests/build and backend tests on pull requests. Initially, local Windows regression testing can supplement CI because the team has already encountered Windows-specific SQLite lifecycle problems.
25. Shared project documentation
Create a small, authoritative set of files instead of four independent planning documents.
File	Owner	Purpose
docs/implementation/MASTER_PLAN.md	Krishna	Frozen roadmap and scope
docs/implementation/TEAM_TASKS.md	Krishna	Current sprint owners/status
docs/contracts/API_CONTRACTS.md	Krishna	APIs, payloads, units, errors
docs/data/DATA_SOURCE_REGISTRY.csv	Siddharth	Source access and provenance
docs/data/REGULATORY_MATRIX.csv	Siddharth	State rules and authorities
docs/ml/MODEL_PLAN.md	Samarth	Datasets, experiments, metrics
docs/ux/USER_JOURNEYS.md	Omar	Developer/reviewer/report workflows
docs/implementation/ACCEPTANCE_TESTS.md	Shared	Integration release gates
These are proposed paths; check for equivalent existing files before creating duplicates.
Task-board conventions
Every task should identify owner, phase, dependencies, input contract, deliverable and acceptance test. Use GitHub Issues/Projects or a shared tracker.
Example issue
P03-BE-04 — Add evidence assertion APIs
Owner: Krishna
Priority: P0
Dependency: Evidence schema
Acceptance: a reviewed 40 MW Phase-1 assertion can be saved with document reference, retrieved after restart and rejected with a 409 on stale revision. Unauthorized users cannot access it.
Daily communication
A 15-minute team sync should answer three questions: what merged since yesterday, what each member will deliver next, and what dependency is blocking another person.
Two integration points per week should be enough initially: one for API/schema changes and one for end-to-end workflow acceptance.
Part VIII — Verification, risks and final demonstration
26. Release acceptance tests
These are cross-team tests—not just individual module tests.
Scenario	Required result
User defines 20→50→80 MW development phases	Cumulative demand calculated correctly
Sanction covers only an earlier phase	Not automatically applied to unrelated scope
Source lacks verified deliverability	Show unsupported/unknown, not confirmed capacity
Proposed recycled water is uncontracted	Excluded from verified supply
Groundwater dataset is unavailable	Unknown, not low environmental risk
Two current DPRs conflict	Preserve both and flag inconsistency
AI extracts wrong MW value	Reviewer can correct it; original text preserved
Uploaded utility letter is unverified	Cannot become authority-verified automatically
State policy is expired	Current applicability flagged for review
Candidate site changes	Dependent assessment becomes stale
GIS provider fails	Controlled unavailable state, no fake observations
Three-site comparison	Explains tradeoffs without arbitrary overall score
Passport regenerated from saved run	Same frozen results and provenance
Unauthorized reviewer accesses evidence	Access denied
Synthetic document enters report	Clearly identified as demonstration evidence
Also test tampered documents, inappropriate file types, invalid polygons, units and dates, missing references, failed analysis jobs and report redaction.
27. Major implementation risks
Risk	Impact	Mitigation
External GIS API access fails	Environmental analysis blocked	Cache/versioned sample observations; alternative source; explicit unavailable state
Government evidence unavailable	Verification cannot complete	Manual input and simulated reviewer workflow
Real training documents insufficient	ML quality unreliable	Deterministic baseline, small gold set, optional pretrained model
Team merges incompatible code	Integration failures	Frozen contracts, PRs, CI
Too much functionality attempted	Unfinished hackathon MVP	P0 cutline and weekly demos
State regulations change	Incorrect applicability	Versioned instruments, review dates and uncertainty
Sensitive infrastructure documents leak	Serious confidentiality concern	Access controls, private storage, redaction
Local SQLite deployment expands to many users	Data-concurrency and authorization risks	Keep MVP local; migrate to PostgreSQL/PostGIS for broader deployment
The success of the architecture does not depend on every dataset or government API becoming accessible. Missing information is a legitimate output of EcoSite.
28. Final hackathon demonstration
One integrated scenario should carry the whole submission.
Demonstration: Proposed 80 MW AI/HPC Campus
Fictional development project on real Indian geography; source-backed environmental data and clearly labelled synthetic project documents.
2027
20 MW
2029
50 MW
2032
80 MW
What the judge sees
A real polygon-based environmental screen, a documented power ramp-up limitation, an unresolved water allocation, two contradictory document figures, applicable state-policy references and an evidence-backed comparison across three alternative sites.
The final Passport says what is supported, what remains uncertain and what evidence is needed next.
This demonstrates the actual differentiation:
Not just where a data centre might be placed, but what the proposed campus can substantiate before investment—and what still needs verification.
Part IX — Exactly what each member should do now
29. First 48-hour assignment
Rather than asking everyone to work on the entire plan at once, give each member one tightly scoped task immediately.
Four parallel starting tasks
Recommended next actions
Krishna — Project baseline and evidence API design
Close the pending Phase 02C acceptance checks, verify the Git integration baseline, and prepare the exact evidence database/API contract for the next PR. Do not begin a large backend rewrite.
Copy task
Siddharth — Dataset and regulatory source registry
Produce a tested P0 dataset matrix for JRC, SRTM, Sentinel-2 and CGWB, including actual access, processing feasibility, licences and fallbacks. Prepare seven-state source references and a preliminary evidence-document taxonomy.
Copy task
Omar — Frontend user journeys and Phase 02C acceptance
Check the current phase editor, resolve or isolate frontend timeout failures, and design the developer and reviewer evidence interfaces against proposed typed contracts. Use fixture data until APIs are approved.
Copy task
Samarth — Document AI baseline and synthetic data design
Define the document taxonomy and annotation schema, implement a safe synthetic-document generator prototype and evaluate deterministic PDF/units extraction. Decide whether model training has sufficient usable labels.
Copy task
30. The first team alignment meeting
Before coding the evidence engine, all four members should approve five artifacts:
Artifact	Who prepares	What the meeting decides
Current repository baseline	Krishna	Exact integration HEAD and branch rules
Phase 02C closure report	Krishna + Omar	Whether Phase 02 is genuinely complete
Dataset/source registry	Siddharth	Which real GIS sources are P0 and actually usable
Evidence API/schema	Krishna, reviewed by all	Exact field names, units, scope, statuses
ML/document dataset schema	Samarth, reviewed by Siddharth	Synthetic vs real data, labels, evaluation and review
Once those contracts are approved, the next development sprint can begin with Krishna implementing the evidence backend, Omar the evidence UI, Samarth the extraction pipeline, and Siddharth the first real GIS connector.
No one has to wait for another member's complete module before starting.
Final direction
We should adopt this sequence as the team's single implementation roadmap:
Stabilized repository + project/site/phase foundation
Close Phase 02C and freeze shared contracts
Evidence database and document workflow
Power/water readiness + conflict detection
Real GIS integration + evaluated document AI
Seven-state rule screening + three-site comparison
Reproducible Passport + final integration demo
The most important recommendation: Don't let ML training, satellite APIs or seven-state legal research block the fundamental evidence and resource-readiness workflow. Those workstreams can proceed simultaneously, but the first finished version must already connect the developer's full-campus requirements with traceable evidence, deterministic calculations and clear unknowns.
That is the feasible, distinctive product we have been working toward throughout the research—and the structure that lets Krishna, Siddharth, Omar and Samarth deliver it together without repeatedly changing direction.