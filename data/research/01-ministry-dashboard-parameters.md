# Ministry Dashboard Parameter Registry - Research Draft

Status: research baseline, not a final regulatory reporting standard.

Initial data boundary: public information plus operator-submitted registration
records. Private operational telemetry is out of scope until a lawful reporting
policy and integration mechanism exist.

Facility inclusion rule: include every physically existing facility in the four
target states whose existence and location have been publicly disclosed,
regardless of private, government or other ownership, only after its current
operational status is supported by an acceptable source. Track ownership as a
field, not as an inclusion criterion. Exclude proposed, announced,
land-secured and under-construction facilities from the public dashboard and
all public totals.

Operational verification expires after 90 days. A ministry reviewer must
recheck an accepted credible source at least once every three months. When the
verification expires, the public snapshot is automatically withheld until the
facility is reconfirmed; expiry does not assert that the facility has closed.

Primary national reference: NITI Aayog's 2026 Data Centre Evaluation Framework,
which groups evaluation under Power and Energy; Water and Cooling; Siting and
Environmental Sustainability; Economic and Strategic Value; and Policy,
Governance and Implementation.

Source: https://www.niti.gov.in/node/2443

## 1. Facility registry

| Parameter | Unit/type | Frequency | Evidence owner |
|---|---|---|---|
| Facility, campus and operator ID | UUID/registry ID | On change | Ministry/operator |
| Name, address and coordinates | text/geometry | On change | Operator/local authority |
| State, district, city, watershed and grid zone | reference IDs | Derived/on change | Government GIS |
| Facility type | hyperscale/colo/enterprise/edge/AI-HPC | On change | Operator |
| Ownership category | private/government/PPP/other/unknown | On change | Public source/operator |
| Lifecycle state | proposed/approved/construction/operational/suspended/closed | On change | Ministry |
| Installed IT capacity | MW | Monthly/on expansion | Operator/verifier |
| Sanctioned electrical load | MW/MVA | On approval change | DISCOM/STU |
| Land parcel and campus boundary | GeoJSON/PostGIS | On change | Land authority |
| Commissioning and expansion phases | dates and MW | On change | Operator/ministry |
| Certifications and audit status | references | On renewal | Certifier/ministry |

### Operator registration fields

- Legal operator name, registration identifier and authorised contact
- Facility/campus name and public website
- Facility type and lifecycle state
- Map point and, when available, campus polygon
- Postal address, state, district and local authority
- Publicly disclosed installed/planned IT capacity
- Publicly disclosed sanctioned/contracted power, when evidenced
- Cooling type and declared water source
- Commissioning date and expansion phases
- Public permits, certifications and source documents
- Consent to publication and declaration of accuracy
- Submission timestamp, revision and reviewer status
- Operational verification date, verifier, source and 90-day expiry date

### Location publication policy - decided

- Operators submit the exact facility point and, where available, campus polygon.
- Exact submitted geometry is restricted to authorised ministry reviewers.
- Ministry users may see exact geometry after review, subject to role and audit controls.
- The public map shows only a locality-level or deliberately generalised position.
- Public coordinates must be stored separately from restricted geometry so a
  frontend or API mistake cannot expose the exact location.
- Public responses expose locality, district and state plus an explicit
  `location_precision` value such as `LOCALITY` or `DISTRICT`.
- The public marker must never be presented as a parcel boundary.

Registration states: `DRAFT`, `SUBMITTED`, `NEEDS_INFORMATION`, `REGISTERED`,
`VERIFIED`, `SUSPENDED` and `CLOSED`. `REGISTERED` means the record was accepted
into the registry; `VERIFIED` requires ministry or authority evidence.

### Registration publication workflow - decided

1. `DRAFT`, `SUBMITTED` and `NEEDS_INFORMATION` records are private to the
   submitting operator and authorised ministry reviewers.
2. Ministry review checks duplicates, facility existence, public sources,
   ownership declaration, location and required evidence.
3. Only an approved `REGISTERED` or `VERIFIED` record may enter the public API.
4. The public record contains only approved fields and generalised geometry.
5. Rejected, withdrawn, incomplete and duplicate records never appear publicly.
6. Later operator revisions return changed fields to review; the last approved
   public revision remains visible until the new revision is approved.

## 2. Live power and energy

Target interval: 5-15 minutes for meters; event-driven for alarms and outages.

