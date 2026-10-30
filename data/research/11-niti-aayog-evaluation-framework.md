The research supports a ministry-grade platform with two connected dashboards: national operational oversight and new-site planning. The official NITI Aayog framework organizes evaluation around power, water, environmental siting, economic value, and governance, while requiring consistent reporting of PUE, WUE and CUE. NITI Aayog Data Centre Evaluation Framework

## 1. National overview

The ministry should immediately see:

- Total registered, operational, under-construction and proposed data centres
- State, district, city, operator and ownership
- Colocation, hyperscale, enterprise, edge or AI/HPC classification
- Installed IT capacity and total sanctioned electrical load
- Current IT load, facility load and utilization
- Planned capacity and commissioning timeline
- Total electricity and water consumption
- Renewable-energy share
- Estimated operational emissions
- Compliance, incident and data-quality status
- Sites operating close to power, water or environmental limits
- Cumulative demand by city, watershed and electrical grid zone

Filters should include state, operator, facility type, status, capacity, watershed, DISCOM, risk level and compliance state.

## 2. Live operational parameters

### Power and energy

Collect every 5–15 minutes:

- IT equipment load, kW/MW
- Total facility load
- Cooling-system load
- UPS, transformer and distribution losses
- PUE: total facility energy divided by IT energy
- Grid import and export
- Sanctioned load and peak-demand utilization
- Renewable energy consumed, generated and contracted
- Battery/storage capacity, charge state and usable duration
- Generator runtime, fuel consumed and test events
- Power interruptions, voltage, frequency and power quality
- Feeder availability and redundancy status
- Carbon intensity of consumed electricity
- Energy consumed per compute/workload unit where comparable
- Demand forecast for the next hour, day, month and project phase

BEE already provides data-centre energy-efficiency guidance covering electrical systems, UPS loading, cooling, IT equipment, and operations. BEE data-centre efficiency guidance

### Water and cooling

Collect at 5–60 minute intervals:

- Freshwater intake by source
- Treated wastewater/recycled-water intake
- Groundwater abstraction
- Rainwater harvested and used
- Cooling-tower make-up and blowdown
- Water discharged
- Water reused internally
- WUE: water consumed relative to IT energy
- Cooling technology and operating mode
- Chiller efficiency and cooling-system energy
- Supply/return temperatures and temperature differential
- Leak detection and abnormal consumption
- Daily allocation, consent or abstraction-limit utilization
- Peak-summer demand compared with approved supply
- Water storage and autonomy
- Water quality where relevant
- Wastewater quantity, treatment status and discharge quality

Government guidance specifically requires consideration of freshwater availability, water balance, greywater generation, recycling and reuse; groundwater extraction is separately regulated. MoEFCC parliamentary response

### Carbon, pollution and waste

Collect continuously or monthly:

- Scope 1 emissions: generators, refrigerants and facility fuel
- Scope 2 location- and market-based emissions
- CUE
- Refrigerant type, inventory and leakage
- Generator NOx, SOx and particulate emissions where monitored
- Ambient PM2.5, PM10, NO₂, SO₂, CO and ozone
- Boundary noise levels
- E-waste generated, stored and transferred
- Battery waste
- Hazardous waste, used oil and chemical waste
- Recycling/recovery rate
- Authorized recycler and disposal manifests
- Embodied carbon for new construction, when available

CPCB provides hourly ambient-air monitoring and AQI infrastructure, although station distance and coverage must always be shown. CPCB monitoring system

### Reliability and public safety

- Cooling, electrical, fire and water incidents
- Service-impacting outage duration
- Fire-alarm and suppression-system status
- Generator and UPS autonomy
- Critical equipment alarms
- Flood, heatwave, heavy-rain and lightning warnings
- Cybersecurity incident severity—without exposing operational security details
- Emergency-response status
- Recovery time and recovery point objectives
- Last disaster-recovery exercise
- Open corrective actions

IMD now exposes official APIs for current weather, forecasts, rainfall, heatwaves, district warnings and automated weather stations. IMD API reference

## 3. New-site planning parameters

Site evaluation should not begin with a weighted score. It should use three stages:

Legal/environmental exclusions
            ↓
Resource and infrastructure feasibility
            ↓
Comparative sustainability and public-value score

### Hard exclusion or mandatory-review layers

- Protected areas
- Notified eco-sensitive zones and areas
- Wildlife corridors and critical habitats
- Forest land and required forest clearance
- Wetlands and regulated buffers
- Rivers, lakes, drains and floodways
- Coastal Regulation Zone classification
- Legally prohibited land-use categories
- High-risk flood zones
- Unstable slopes and severe erosion
- Land ownership or title conflicts
- Airport, defence or hazardous-industry restrictions
- Sites lacking an achievable power or lawful water pathway

ESZ boundaries are site-specific and include protected-area boundaries, biodiversity, villages, coordinates, prohibited activities and regulated activities. A generic nationwide buffer must not replace the actual notification. MoEFCC ESZ guidance

### Biodiversity and ecosystem impact

- Distance and overlap with protected areas and ESZs
- Habitat type and natural vegetation cover
- Forest fragmentation
- Wildlife corridors
- Endemic, rare, threatened and migratory species
- Wetland and riparian habitat
- Change in vegetation and surface-water extent
- Night-light impact
- Construction footprint
- Compensatory mitigation requirements
- Biodiversity survey date, season and confidence
- Cumulative impact from nearby projects

