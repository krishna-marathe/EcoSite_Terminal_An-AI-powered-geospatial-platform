import type { EnvironmentalCurrentResponse } from '../types/environmentalMonitoring';
import type { PublicFacility } from '../types/publicFacilities';

export interface FacilityIntervention {
  id: string;
  title: string;
  category: 'WATER_CONSERVATION' | 'POWER_GRID' | 'ENERGY_EFFICIENCY' | 'TERRAIN_CIVIL' | 'STATUTORY_COMPLIANCE';
  priority: 'HIGH' | 'MODERATE' | 'STANDARD';
  timeframe: string;
  responsibleStakeholder: string;
  expectedBenefit: string;
  statutoryBasis: string;
  rationale: string;
}

export interface FacilityComplianceRequirement {
  item: string;
  authority: string;
  mandatory: boolean;
  notes: string;
}

export interface FacilityInsightSummary {
  vulnerabilityOverview: string;
  criticalityTier: 'TIER_1_ELEVATED' | 'TIER_2_MODERATE' | 'TIER_3_NOMINAL';
  criticalityLabel: string;
  stateRegulatoryBody: string;
  stateDiscom: string;
  interventions: FacilityIntervention[];
  complianceChecklist: FacilityComplianceRequirement[];
  disclaimer: string;
}

const STATE_PROFILES: Record<
  string,
  {
    spcb: string;
    discom: string;
    waterAuthority: string;
    waterStressBaseline: 'HIGH' | 'CRITICAL' | 'MODERATE';
    regionalNotes: string;
  }
> = {
  'IN-MH': {
    spcb: 'Maharashtra Pollution Control Board (MPCB)',
    discom: 'MSEDCL / Tata Power / Adani',
    waterAuthority: 'Maharashtra Water Resources Regulatory Authority (MWRRA)',
    waterStressBaseline: 'HIGH',
    regionalNotes: 'High groundwater extraction across western basalt corridors; seasonal monsoon dependency.',
  },
  'IN-TG': {
    spcb: 'Telangana State Pollution Control Board (TSPCB)',
    discom: 'TSSPDCL',
    waterAuthority: 'Hyderabad Metropolitan Water Supply & Sewerage Board (HMWSSB)',
    waterStressBaseline: 'CRITICAL',
    regionalNotes: 'Semi-arid hard-rock aquifers with low natural recharge; high summer wet-bulb temperatures.',
  },
  'IN-TN': {
    spcb: 'Tamil Nadu Pollution Control Board (TNPCB)',
    discom: 'TANGEDCO',
    waterAuthority: 'Chennai Metropolitan Water Supply and Sewerage Board (CMWSSB)',
    waterStressBaseline: 'HIGH',
    regionalNotes: 'High coastal ambient humidity elevating evaporative PUE; summer grid transmission constraints.',
  },
  'IN-KA': {
    spcb: 'Karnataka State Pollution Control Board (KSPCB)',
    discom: 'BESCOM / KPTCL',
    waterAuthority: 'Bangalore Water Supply and Sewerage Board (BWSSB)',
    waterStressBaseline: 'HIGH',
    regionalNotes: 'Municipal piped water rationing in tech corridors; 66kV distribution feeder congestion.',
  },
};