- IT equipment power (kW/MW)
- Total facility power
- Cooling power
- UPS, transformer and distribution losses
- PUE using a declared and consistent measurement boundary
- Grid import/export and peak demand
- Sanctioned-load utilisation
- Renewable electricity consumed, generated and contracted
- Renewable matching period and additionality evidence
- Battery capacity, state of charge and available runtime
- Generator status, runtime, fuel consumption and test events
- Feeder status, redundancy and transfer events
- Voltage, frequency, harmonics and power-quality exceptions
- Grid interruption duration and frequency
- Energy per comparable compute/workload unit, where meaningful
- Location-based and market-based electricity emissions
- Forecast demand by hour, day, month and project phase

The Bureau of Energy Efficiency's Indian data-centre guidance covers electrical
systems, UPS loading, cooling, IT equipment and operational efficiency.

Source: https://beeindia.gov.in/sites/default/files/datacenterbook.pdf

## 3. Water and cooling

Target interval: 15-60 minutes for flow meters; daily/monthly regulatory rollup.

- Freshwater intake by source
- Surface, municipal, industrial and groundwater quantities kept separate
- Recycled/treated wastewater intake
- Rainwater captured and used
- Cooling-tower make-up and blowdown
- Water consumed, discharged and reused internally
- WUE with the same reporting boundary across design and operation
- Cooling technology and active operating mode
- Chiller/cooling-system efficiency and cooling energy ratio
- Supply/return temperature, delta-T and wet-bulb conditions
- Leak and abnormal-consumption events
- Approved allocation or NOC quantity and utilisation
- Peak-summer demand and supply margin
- Storage volume and autonomy
- Wastewater treatment and discharge quality
- 20-30 year seasonal water balance for proposed projects
- Impact on public supply and competing agricultural/industrial demand

MoEFCC states that large building/township projects may require environmental
clearance and that freshwater availability, water balance, greywater,
recycling and reuse must be considered. Groundwater extraction is regulated
separately.

Source: https://www.pib.gov.in/PressReleasePage.aspx?PRID=2295675&lang=1&reg=3

## 4. Carbon, pollution and circularity

- CUE and total Scope 1/Scope 2 emissions
- Generator fuel combustion and runtime
- Refrigerant inventory, global-warming potential and leakage
- PM2.5, PM10, NO2, SO2, CO and ozone at relevant monitoring locations
- Boundary noise, day/night limits and exceedances
- E-waste generated, stored, reused and transferred
- Battery and hazardous waste quantities
- Used oil, chemicals and disposal manifests
- Authorised recycler details and recovery rate
- Embodied carbon for new construction where available
- Waste heat quantity, temperature and feasible reuse destination

## 5. Reliability, safety and resilience

- Availability and service-impacting outage minutes
- Cooling, electrical, fire, flood and water incidents
- UPS, generator and water autonomy
- Critical alarms and unresolved corrective actions
- Fire detection/suppression status and inspection date
- IMD heatwave, heavy-rain, cyclone, wind and lightning warnings
- Flood response and emergency operating status
- Recovery-time and recovery-point objectives
- Disaster-recovery site and exercise date
- Seismic, cyclone, heat, drought, flood and coastal exposure
- Cybersecurity incident severity, with sensitive details restricted

## 6. New-site hard constraints

These are gates, not weighted preferences. A failed gate either rejects the
site or sends it to a legally defined manual-review path.

- Protected areas and their notified Eco-Sensitive Zones
- Eco-Sensitive Areas and wildlife corridors
- Forest land and required forest clearance
- Wetlands, waterbodies and applicable buffers
- Coastal Regulation Zone category and clearance applicability
- Floodways and legally prohibited flood-risk areas
- Prohibited land use or unresolved title/encumbrance
- Airport, defence and hazardous-industry restrictions
- Infeasible lawful water supply
- Infeasible power-sanction/augmentation pathway
- Unacceptable displacement or community impact

MoEFCC explains that ESZ notifications contain site-specific boundaries,
biodiversity, villages, coordinates and prohibited/regulated activities.
Actual notifications must be used; a generic buffer is not a legal substitute.

Sources:

- https://moef.gov.in/eco-sensitive-zone-esz?lang=en
- https://moef.gov.in/esz-notifications
- https://moef.gov.in/esa-notifications

## 7. Comparative site-suitability parameters

### Biodiversity