### People and community impact

- Population within 1, 5, 10 and 25 km
- Nearby settlements, schools and hospitals
- Vulnerable and low-income communities
- Existing household water access
- Competing agricultural and industrial water demand
- Land acquisition and displacement
- Local air and noise burden
- Construction traffic
- Employment created by skill category
- Public grievances and resolution time
- Community consultation and consent records where applicable
- Effect on municipal services and infrastructure

### Water suitability

- River basin and watershed
- Basin-level water stress
- Groundwater assessment-unit category
- Historical groundwater trend
- Surface-water reliability
- Municipal and industrial allocations
- Treated wastewater availability and pipeline distance
- Seasonal supply and drought history
- Existing public demand
- Project demand under average and peak-summer conditions
- 20–30-year water balance
- Allocation or NOC status
- Alternative cooling scenarios
- Climate-change sensitivity

### Power readiness

- Nearest substation and voltage
- Verified available headroom—not merely distance
- Day-one sanctioned capacity
- Full-campus ultimate demand
- Feeder and transformer constraints
- Dual-feed feasibility
- Planned grid augmentation and delivery dates
- Renewable supply potential
- Transmission congestion
- Grid reliability and interruption history
- Storage requirements
- Grid carbon intensity
- Phase-by-phase demand ramp
- Responsible utility and documentary evidence

### Land, hazard and climate suitability

- Parcel geometry and usable area
- Current and permitted land use
- Elevation, slope and drainage
- 25-, 50-, 100- and preferably 500-year flood exposure
- Historical surface-water occurrence
- Urban flooding and drainage capacity
- Heat extremes and wet-bulb conditions
- Drought
- Cyclone, wind and lightning exposure
- Seismic zone and liquefaction
- Soil and geotechnical suitability
- Wildfire where applicable
- Sea-level rise and coastal erosion
- Climate projections across the asset lifetime

Bhuvan provides official Indian thematic layers for land use, urban sprawl, water bodies, erosion and flood hazard through interoperable map services. NRSC Bhuvan thematic data

### Connectivity and city infrastructure

- Carrier and fibre-route diversity
- Internet exchange and cable-landing proximity
- Road access and construction logistics
- Emergency-service response time
- Workforce and technical-skills availability
- Housing and transport pressure created by development
- Municipal water, sewer and solid-waste capacity
- Nearby renewable generation and industrial symbiosis
- Potential use of waste heat
- Expansion capacity without cumulative harm

## 4. Compliance and governance

Each facility needs a digital compliance register containing:

- Land and building approvals
- Environmental clearance applicability/status
- Consent to Establish and Consent to Operate
- Groundwater NOC
- Water-allocation agreement
- Fire and electrical inspector approvals
- Generator and fuel permissions
- E-waste and hazardous-waste authorizations
- Renewable/open-access agreements
- Sanctioned electrical load
- Approved environmental conditions
- Inspection history
- Violations, notices and corrective actions
- Approval expiry dates
- Incentive commitments and achieved milestones
- Responsible ministry, state authority, operator and verifier
- Cryptographic document hash and revision history

Sensitive customer, network, resilience and security information should be withheld from public views, consistent with the NITI framework.

## 5. City-planning indicators

The platform should aggregate facility data into city and regional impacts:

- Data-centre electricity as a share of city and grid demand
- Data-centre water as a share of available industrial and municipal supply
- Peak simultaneous power and water demand
- Basin and substation carrying capacity
- Renewable-energy additionality
- Total emissions and avoided emissions
- Waste heat available for productive reuse
- E-waste and battery-processing capacity
- Green-cover and habitat change
- Floodplain and drainage encroachment
- Jobs, investment and local procurement
- Public-service impacts
- Approved versus actually delivered capacity
- Future 5-, 10- and 20-year scenarios

## 6. Data architecture

A practical architecture is:

- PostgreSQL/PostGIS: facilities, sites, permits, boundaries and spatial analysis
- Time-series database: telemetry, meters, alarms and operational KPIs
- Object storage: permits, surveys, reports and immutable raw source snapshots
- Event/message layer: incoming telemetry and alerts
- Analytics warehouse: state/city trends, forecasts and policy reporting
- API gateway: ministry, operator and authority integrations
- Identity and audit system: ministry, state, regulator, operator and public roles

Every value must retain source, timestamp, unit, measurement boundary, quality status, verification state and lineage.

## 7. Dashboard structure

The frontend should have seven main workspaces:

1. National Command Overview
2. Live Facility Operations
3. Map and Environmental Intelligence
4. New-Site Planning
5. Water and Energy Planning
6. Compliance and Evidence
7. City Scenarios and Public Reporting

“Real time” should be labelled precisely:

- Telemetry: seconds to 15 minutes
- Weather and air quality: hourly
- Utility allocations and compliance: event-driven or monthly
- Satellite observations: days to weeks
- Groundwater and biodiversity: seasonal or annual
- Policy documents: whenever officially revised

The next design artifact should be a formal Ministry Parameter Registry defining every field, formula, unit, source authority, refresh frequency, sensitivity level, validation rule and responsible party. That registry should become the shared contract for the UI, APIs, databases and operator reporting system.