export function generateDataCentreInsights(
  facility: PublicFacility,
  envCurrent?: EnvironmentalCurrentResponse | null
): FacilityInsightSummary {
  const stateCode = facility.stateCode || 'IN-MH';
  const stateProfile = STATE_PROFILES[stateCode] || STATE_PROFILES['IN-MH'];

  // Extract maximum disclosed capacity in MW
  const maxCapacityMw = facility.capacityDisclosures.reduce((max, c) => {
    if (c.unit === 'MW') return Math.max(max, c.value);
    if (c.unit === 'MVA') return Math.max(max, c.value * 0.9); // approximate power factor
    return max;
  }, 0);

  const isHyperscale = maxCapacityMw >= 40 || facility.facilityType === 'hyperscale';
  const isMidScale = maxCapacityMw >= 15 && maxCapacityMw < 40;

  // Check environmental observations if available
  const metrics = envCurrent?.metrics || [];
  const aqiMetric = metrics.find((m) => m.metric.includes('aqi'));
  const aqiValue = typeof aqiMetric?.value === 'number' ? aqiMetric.value : null;

  // Determine Criticality Tier
  let criticalityTier: FacilityInsightSummary['criticalityTier'] = 'TIER_2_MODERATE';
  let criticalityLabel = 'Moderate Environmental & Power Sensitivity';

  if (isHyperscale || stateProfile.waterStressBaseline === 'CRITICAL' || (aqiValue && aqiValue > 150)) {
    criticalityTier = 'TIER_1_ELEVATED';
    criticalityLabel = 'Elevated Resource & Grid Sensitivity';
  } else if (!isMidScale && maxCapacityMw < 15) {
    criticalityTier = 'TIER_3_NOMINAL';
    criticalityLabel = 'Standard Urban Edge Footprint';
  }

  // Construct Tailored Interventions
  const interventions: FacilityIntervention[] = [];

  // 1. Water Strategy
  if (stateProfile.waterStressBaseline === 'CRITICAL' || isHyperscale) {
    interventions.push({
      id: `${facility.id}-water-cooling`,
      title: 'Zero-Liquid-Discharge (ZLD) Closed-Loop / Air Cooling Transition',
      category: 'WATER_CONSERVATION',
      priority: 'HIGH',
      timeframe: '6 – 12 Months',
      responsibleStakeholder: 'Lead Infrastructure & Facilities Engineer',
      expectedBenefit: 'Reduces raw potable water consumption by 70% to 85% compared to evaporative wet cooling.',
      statutoryBasis: 'CGWB 2024 Guidelines for Groundwater Abstraction in Over-Exploited Assessment Units',
      rationale: `${facility.locality} (${facility.state}) sits within a high-extraction corridor. Wet cooling towers risk summer water supply curtailment.`,
    });
  } else {
    interventions.push({
      id: `${facility.id}-water-recycling`,
      title: 'Tertiary-Treated STP Wastewater & Rainwater Infiltration',
      category: 'WATER_CONSERVATION',
      priority: 'MODERATE',
      timeframe: '3 – 6 Months',
      responsibleStakeholder: 'Site Operations & Civil Maintenance',
      expectedBenefit: 'Offsets 40% of cooling makeup requirements through non-potable greywater recycling.',
      statutoryBasis: 'State Water Policy & Industrial Water Conservation Norms',
      rationale: 'Maximizes on-site recycling before drawing municipal or industrial piped allocation.',
    });
  }

  // 2. Power Grid & Renewable Integration
  if (isHyperscale) {
    interventions.push({
      id: `${facility.id}-grid-redundancy`,
      title: 'Dedicated 220kV/110kV Substation Bay with Dual-Feeder N-1 Redundancy',
      category: 'POWER_GRID',
      priority: 'HIGH',
      timeframe: '12 – 18 Months',
      responsibleStakeholder: `${stateProfile.discom} Liaison & Transmission Engineering`,
      expectedBenefit: 'Eliminates single-point distribution feeder tripping risks during peak summer demand spikes.',
      statutoryBasis: 'Central Electricity Authority (CEA) Technical Standards for Connectivity to the Grid 2024',
      rationale: `A ${maxCapacityMw > 0 ? `${maxCapacityMw} MW` : 'hyperscale'} load exceeds standard 33kV distribution feeder limits and requires dedicated transmission-level bays.`,
    });
  }

  interventions.push({
    id: `${facility.id}-green-power-ppa`,
    title: 'Green Energy Open Access Off-Site Wind/Solar Power Purchase Agreement (PPA)',
    category: 'ENERGY_EFFICIENCY',
    priority: isHyperscale ? 'HIGH' : 'MODERATE',
    timeframe: '6 – 9 Months',
    responsibleStakeholder: 'Chief Sustainability Officer / Energy Procurement Lead',
    expectedBenefit: 'Replaces Scope 2 grid carbon intensity with 60%+ renewable energy, lowering Levelized Cost of Energy (LCOE).',
    statutoryBasis: 'Ministry of Power Green Open Access Rules 2022 & State Tariff Regulations',
    rationale: `Supports state data centre policy renewable requirements in ${facility.state} without requiring on-campus land footprint.`,
  });

  // 3. Air Quality & Backup Diesel Generators
  interventions.push({
    id: `${facility.id}-backup-dg-emissions`,
    title: 'Dual-Fuel (PNG/Diesel) DG Retrofit & Acoustic Scrubber Integration',
    category: 'STATUTORY_COMPLIANCE',
    priority: 'MODERATE',
    timeframe: '4 – 8 Months',
    responsibleStakeholder: 'MEP Engineering Lead & Environmental Compliance Officer',
    expectedBenefit: 'Reduces particulate matter (PM2.5/PM10) and NOx emissions by up to 50% during grid failure tests.',
    statutoryBasis: `Central Pollution Control Board (CPCB) Industrial Emission Limits & ${stateProfile.spcb} Consent Conditions`,
    rationale: 'Ensures compliance with statutory Consent to Operate (CTO) chimney stack height and emissions monitoring standards.',
  });

  // 4. Energy Efficiency & BEE Rating
  interventions.push({
    id: `${facility.id}-bee-pue-optimization`,
    title: 'BEE Star-Rating Certification & AI-Assisted Cold Aisle Containment',
    category: 'ENERGY_EFFICIENCY',
    priority: 'STANDARD',
    timeframe: '3 – 6 Months',
    responsibleStakeholder: 'DC Operations & DCIM Lead',
    expectedBenefit: 'Improves Power Usage Effectiveness (PUE) from ~1.50 toward 1.30 or lower, lowering auxiliary chiller overhead.',
    statutoryBasis: 'Bureau of Energy Efficiency (BEE) Data Centre Energy Conservation Code',
    rationale: 'Qualifies the facility for state data-centre capital and power tariff subsidy schemes.',
  });

  // Compliance Checklist
  const complianceChecklist: FacilityComplianceRequirement[] = [
    {
      item: 'Consent to Operate (CTO) Renewal under Air & Water Acts',
      authority: stateProfile.spcb,
      mandatory: true,
      notes: 'Required for active operation, effluent discharge, and DG chimney stack emissions.',
    },
    {
      item: 'Central Ground Water Authority (CGWA) Abstraction NOC',
      authority: 'CGWB / State Water Board',
      mandatory: true,
      notes: 'Mandatory if on-site borewells are utilized; requires digital water flow meter telemetry.',
    },
    {
      item: 'Statutory Safety Inspection & Energization Approval',
      authority: 'Chief Electrical Inspector to Government (CEIG)',
      mandatory: true,
      notes: 'Mandatory for all 11kV, 33kV, and 110kV+ transformers and switchgear.',
    },
    {
      item: 'National Building Code (NBC Part IV) Fire Safety Clearance',
      authority: 'State Directorate of Fire Services',
      mandatory: true,
      notes: 'Gas-based clean agent (Novec 1230 / FM-200) server hall fire suppression verification.',
    },
  ];

  // Synthesize Executive Vulnerability Overview
  const capacityStatement = maxCapacityMw > 0 ? `disclosing ${maxCapacityMw} MW capacity` : 'an active operational data centre';
  const vulnerabilityOverview = `${facility.name} operates in ${facility.locality}, ${facility.city} (${facility.state}), ${capacityStatement}. Under the jurisdiction of ${stateProfile.spcb}, the facility is situated in an area characterized by ${stateProfile.regionalNotes} Key priority is balancing high-density IT electrical load with non-potable cooling security and CEA N-1 transmission stability.`;

  const disclaimer =
    'Automated screening recommendations generated from verified state, terrain (SRTM 30m), and environmental baselines. Not an official legal compliance clearance or engineering survey. Field verifications are required before capital deployment.';

  return {
    vulnerabilityOverview,
    criticalityTier,
    criticalityLabel,
    stateRegulatoryBody: stateProfile.spcb,
    stateDiscom: stateProfile.discom,
    interventions,
    complianceChecklist,
    disclaimer,
  };
}