- Protected/ESZ overlap and distance
- Habitat type, natural vegetation and fragmentation
- Endemic, rare, endangered and threatened species
- Wildlife corridors and migratory routes
- Wetland/riparian habitat
- Seasonal survey coverage and confidence
- Construction footprint, lighting and cumulative impact
- Avoidance, restoration and mitigation obligations

### People and public interest

- Population within 1, 5, 10 and 25 km
- Settlements, schools, hospitals and vulnerable communities
- Existing household water access and competing demand
- Land acquisition, livelihoods and displacement
- Existing pollution burden
- Construction traffic and public-service pressure
- Local jobs by skill category and local procurement
- Consultation, grievance and resolution records

### Water suitability

- Watershed/river basin and basin water stress
- Groundwater assessment-unit category and historical trend
- Surface and municipal supply reliability
- Treated-water source and pipeline distance
- Drought history and climate sensitivity
- Peak-summer demand, allocation margin and full-campus water balance

### Power readiness

- Verified substation headroom, not distance alone
- Day-one sanction and ultimate campus demand
- Voltage level, feeder limits and dual-feed feasibility
- Augmentation scope, owner, funding and delivery date
- Interruption history and grid congestion
- Renewable procurement and storage feasibility
- Phase-by-phase load ramp and grid carbon intensity

### Land and hazard

- Parcel geometry, usable area, land use and title status
- Elevation, slope, drainage and soil/geotechnical conditions
- Flood return-period exposure and historical inundation
- Heat, drought, cyclone, lightning, seismic and liquefaction risk
- Sea-level rise and coastal erosion where applicable
- Road access, emergency response and construction logistics

### Connectivity and city systems

- Carrier and fibre-route diversity
- Internet exchange/cable-landing proximity
- Municipal water, sewer and waste capacity
- Workforce, housing and transport pressure
- Expansion headroom and cumulative cluster impact
- Potential industrial symbiosis, including waste-heat use

## 8. Compliance and evidence

- Environmental-clearance applicability and status
- Consent to Establish and Consent to Operate
- Groundwater NOC and water-allocation agreement
- Land/building approval and occupancy certificate
- Fire, electrical inspector and generator approvals
- E-waste and hazardous-waste authorisations
- Renewable/open-access agreements
- Approved load, water and environmental conditions
- Inspection, violation, notice and corrective-action history
- Expiry dates and renewal workflow
- Incentive commitments and achieved milestones
- Document issuer, version, hash, validity and verification status
- Responsible operator, authority and verifier for every condition

## 9. City and state planning indicators

- Data-centre electricity as a share of city/grid demand
- Data-centre water as a share of lawful available supply
- Peak coincident demand and projected 5/10/20-year demand
- Substation, transmission, watershed and sewer carrying capacity
- Renewable additionality and total emissions
- Cumulative biodiversity and floodplain pressure
- Jobs, investment, incentives and verified public value
- Approved versus commissioned/delivered capacity
- Scenario comparison: unconstrained growth vs resource-safe growth

## 10. Data-quality fields required for every measurement

- Source organisation and exact endpoint/document
- Observation, retrieval and publication timestamps
- Unit and measurement boundary
- Dataset, parser and processing versions
- Geometry/join method and spatial resolution
- Coverage fraction and quality flags
- Evidence class and verification status
- Raw snapshot reference and SHA-256
- Missing-data reason and expiry/refresh date
- Operational-status verification and its 90-day publication expiry
- Sensitivity classification and permitted audiences
- Location precision and public/restricted geometry classification

## 11. Public-data publication rule

Every displayed field must show one of these origins:

- `PUBLIC_OFFICIAL` - published by a government or statutory authority
- `PUBLIC_OPERATOR` - published by the data-centre operator
- `OPERATOR_DECLARED` - submitted through registration but not independently verified
- `GOVERNMENT_VERIFIED` - checked against authority evidence
- `DERIVED` - calculated from identified public inputs
- `UNKNOWN` - not publicly available

Accepted operational evidence may come from government, regulators, operators,
stock-exchange/company filings, recognised certification bodies, established
news organisations or reputable specialist industry publications. Each field
must retain the source class and review status; credible reporting does not become
government verification.

No numeric confidence score is required for the prototype. Public pages show
the source, publisher, date and relevant provenance label. Ministry review uses
the evidence hierarchy and workflow state rather than a computed percentage.

The application must not estimate a missing capacity, water allocation, PUE,
WUE or compliance result merely to fill the dashboard.

